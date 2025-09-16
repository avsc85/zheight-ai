import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectAddress, prompt } = await req.json();

    if (!projectAddress) {
      throw new Error('Project address is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Processing feasibility analysis for address:', projectAddress);
    console.log('User prompt:', prompt);

    // Enhanced system prompt with examples and clearer instructions
    const systemPrompt = `You are an AI assistant specialized in extracting property information from US addresses. You have access to property records, zoning information, and municipal data.

    EXAMPLES of expected outputs:
    - For "123 Main St, Palo Alto, CA": {"lot_size": "0.25 acres", "zone": "R-1", "jurisdiction": "Palo Alto"}
    - For "456 Oak Ave, Santa Clara, CA": {"lot_size": "6,000 sq ft", "zone": "R-2", "jurisdiction": "Santa Clara"}
    - For incomplete info: {"lot_size": null, "zone": "R-1", "jurisdiction": "San Jose"}

    You must respond with ONLY valid JSON in this exact format:
    {
      "lot_size": "specific lot size with units (e.g., '0.25 acres', '10,000 sq ft') or null",
      "zone": "specific zoning designation (e.g., 'R-1-5000', 'R-2', 'C-1') or null", 
      "jurisdiction": "specific city or county name (e.g., 'Palo Alto', 'Santa Clara County') or null"
    }
    
    INSTRUCTIONS: 
    - Extract specific, factual property information from the given address
    - For lot_size: Include units (sq ft, acres, etc.) - be specific
    - For zone: Use actual zoning codes (R-1, R-2, C-1, etc.) not descriptions
    - For jurisdiction: Use the specific city or county name
    - If you cannot determine specific information, return null for that field
    - Never return empty strings - use null instead
    - Use your knowledge of US property records and zoning systems`;

    const userMessage = `Extract property information for this address: ${projectAddress}

Additional context: ${prompt}

Please analyze this address and extract the lot size, zoning designation, and jurisdiction based on your knowledge of property records and municipal zoning systems.`;

    console.log('Sending request to GPT-5 with enhanced prompt');

    // Call GPT-5 to extract lot size, zone, and jurisdiction
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  type: ["string", "null"]
                },
                zone: { 
                  type: ["string", "null"]
                },
                jurisdiction: { 
                  type: ["string", "null"]
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
      const error = await response.text();
      console.error('OpenAI API error response:', {
        status: response.status,
        statusText: response.statusText,
        error: error,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('OpenAI API response data:', {
      id: data.id,
      model: data.model,
      usage: data.usage,
      choices: data.choices?.length,
      hasContent: !!data.choices?.[0]?.message?.content
    });
    
    let extractedData;
    
    try {
      const messageContent = data.choices[0].message.content;
      console.log('Raw OpenAI response content:', JSON.stringify(messageContent));
      
      if (!messageContent || messageContent.trim() === '') {
        console.warn('Empty response from OpenAI, using default values');
        extractedData = { lot_size: null, zone: null, jurisdiction: null };
      } else {
        extractedData = JSON.parse(messageContent);
        console.log('Parsed extracted data (before normalization):', extractedData);
      }
    } catch (parseError) {
      console.error('JSON parsing error:', {
        error: parseError.message,
        rawContent: data.choices[0].message.content
      });
      extractedData = { lot_size: null, zone: null, jurisdiction: null };
    }

    // Normalize and validate extracted data
    const normalizeField = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    extractedData = {
      lot_size: normalizeField(extractedData.lot_size),
      zone: normalizeField(extractedData.zone), 
      jurisdiction: normalizeField(extractedData.jurisdiction)
    };

    console.log('GPT-5 extracted and normalized data:', extractedData);

    // Count how many fields we successfully extracted
    const extractedFields = [];
    const missingFields = [];
    
    if (extractedData.lot_size) extractedFields.push('lot_size');
    else missingFields.push('lot_size');
    
    if (extractedData.zone) extractedFields.push('zone'); 
    else missingFields.push('zone');
    
    if (extractedData.jurisdiction) extractedFields.push('jurisdiction');
    else missingFields.push('jurisdiction');

    console.log('Extraction summary:', {
      extractedFields,
      missingFields,
      extractionRate: `${extractedFields.length}/3`
    });

    // For debugging phase, allow partial extraction but warn about missing fields
    if (missingFields.length > 0) {
      console.warn(`Missing fields: ${missingFields.join(', ')}`);
      console.warn('Address analyzed:', projectAddress);
      console.warn('Prompt used:', prompt);
      
      // Return 422 only if we have no useful data at all
      if (extractedFields.length === 0) {
        console.error('Complete extraction failure - no fields extracted');
        return new Response(JSON.stringify({ 
          error: `Unable to extract any property information from the address: "${projectAddress}". Please verify the address format and try again.`,
          debugInfo: {
            address: projectAddress,
            extractedData,
            missingFields,
            prompt: prompt.substring(0, 100) + '...'
          }
        }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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

    // Insert feasibility analysis record
    const { data: feasibilityData, error: insertError } = await supabase
      .from('feasibility_analyses')
      .insert({
        project_address: projectAddress,
        lot_size: extractedData.lot_size,
        zone: extractedData.zone,
        jurisdiction: extractedData.jurisdiction,
        user_id: user.id,
        last_updated_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    // Query for matching jurisdiction ordinances
    let ordinances = [];
    if (extractedData.jurisdiction && extractedData.zone) {
      const { data: ordinanceData, error: ordinanceError } = await supabase
        .from('jurisdiction_ordinances')
        .select('*')
        .ilike('jurisdiction', `%${extractedData.jurisdiction}%`)
        .ilike('zone', `%${extractedData.zone}%`);

      if (!ordinanceError) {
        ordinances = ordinanceData || [];
      }
    }

    return new Response(JSON.stringify({
      feasibilityAnalysis: feasibilityData,
      ordinances: ordinances,
      extractedData: extractedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-feasibility-analyzer function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});