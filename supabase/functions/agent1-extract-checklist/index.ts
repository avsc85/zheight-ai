import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const customPrompt = formData.get('prompt') as string;

    if (!files.length) {
      throw new Error('No files provided');
    }

    console.log(`Processing ${files.length} files for user ${user.id}`);

    // Get the agent prompt (use custom if provided, otherwise get default)
    let systemPrompt = customPrompt;
    
    if (!customPrompt) {
      const { data: promptData } = await supabase
        .from('agent_prompts')
        .select('prompt_text')
        .eq('agent_name', 'Agent-1')
        .eq('is_default', true)
        .single();
      
      systemPrompt = promptData?.prompt_text || 'You are an AI assistant specialized in analyzing architectural plans and city correction letters to extract compliance checklists.';
    }

    // Convert files to base64
    const filePromises = files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return {
        type: "image_url",
        image_url: {
          url: `data:${file.type};base64,${base64}`
        }
      };
    });

    const fileContents = await Promise.all(filePromises);

    // Create OpenAI request
    const openAIRequest = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt + "\n\nPlease respond with a JSON array of objects, each representing a checklist item with these exact field names: sheet_name, issue_to_check, location, type_of_issue, code_source, code_identifier, short_code_requirement, long_code_requirement, source_link, project_type, city, zip_code, reviewer_name, type_of_correction"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze these architectural plans and correction letters to extract compliance checklist items according to the system prompt."
            },
            ...fileContents
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.3
    };

    console.log('Sending request to OpenAI...');

    // Send request to OpenAI
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIRequest),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const responseContent = openAIData.choices[0].message.content;

    console.log('OpenAI response received:', responseContent);

    // Parse the JSON response
    let extractedItems;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedItems = JSON.parse(jsonMatch[0]);
      } else {
        extractedItems = JSON.parse(responseContent);
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!Array.isArray(extractedItems)) {
      throw new Error('OpenAI response is not an array');
    }

    // Prepare data for database insertion
    const checklistItems = extractedItems.map((item: any) => ({
      user_id: user.id,
      sheet_name: item.sheet_name || null,
      issue_to_check: item.issue_to_check || 'Not specified',
      location: item.location || null,
      type_of_issue: item.type_of_issue || null,
      code_source: item.code_source || null,
      code_identifier: item.code_identifier || null,
      short_code_requirement: item.short_code_requirement || null,
      long_code_requirement: item.long_code_requirement || null,
      source_link: item.source_link || null,
      project_type: item.project_type || null,
      city: item.city || null,
      zip_code: item.zip_code || null,
      reviewer_name: item.reviewer_name || null,
      type_of_correction: item.type_of_correction || null,
    }));

    console.log(`Inserting ${checklistItems.length} items into database...`);

    // Insert into database
    const { data: insertedData, error: insertError } = await supabase
      .from('checklist_items')
      .insert(checklistItems)
      .select();

    if (insertError) {
      console.error('Database insertion error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log(`Successfully inserted ${insertedData.length} checklist items`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully extracted and saved ${insertedData.length} checklist items`,
        data: insertedData,
        extractedCount: extractedItems.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in agent1-extract-checklist function:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});