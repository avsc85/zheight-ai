import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

// Utility function for exponential backoff with jitter
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const getRetryDelay = (attempt: number) => {
  const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000); // Cap at 10s
  const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
  return baseDelay + jitter;
};

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

// Enhanced logging function with instrumentation
const logAPIMetrics = (modelUsed: string, success: boolean, extractedFields: string[], address: string, tokens: any, responseTime: number) => {
  console.log('📊 API METRICS:', {
    timestamp: new Date().toISOString(),
    model: modelUsed,
    success,
    extractionRate: `${extractedFields.length}/3`,
    extractedFields,
    address: address.substring(0, 50) + (address.length > 50 ? '...' : ''),
    tokens: tokens || null,
    responseTime
  });
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const processingStartTime = Date.now();
  let modelUsed = 'sonar-reasoning';

  try {
    const { projectAddress, prompt } = await req.json();

    if (!projectAddress) {
      throw new Error('Project address is required');
    }

    // Address Validation
    const addressValidation = validateAddress(projectAddress);
    if (!addressValidation.isValid) {
      console.warn('⚠️ ADDRESS VALIDATION WARNING:', {
        address: projectAddress,
        suggestions: addressValidation.suggestions
      });
    }

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('Perplexity API key not configured');
    }

    console.log('🏠 Processing feasibility analysis for address:', projectAddress);
    console.log('📝 User prompt:', prompt);

    // Validate Perplexity API connectivity and model availability
    console.log(`🚀 Using Perplexity Sonar model: ${modelUsed}`);

    // 🎯 Enhanced System Prompt for US Property Research - Prioritize Official Records for Lot Size Accuracy
    const systemPrompt = `You are a US property research AI specializing in property data extraction. Extract lot_size, zone, and jurisdiction data with MAXIMUM ACCURACY, prioritizing official government records.

LOT SIZE ACCURACY PROTOCOL (CRITICAL):
1. FIRST: Search county assessor/parcel records (most accurate for lot size)
2. SECOND: Cross-reference with city/municipal property records
3. THIRD: Verify with multiple real estate sources (Zillow, Redfin, Realtor.com)
4. FOURTH: If discrepancies exist, prefer government records over real estate sites
5. ALWAYS: Include the source used in your reasoning (internally, not in JSON)

SEARCH STRATEGY:
1. Start with "[County Name] assessor parcel search" + address
2. Search "[City Name] property records" + address  
3. Cross-verify with Zillow.com, Redfin.com, and Realtor.com
4. Check municipal planning/zoning websites for official zoning codes
5. Find the building permit/planning department responsible for the address

REQUIRED JSON FORMAT:
{
  "lot_size": "exact size with units (e.g., '8,276 sq ft', '0.19 acres') or null",
  "zone": "official zoning code (e.g., 'R-1', 'RS-6000') or null", 
  "jurisdiction": "building/planning dept (e.g., 'City of Palo Alto', 'Los Angeles County') or null"
}

CRITICAL REQUIREMENTS:
- NEVER return empty strings, use null for unknown values
- Always include units for lot_size (prefer sq ft over acres)
- Use the MOST ACCURATE lot size from official records
- Use OFFICIAL zoning codes from municipal sources
- Return the specific jurisdiction responsible for building permits
- Prioritize consistency and accuracy over speed
- Respond with ONLY the JSON object, no explanatory text`;

    const userMessage = `ADDRESS: ${projectAddress}
CONTEXT: ${prompt}
Extract lot_size, zone, jurisdiction. Respond with JSON only.`;

    console.log('📤 Perplexity Request:', {
      systemPrompt: systemPrompt.substring(0, 100) + '...',
      userMessage: userMessage.substring(0, 100) + '...',
      addressLength: projectAddress.length,
      promptLength: prompt.length
    });

    let extractedData: any;
    let openAIResponse: Response;
    
    // Robust retry logic with exponential backoff
    const makePerplexityRequest = async (isRetry = false, attempt = 0): Promise<Response> => {
      const maxRetries = 3;
      
      for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
        try {
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelUsed,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
              ],
              max_tokens: 1000,
              temperature: 0.2,
              top_p: 0.9,
              return_images: false,
              return_related_questions: false,
              search_recency_filter: 'month'
            }),
          });

          // Handle 503 and other retryable errors
          if (response.status === 503 || (response.status >= 500 && response.status !== 500)) {
            if (retryAttempt < maxRetries) {
              const delay = getRetryDelay(retryAttempt);
              console.log(`🔄 Perplexity ${response.status} error, retrying in ${Math.round(delay)}ms (attempt ${retryAttempt + 1}/${maxRetries + 1})`);
              await sleep(delay);
              continue;
            }
          }

          return response;
        } catch (error) {
          if (retryAttempt < maxRetries) {
            const delay = getRetryDelay(retryAttempt);
            console.log(`🔄 Network error, retrying in ${Math.round(delay)}ms (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, error);
            await sleep(delay);
            continue;
          }
          throw error;
        }
      }
      
      throw new Error('Max retries exceeded');
    };
    
    try {
      openAIResponse = await makePerplexityRequest();

          if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        console.error('❌ Perplexity API Error:', {
          status: openAIResponse.status,
          statusText: openAIResponse.statusText,
          error: errorText,
          model: modelUsed
        });
        
        // Enhanced error parsing for better debugging
        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
          if (parsedError.error?.message?.includes('Invalid model')) {
            console.error(`🚨 MODEL ERROR: Model '${modelUsed}' is not valid. Check Perplexity documentation for available models.`);
          }
        } catch (e) {
          console.warn('Could not parse error response as JSON');
        }
        
        logAPIMetrics(`${modelUsed}-failed`, false, [], projectAddress, null, Date.now());
        throw new Error(`Perplexity API error: ${openAIResponse.status} - ${errorText}`);
      }

      const result = await openAIResponse.json();
      
      console.log('✅ Perplexity API response data:', {
        id: result.id,
        model: result.model,
        usage: result.usage,
        choices: result.choices?.length,
        hasContent: !!result.choices?.[0]?.message?.content,
        finishReason: result.choices?.[0]?.finish_reason
      });

      const content = result.choices?.[0]?.message?.content;
      console.log('📄 Raw Perplexity response content:', JSON.stringify(content));

      // Check for token exhaustion and attempt salvage
      const finishReason = result.choices?.[0]?.finish_reason;
      if (!content || finishReason === 'length') {
        console.log('⚠️ Perplexity returned empty/truncated content, attempting salvage call...');
        
        // Second-chance salvage call with ultra-compact prompt
        try {
          const salvageResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityApiKey}`,
              'Content-Type': 'application/json',
            },
              body: JSON.stringify({
                model: modelUsed,
                messages: [
                  { 
                    role: 'system', 
                    content: 'Extract property data. Return only JSON: {"lot_size": "value or null", "zone": "value or null", "jurisdiction": "value or null"}' 
                  },
                  { role: 'user', content: `Address: ${projectAddress}` }
                ],
                max_tokens: 200,
                temperature: 0.2,
                top_p: 0.9,
                return_images: false,
                return_related_questions: false
              }),
          });
          
          if (salvageResponse.ok) {
            const salvageResult = await salvageResponse.json();
            const salvageContent = salvageResult.choices?.[0]?.message?.content;
            console.log('🚑 Salvage call content:', salvageContent);
            
            if (salvageContent) {
              extractedData = JSON.parse(salvageContent);
              console.log('✅ Salvage call successful:', extractedData);
              logAPIMetrics(`${modelUsed}-salvage-success`, true, [], projectAddress, salvageResult.usage, Date.now());
            } else {
              throw new Error('Salvage call also returned empty content');
            }
          } else {
            throw new Error('Salvage call failed');
          }
        } catch (salvageError) {
          console.error('❌ Salvage call failed:', salvageError);
          logAPIMetrics(`${modelUsed}-error`, false, [], 'error-occurred', null, Date.now());
          throw new Error('Perplexity returned empty content and salvage failed');
        }
      } else {
        try {
          extractedData = JSON.parse(content);
          console.log('✅ Successfully parsed JSON from Perplexity:', extractedData);
        } catch (parseError) {
          console.error('❌ JSON parsing error:', parseError, 'Content:', content);
          logAPIMetrics(`${modelUsed}-parse-error`, false, [], projectAddress, result.usage, Date.now());
          throw new Error(`Failed to parse Perplexity response as JSON: ${parseError}`);
        }
      }

    } catch (error) {
      console.error(`💥 Error calling Perplexity:`, error);
      logAPIMetrics(`${modelUsed}-error`, false, [], 'error-occurred', null, Date.now());
      throw error;
    }

    // Enhanced data normalization and validation
    const normalizeField = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' || trimmed.toLowerCase() === 'unknown' ? null : trimmed;
    };

    // Normalize extracted data fields
    extractedData = {
      lot_size: normalizeField(extractedData.lot_size),
      zone: normalizeField(extractedData.zone), 
      jurisdiction: normalizeField(extractedData.jurisdiction)
    };

    console.log(`🔧 ${modelUsed} extracted and normalized data:`, extractedData);

    // Validation and field completion tracking
    const extractedFieldsList = [];
    const missingFields = [];
    const suggestions = [];
    
    if (extractedData.lot_size) extractedFieldsList.push('lot_size');
    else {
      missingFields.push('lot_size');
      suggestions.push('Verify the address exists in public tax records');
    }
    
    if (extractedData.zone) extractedFieldsList.push('zone'); 
    else {
      missingFields.push('zone');
      suggestions.push('Check municipal zoning maps or planning department website');
    }
    
    if (extractedData.jurisdiction) extractedFieldsList.push('jurisdiction');
    else {
      missingFields.push('jurisdiction');
      suggestions.push('Confirm the city/county responsible for building permits');
    }

    console.log('📈 Extraction analytics:', {
      model: modelUsed,
      success: extractedFieldsList.length === 3,
      extractionRate: `${extractedFieldsList.length}/3`,
      extractedFields: extractedFieldsList,
      missingFields: missingFields,
      address: projectAddress
    });

    // Deterministic fallback logic for missing fields
    if (extractedFieldsList.length < 3) {
      console.log('🔄 Attempting targeted fallbacks for missing fields:', missingFields);
      
      // Fallback for missing lot_size
      if (!extractedData.lot_size && (extractedData.jurisdiction || extractedData.zone)) {
        console.log('📐 Attempting lot_size fallback...');
        try {
          const lotSizeFallback = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelUsed,
              messages: [
                { 
                  role: 'system', 
                  content: 'Find the exact lot size for this address. Check Zillow.com, Redfin.com, county assessor records. Return only JSON: {"lot_size": "value with units or null"}' 
                },
                { role: 'user', content: `Find lot size for: ${projectAddress}. Check multiple sources including Zillow, Redfin, county assessor.` }
              ],
              max_tokens: 500,
              temperature: 0.2,
              top_p: 0.9,
              return_images: false,
              return_related_questions: false
            }),
          });
          
          if (lotSizeFallback.ok) {
            const lotSizeResult = await lotSizeFallback.json();
            const lotSizeContent = lotSizeResult.choices?.[0]?.message?.content;
            if (lotSizeContent) {
              const lotSizeData = JSON.parse(lotSizeContent);
              if (lotSizeData.lot_size && normalizeField(lotSizeData.lot_size)) {
                extractedData.lot_size = normalizeField(lotSizeData.lot_size);
                extractedFieldsList.push('lot_size');
                missingFields.splice(missingFields.indexOf('lot_size'), 1);
                console.log('✅ Lot size fallback successful:', extractedData.lot_size);
              }
            }
          }
        } catch (fallbackError) {
          console.warn('⚠️ Lot size fallback failed:', fallbackError);
        }
      }
      
      // Fallback for missing zone
      if (!extractedData.zone && extractedData.jurisdiction) {
        console.log('🏘️ Attempting zone fallback...');
        try {
          const zoneFallback = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelUsed,
              messages: [
                { 
                  role: 'system', 
                  content: 'Find the official zoning designation for this address. Check municipal zoning maps and planning department websites. Return only JSON: {"zone": "official zoning code or null"}' 
                },
                { role: 'user', content: `Find zoning for: ${projectAddress} in ${extractedData.jurisdiction}. Check official municipal zoning maps.` }
              ],
              max_tokens: 500,
              temperature: 0.2,
              top_p: 0.9,
              return_images: false,
              return_related_questions: false
            }),
          });
          
          if (zoneFallback.ok) {
            const zoneResult = await zoneFallback.json();
            const zoneContent = zoneResult.choices?.[0]?.message?.content;
            if (zoneContent) {
              const zoneData = JSON.parse(zoneContent);
              if (zoneData.zone && normalizeField(zoneData.zone)) {
                extractedData.zone = normalizeField(zoneData.zone);
                extractedFieldsList.push('zone');
                missingFields.splice(missingFields.indexOf('zone'), 1);
                console.log('✅ Zone fallback successful:', extractedData.zone);
              }
            }
          }
        } catch (fallbackError) {
          console.warn('⚠️ Zone fallback failed:', fallbackError);
        }
      }
      
      // Fallback for missing jurisdiction
      if (!extractedData.jurisdiction) {
        console.log('🏛️ Attempting jurisdiction fallback...');
        try {
          const jurisdictionFallback = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelUsed,
              messages: [
                { 
                  role: 'system', 
                  content: 'Find which city or county building/planning department handles permits for this address. Return only JSON: {"jurisdiction": "department name or null"}' 
                },
                { role: 'user', content: `Find building permit jurisdiction for: ${projectAddress}. Which city/county department handles building permits here?` }
              ],
              max_tokens: 500,
              temperature: 0.2,
              top_p: 0.9,
              return_images: false,
              return_related_questions: false
            }),
          });
          
          if (jurisdictionFallback.ok) {
            const jurisdictionResult = await jurisdictionFallback.json();
            const jurisdictionContent = jurisdictionResult.choices?.[0]?.message?.content;
            if (jurisdictionContent) {
              const jurisdictionData = JSON.parse(jurisdictionContent);
              if (jurisdictionData.jurisdiction && normalizeField(jurisdictionData.jurisdiction)) {
                extractedData.jurisdiction = normalizeField(jurisdictionData.jurisdiction);
                extractedFieldsList.push('jurisdiction');
                missingFields.splice(missingFields.indexOf('jurisdiction'), 1);
                console.log('✅ Jurisdiction fallback successful:', extractedData.jurisdiction);
              }
            }
          }
        } catch (fallbackError) {
          console.warn('⚠️ Jurisdiction fallback failed:', fallbackError);
        }
      }
    }

    // Final validation - return 422 with helpful info for complete failures
    if (extractedFieldsList.length === 0) {
      logAPIMetrics(`${modelUsed}-validation-failed`, false, [], projectAddress, null, Date.now());
      
      return new Response(JSON.stringify({
        error: `No valid data could be extracted for address: "${projectAddress}" after multiple attempts`,
        missingFields: ['lot_size', 'zone', 'jurisdiction'],
        suggestions: [
          'Verify the address exists in public records (try Zillow/Redfin)',
          'Check address formatting (e.g., "123 Main St, City, State ZIP")',
          'Ensure it\'s a valid US property address',
          'Try with additional context (unit numbers, etc.)',
          'Check if the property is newly constructed or subdivided'
        ],
        partialData: null
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log successful metrics (even for partial success)
    logAPIMetrics(modelUsed, extractedFieldsList.length === 3, extractedFieldsList, projectAddress, null, Date.now());

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

    // Enhanced database insert with better error handling
    const { data: feasibilityData, error: insertError } = await supabase
      .from('feasibility_analyses')
      .insert({
        project_address: projectAddress,
        lot_size: extractedData.lot_size,
        zone: extractedData.zone,
        jurisdiction: extractedData.jurisdiction,
        user_id: user.id,
        last_updated_by: user.id,
        notes: `Analysis completed using ${modelUsed}. Processing time: ${Date.now() - processingStartTime}ms. Fields extracted: ${extractedFieldsList.length}/3`
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      logAPIMetrics(`${modelUsed}-db-error`, false, extractedFieldsList, projectAddress, null, Date.now());
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('✅ Successfully stored feasibility analysis:', feasibilityData.id);

    // Enhanced ordinance matching with better logic
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

    // Enhanced response with analytics and warnings for partial results
    const finalResponse = {
      success: true,
      feasibilityAnalysis: feasibilityData,
      ordinances: ordinances,
      extractedData: extractedData,
      analytics: {
        modelUsed,
        processingTimeMs: Date.now() - processingStartTime,
        extractionRate: `${extractedFieldsList.length}/3`,
        successRate: `${Math.round((extractedFieldsList.length / 3) * 100)}%`,
        ordinancesFound: ordinances.length,
        addressValidation: addressValidation.isValid ? 'PASSED' : 'FAILED',
        warningsFound: missingFields.length > 0
      },
      warnings: missingFields.length > 0 ? {
        missingFields,
        suggestions
      } : undefined
    };

    console.log('🎉 Analysis completed successfully:', {
      analysisId: feasibilityData.id,
      totalTimeMs: Date.now() - processingStartTime,
      extractedFields: extractedFieldsList,
      ordinanceCount: ordinances.length
    });

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTimeMs = Date.now() - processingStartTime;
    
    console.error(`💥 Error in ai-feasibility-analyzer function:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs,
      modelUsed: modelUsed
    });

    logAPIMetrics(`${modelUsed}-error`, false, [], 'error-occurred', null, Date.now());

    // Return 500 only for unexpected errors, not validation failures
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred during analysis',
      processingTimeMs,
      suggestions: [
        'Try again in a few moments',
        'Verify your address format is correct',
        'Check if the address exists in public records'
      ]
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});