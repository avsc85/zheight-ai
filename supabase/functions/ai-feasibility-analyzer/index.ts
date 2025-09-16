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
            content: `You are an AI assistant that extracts property information from addresses. 
            You must respond with ONLY valid JSON in this exact format:
            {
              "lot_size": "specific lot size with units (e.g., '0.25 acres', '10,000 sq ft') or null",
              "zone": "specific zoning designation (e.g., 'R-1-5000', 'R-2') or null", 
              "jurisdiction": "specific city or county name (e.g., 'Palo Alto', 'Santa Clara County') or null"
            }
            
            CRITICAL: 
            - Only return non-null values if you can determine specific, accurate information
            - For lot_size: Must include units (sq ft, acres, etc.)
            - For zone: Must be specific zoning code, not generic descriptions
            - For jurisdiction: Must be specific city/county name, not state or generic location
            - If you cannot determine accurate specific information, return null for that field
            - Never return empty strings - use null instead` 
          },
          { 
            role: 'user', 
            content: `${prompt}\n\nAddress: ${projectAddress}` 
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
                  type: ["string", "null"],
                  minLength: 1
                },
                zone: { 
                  type: ["string", "null"],
                  minLength: 1
                },
                jurisdiction: { 
                  type: ["string", "null"],
                  minLength: 1
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
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let extractedData;
    
    try {
      const messageContent = data.choices[0].message.content;
      console.log('Raw OpenAI response content:', messageContent);
      
      if (!messageContent || messageContent.trim() === '') {
        console.warn('Empty response from OpenAI, using default values');
        extractedData = { lot_size: null, zone: null, jurisdiction: null };
      } else {
        extractedData = JSON.parse(messageContent);
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Failed to parse content:', data.choices[0].message.content);
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

    // Validate that required fields have values
    const missingFields = [];
    if (!extractedData.lot_size) missingFields.push('lot_size');
    if (!extractedData.zone) missingFields.push('zone');
    if (!extractedData.jurisdiction) missingFields.push('jurisdiction');

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(JSON.stringify({ 
        error: `Unable to extract required property information: ${missingFields.join(', ')}. Please provide a more specific address or try again.`,
        missingFields: missingFields,
        extractedData: extractedData
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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