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
              "lot_size": "extracted lot size or null",
              "zone": "extracted zoning information or null", 
              "jurisdiction": "extracted city/jurisdiction or null"
            }
            
            Extract what you can from the address provided. If information cannot be determined, use null for that field.` 
          },
          { 
            role: 'user', 
            content: `${prompt}\n\nAddress: ${projectAddress}` 
          }
        ],
        max_completion_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedData = JSON.parse(data.choices[0].message.content);

    console.log('GPT-5 extracted data:', extractedData);

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