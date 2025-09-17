import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Address format validation
const validateAddress = (address: string): { isValid: boolean; suggestions?: string[] } => {
  if (!address || address.trim().length < 10) {
    return {
      isValid: false,
      suggestions: ['Address must be at least 10 characters long']
    };
  }

  const hasNumber = /\d/.test(address);
  const hasState = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i.test(address);
  const hasComma = address.includes(',');

  const suggestions = [];
  if (!hasNumber) suggestions.push('Include street number (e.g., "123 Main St")');
  if (!hasComma) suggestions.push('Separate city/state with comma (e.g., "Street, City, State")');
  if (!hasState) suggestions.push('Include state abbreviation (e.g., "CA", "NY")');

  return {
    isValid: hasNumber && hasState,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
};

// Enhanced logging function
const logAPIMetrics = (modelUsed: string, success: boolean, extractedFields: string[], response: any, address: string) => {
  console.log('📊 API METRICS:', {
    timestamp: new Date().toISOString(),
    model: modelUsed,
    success,
    extractionRate: `${extractedFields.length}/3`,
    extractedFields,
    address: address.substring(0, 50) + (address.length > 50 ? '...' : ''),
    tokens: response?.usage || null,
    responseTime: Date.now()
  });
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let modelUsed = 'unknown';
  let extractedFields: string[] = [];

  try {
    const { projectAddress, prompt } = await req.json();

    if (!projectAddress) {
      throw new Error('Project address is required');
    }

    // Phase 3: Address Validation
    const addressValidation = validateAddress(projectAddress);
    if (!addressValidation.isValid) {
      console.warn('⚠️ ADDRESS VALIDATION WARNING:', {
        address: projectAddress,
        suggestions: addressValidation.suggestions
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🏠 Processing feasibility analysis for address:', projectAddress);
    console.log('📝 User prompt:', prompt);

    // Phase 2: Improved sanitization - less aggressive, allow more characters
    const sanitizedPrompt = prompt ? 
      prompt.replace(/[<>]/g, '').replace(/javascript:/gi, '').substring(0, 1000) : '';
    
    // Phase 2: Enhanced system prompt with better research instructions
    const systemPrompt = `You are a specialized AI assistant for US property research with access to property records, zoning databases, tax assessor information, and municipal planning documents.

🔍 RESEARCH METHODOLOGY:
- Use your knowledge of property databases (Zillow, Redfin, county assessor records)
- Reference municipal zoning maps and GIS systems
- Access building department records and planning documents
- Consult real estate MLS data when available
- Cross-reference with tax records and parcel maps

📊 DATA ACCURACY REQUIREMENTS:
- Prioritize official municipal/county sources over commercial estimates
- For lot_size: Use tax assessor records, not building footprint estimates
- For zone: Reference current zoning maps, not general area descriptions
- For jurisdiction: Identify the specific planning/building department authority

🎯 OUTPUT FORMAT (STRICT):
Respond with ONLY valid JSON in this exact structure:
{
  "lot_size": "exact size with units (e.g., '8,000 sq ft', '0.23 acres') or null",
  "zone": "specific zoning code (e.g., 'R-1-6000', 'R-2-A', 'RS-7') or null",
  "jurisdiction": "exact municipal name (e.g., 'City of Palo Alto', 'Santa Clara County') or null"
}

⚠️ CRITICAL RULES:
- Never return empty strings - use null for unknown values
- Include units for lot_size (sq ft, acres, etc.)
- Use official zoning codes, not descriptions
- Return the building/planning department jurisdiction, not just city name
- If you cannot find reliable data, return null rather than guessing

📋 EXAMPLES:
- "1234 Forest Ave, Palo Alto, CA" → {"lot_size": "6,534 sq ft", "zone": "R-1", "jurisdiction": "City of Palo Alto"}
- "567 Main St, Unincorporated Santa Clara County" → {"lot_size": "0.5 acres", "zone": "A1", "jurisdiction": "Santa Clara County"}`;

    const userMessage = `🏡 PROPERTY RESEARCH REQUEST

TARGET ADDRESS: ${projectAddress}

ADDITIONAL CONTEXT: ${sanitizedPrompt}

TASK: Using your knowledge of US property databases, tax records, and zoning systems, extract the following information for this specific address:

1. LOT SIZE: Find the parcel size from tax assessor records or property databases
2. ZONING: Identify the current zoning designation from municipal zoning maps
3. JURISDICTION: Determine which city/county building department has authority

Focus on official records and be specific with measurements and codes. If you cannot find reliable information for any field, return null for that field.`;

    // Use only GPT-5 for property analysis
    let response;
    let extractedData;
    modelUsed = 'gpt-5-2025-08-07';

    console.log('🚀 Using GPT-5 for property analysis');
    console.log('📤 FULL PROMPT TO GPT-5:', { 
      systemPrompt: systemPrompt.substring(0, 200) + '...', 
      userMessage: userMessage.substring(0, 200) + '...',
      addressLength: projectAddress.length,
      promptLength: sanitizedPrompt.length
    });

    // GPT-5 with improved oneOf schema format
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: systemPrompt
          },
          { 
            role: 'user', 
            content: userMessage
          }
        ],
        max_completion_tokens: 500,
        response_format: { 
          type: "json_schema",
          json_schema: {
            name: "property_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                lot_size: { 
                  oneOf: [
                    { type: "string" },
                    { type: "null" }
                  ]
                },
                zone: { 
                  oneOf: [
                    { type: "string" },
                    { type: "null" }
                  ]
                },
                jurisdiction: { 
                  oneOf: [
                    { type: "string" },
                    { type: "null" }
                  ]
                }
              },
              required: ["lot_size", "zone", "jurisdiction"],
              additionalProperties: false
            }
          }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ GPT-5 API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      });
      logAPIMetrics('gpt-5-failed', false, [], null, projectAddress);
      throw new Error(`GPT-5 API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log('✅ GPT-5 API response data:', {
      id: data.id,
      model: data.model,
      usage: data.usage,
      choices: data.choices?.length,
      hasContent: !!data.choices?.[0]?.message?.content,
      finishReason: data.choices?.[0]?.finish_reason
    });

    const messageContent = data.choices[0].message.content;
    console.log('📄 Raw GPT-5 response content:', JSON.stringify(messageContent?.substring(0, 500)));

    // Check if GPT-5 returned empty or invalid content
    if (!messageContent || messageContent.trim() === '') {
      logAPIMetrics(modelUsed, false, [], data, projectAddress);
      throw new Error('GPT-5 returned empty content');
    }

    try {
      extractedData = JSON.parse(messageContent);
      console.log('✅ GPT-5 parsed data:', extractedData);
      
      // Log successful GPT-5 usage
      extractedFields = Object.keys(extractedData).filter(key => extractedData[key] !== null);
      logAPIMetrics(modelUsed, true, extractedFields, data, projectAddress);
      
    } catch (parseError) {
      console.error('❌ GPT-5 JSON parsing failed:', {
        error: parseError.message,
        content: messageContent?.substring(0, 200)
      });
      logAPIMetrics(modelUsed, false, [], data, projectAddress);
      throw new Error(`GPT-5 JSON parsing failed: ${parseError.message}`);
    }

    console.log(`🎯 Successfully extracted data using model: ${modelUsed}`);
    console.log(`⏱️ Total processing time: ${Date.now() - startTime}ms`);

    // Phase 4: Enhanced data normalization and validation
    const normalizeField = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' || trimmed.toLowerCase() === 'unknown' ? null : trimmed;
    };

    extractedData = {
      lot_size: normalizeField(extractedData.lot_size),
      zone: normalizeField(extractedData.zone), 
      jurisdiction: normalizeField(extractedData.jurisdiction)
    };

    console.log(`🔧 ${modelUsed} extracted and normalized data:`, extractedData);

    // Phase 4: Enhanced extraction analytics
    const extractedFieldsList = [];
    const missingFields = [];
    
    if (extractedData.lot_size) extractedFieldsList.push('lot_size');
    else missingFields.push('lot_size');
    
    if (extractedData.zone) extractedFieldsList.push('zone'); 
    else missingFields.push('zone');
    
    if (extractedData.jurisdiction) extractedFieldsList.push('jurisdiction');
    else missingFields.push('jurisdiction');

    console.log('📈 Extraction analytics:', {
      model: modelUsed,
      extractedFields: extractedFieldsList,
      missingFields,
      extractionRate: `${extractedFieldsList.length}/3`,
      successRate: `${Math.round((extractedFieldsList.length / 3) * 100)}%`,
      addressValidation: addressValidation.isValid ? 'PASSED' : 'FAILED',
      processingTimeMs: Date.now() - startTime
    });

    // Phase 3: Enhanced validation with better error messages and suggestions
    if (missingFields.length > 0) {
      console.error(`❌ VALIDATION FAILED - Missing required fields: ${missingFields.join(', ')}`);
      console.error('📍 Address analyzed:', projectAddress);
      console.error('🔍 Sanitized prompt used:', sanitizedPrompt);
      console.error('🤖 Model used:', modelUsed);
      
      const partialSuccess = extractedFieldsList.length > 0;
      const errorMessage = missingFields.length === 3 
        ? `Unable to extract any property information from "${projectAddress}". This could be due to:
           • Address format issues (${!addressValidation.isValid ? 'detected' : 'not detected'})
           • Property not found in available databases
           • Address may not be a US residential property`
        : `Successfully extracted ${extractedFieldsList.join(', ')} but missing: ${missingFields.join(', ')}. 
           This may indicate incomplete property records or address format issues.`;
      
      const suggestions = [
        ...(!addressValidation.isValid && addressValidation.suggestions ? addressValidation.suggestions : []),
        'Ensure address includes city and state (e.g., "123 Main St, Palo Alto, CA")',
        'Try using the full street address with ZIP code',
        'Verify the address exists and is a valid US residential property',
        'Check if the property is in an incorporated city vs. unincorporated county area'
      ];

      // Phase 5: Allow partial success if we got some data
      if (partialSuccess && extractedFieldsList.length >= 2) {
        console.warn('⚠️ PARTIAL SUCCESS - Proceeding with available data');
        
        // Continue processing but log the warning
        logAPIMetrics(modelUsed + '-partial', true, extractedFieldsList, null, projectAddress);
      } else {
        // Complete failure - return error
        logAPIMetrics(modelUsed + '-failed', false, extractedFieldsList, null, projectAddress);
        
        return new Response(JSON.stringify({ 
          error: errorMessage,
          missingFields,
          extractedFields: extractedFieldsList,
          address: projectAddress,
          modelUsed,
          suggestions,
          partialData: partialSuccess ? extractedData : null
        }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('✅ VALIDATION PASSED - All required fields extracted successfully');
      logAPIMetrics(modelUsed + '-complete', true, extractedFieldsList, null, projectAddress);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log('💾 Storing feasibility analysis for user:', user.id);

    // Phase 4: Enhanced database insert with better error handling
    const { data: feasibilityData, error: insertError } = await supabase
      .from('feasibility_analyses')
      .insert({
        project_address: projectAddress,
        lot_size: extractedData.lot_size,
        zone: extractedData.zone,
        jurisdiction: extractedData.jurisdiction,
        user_id: user.id,
        last_updated_by: user.id,
        notes: `Analysis completed using ${modelUsed}. Processing time: ${Date.now() - startTime}ms. Fields extracted: ${extractedFieldsList.length}/3`
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      logAPIMetrics(modelUsed + '-db-error', false, extractedFieldsList, null, projectAddress);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('✅ Successfully stored feasibility analysis:', feasibilityData.id);

    // Phase 3: Enhanced ordinance matching with better logic
    let ordinances = [];
    if (extractedData.jurisdiction && extractedData.zone) {
      console.log('🔍 Searching for matching ordinances...');
      
      const { data: ordinanceData, error: ordinanceError } = await supabase
        .from('jurisdiction_ordinances')
        .select('*')
        .ilike('jurisdiction', `%${extractedData.jurisdiction}%`)
        .ilike('zone', `%${extractedData.zone}%`);

      if (ordinanceError) {
        console.warn('⚠️ Ordinance query error:', ordinanceError);
      } else {
        ordinances = ordinanceData || [];
        console.log(`📋 Found ${ordinances.length} matching ordinances`);
      }
    } else {
      console.log('⚠️ Insufficient data for ordinance matching (missing jurisdiction or zone)');
    }

    // Phase 4: Enhanced response with analytics
    const finalResponse = {
      success: true,
      feasibilityAnalysis: feasibilityData,
      ordinances: ordinances,
      extractedData: extractedData,
      analytics: {
        modelUsed,
        processingTimeMs: Date.now() - startTime,
        extractionRate: `${extractedFieldsList.length}/3`,
        successRate: `${Math.round((extractedFieldsList.length / 3) * 100)}%`,
        ordinancesFound: ordinances.length,
        addressValidation: addressValidation.isValid ? 'PASSED' : 'FAILED'
      }
    };

    console.log('🎉 Analysis completed successfully:', {
      analysisId: feasibilityData.id,
      totalTimeMs: Date.now() - startTime,
      extractedFields: extractedFieldsList,
      ordinanceCount: ordinances.length
    });

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorTimeMs = Date.now() - startTime;
    console.error('💥 Error in ai-feasibility-analyzer function:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      processingTimeMs: errorTimeMs,
      modelUsed
    });
    
    // Log error metrics
    logAPIMetrics(modelUsed + '-error', false, extractedFields, null, 'error-occurred');
    
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred',
      processingTimeMs: errorTimeMs,
      modelUsed
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});