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
    console.log('Edge function starting...');
    
    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey || !openAIApiKey) {
      console.error('Missing environment variables:', { 
        hasSupabaseUrl: !!supabaseUrl, 
        hasServiceKey: !!supabaseServiceKey, 
        hasOpenAI: !!openAIApiKey 
      });
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      throw new Error('No authorization header');
    }

    console.log('Verifying user authentication...');
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      throw new Error('Unauthorized');
    }

    console.log(`User authenticated: ${user.id}`);

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
      const { data: promptData, error: promptError } = await supabase
        .from('agent_prompts')
        .select('prompt')
        .eq('name', 'default_checklist_extractor')
        .single();
      
      if (promptError) {
        console.log('No default prompt found, using fallback');
      }
      
      systemPrompt = promptData?.prompt || 'You are an AI assistant specialized in analyzing architectural plans and city correction letters to extract compliance checklists.';
    }

    // Check file sizes - reduced limits due to OpenAI file upload constraints
    const MAX_FILE_SIZE = 512 * 1024 * 1024; // 512MB limit for OpenAI file uploads
    const MAX_TOTAL_FILES = 10; // Reasonable limit for processing
    
    if (files.length > MAX_TOTAL_FILES) {
      throw new Error(`Too many files. Maximum ${MAX_TOTAL_FILES} files allowed.`);
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File ${file.name} is too large. Maximum size is 512MB.`);
      }
    }

    // Upload files to OpenAI using File Upload API
    const uploadedFiles = [];
    
    console.log(`Starting file upload process for ${files.length} files`);
    
    for (const file of files) {
      console.log(`Uploading file to OpenAI: ${file.name}, size: ${file.size} bytes`);
      
      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('purpose', 'assistants');

        const uploadResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
          },
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error(`File upload error for ${file.name}:`, errorText);
          console.error(`Response status: ${uploadResponse.status}, headers:`, Object.fromEntries(uploadResponse.headers.entries()));
          throw new Error(`Failed to upload ${file.name}: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        uploadedFiles.push(uploadResult.id);
        
        console.log(`Successfully uploaded file: ${file.name} with ID: ${uploadResult.id}`);
      } catch (uploadError) {
        console.error(`Critical error uploading file ${file.name}:`, uploadError);
        throw uploadError;
      }
    }
    
    console.log(`All files uploaded successfully. File IDs:`, uploadedFiles);

    // Create a vector store first
    console.log('Creating vector store...');
    
    const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name: "Architectural Documents Store",
        file_ids: uploadedFiles
      }),
    });

    if (!vectorStoreResponse.ok) {
      const errorText = await vectorStoreResponse.text();
      console.error('Vector store creation error:', errorText);
      throw new Error(`Failed to create vector store: ${vectorStoreResponse.status}`);
    }

    const vectorStore = await vectorStoreResponse.json();
    console.log(`Created vector store: ${vectorStore.id}`);

    // Create OpenAI assistant with the vector store
    console.log('Creating OpenAI assistant for document analysis...');
    console.log('Using model: gpt-4o');
    
    // Declare variables outside try-catch for proper scope
    let assistantResponse;
    let assistant;
    
    try {
      const assistantPayload = {
        name: "Architectural Compliance Extractor",
        instructions: systemPrompt + `

CRITICAL RESPONSE FORMAT REQUIREMENTS:
1. You MUST respond with ONLY valid JSON - no explanatory text, no markdown, no additional commentary
2. Start your response immediately with { and end with }
3. Use this exact structure: {"items": [array of correction items]}
4. Each item must have these exact field names: sheet_name, issue_to_check, location, type_of_issue, code_source, code_identifier, short_code_requirement, long_code_requirement, source_link, project_type, city, zip_code, reviewer_name, type_of_correction, zone_primary, occupancy_group, natural_hazard_zone
5. Use 'unspecified' for any unknown values - never leave fields empty or null
6. Process ALL correction items - count them first, then extract every single one
7. DO NOT include any text before or after the JSON object
8. Ensure the JSON is complete and not truncated

Example format:
{
  "items": [
    {
      "sheet_name": "A-1.1",
      "issue_to_check": "Clarify project scope",
      "location": "Site plan",
      "type_of_issue": "Planning",
      "code_source": "City ordinance",
      "code_identifier": "unspecified",
      "short_code_requirement": "Clear project indication",
      "long_code_requirement": "Plans must clearly show proposed changes",
      "source_link": "https://sunnyvaleca.gov",
      "project_type": "Addition",
      "city": "Sunnyvale",
      "zip_code": "unspecified",
      "reviewer_name": "Cindy Hom",
      "type_of_correction": "Clarification",
      "zone_primary": "unspecified",
      "occupancy_group": "unspecified",
      "natural_hazard_zone": "unspecified"
    }
  ]
}`,
        model: "gpt-4.1-2025-04-14",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStore.id]
          }
        }
      };
      
      console.log('Using model:', assistantPayload.model);
      console.log('Assistant instructions length:', assistantPayload.instructions.length);
      
      assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(assistantPayload),
      });

      if (!assistantResponse.ok) {
        const errorText = await assistantResponse.text();
        console.error('Assistant creation error:', errorText);
        console.error(`Response status: ${assistantResponse.status}, headers:`, Object.fromEntries(assistantResponse.headers.entries()));
        throw new Error(`Failed to create assistant: ${assistantResponse.status} - ${errorText}`);
      }
      
      assistant = await assistantResponse.json();
      console.log(`Created assistant: ${assistant.id}`);
    } catch (assistantError) {
      console.error('Critical error creating assistant:', assistantError);
      throw assistantError;
    }

    // Create a thread with the uploaded files
    console.log('Creating thread with uploaded files...');
    
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({}),
    });

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      console.error('Thread creation error:', errorText);
      throw new Error(`Failed to create thread: ${threadResponse.status}`);
    }

    const thread = await threadResponse.json();
    console.log(`Created thread: ${thread.id}`);

    // Add a message to the thread
    console.log('Adding message to thread...');
    
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        role: "user",
        content: "Please analyze the uploaded architectural plans and correction documents to extract compliance checklist items according to your instructions. CRITICAL: First, count the total number of correction items mentioned in the city's correction letter. Then extract EVERY SINGLE correction item - do not skip any. Process documents page by page if needed to ensure completeness. Focus on identifying specific building code violations, accessibility issues, fire safety requirements, and any reviewer comments that need to be addressed. Ensure your response includes all correction items found, not just a subset."
      }),
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Message creation error:', errorText);
      throw new Error(`Failed to create message: ${messageResponse.status}`);
    }

    // Run the assistant
    console.log('Running assistant analysis...');
    
    // Declare variables outside try-catch for proper scope
    let runResponse;
    let run;
    
    try {
      const runPayload = {
        assistant_id: assistant.id
      };
      
      console.log('Starting run for assistant:', runPayload.assistant_id);
      
      runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(runPayload),
      });

      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        console.error('Run creation error:', errorText);
        console.error(`Response status: ${runResponse.status}, headers:`, Object.fromEntries(runResponse.headers.entries()));
        throw new Error(`Failed to start run: ${runResponse.status} - ${errorText}`);
      }
      
      run = await runResponse.json();
      console.log(`Started run: ${run.id}`);
    } catch (runError) {
      console.error('Critical error starting run:', runError);
      throw runError;
    }

    // Poll for completion with increased timeout
    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes timeout for better processing
    
    while (runStatus === 'queued' || runStatus === 'in_progress') {
      if (attempts >= maxAttempts) {
        console.error(`Analysis timeout after ${maxAttempts} attempts`);
        throw new Error('Analysis timeout - processing taking too long');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      const statusData = await statusResponse.json();
      runStatus = statusData.status;
      attempts++;
      
      console.log(`Run status: ${runStatus} (attempt ${attempts}/${maxAttempts})`);
      
      // Log additional details if available
      if (statusData.last_error) {
        console.error('Run error details:', statusData.last_error);
      }
    }

    if (runStatus !== 'completed') {
      throw new Error(`Analysis failed with status: ${runStatus}`);
    }

    // Get the assistant's response
    console.log('Retrieving assistant response...');
    
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    const messagesData = await messagesResponse.json();
    const responseContent = messagesData.data[0].content[0].text.value;

    console.log('OpenAI assistant response received (length:', responseContent.length, ')');
    console.log('Response preview:', responseContent.substring(0, 500) + '...');
    
    // Check if response appears truncated
    if (!responseContent.includes('}') && !responseContent.includes(']')) {
      console.warn('Response may be truncated - no closing brackets found');
    }

    // Clean up resources
    try {
      // Delete assistant
      await fetch(`https://api.openai.com/v1/assistants/${assistant.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      // Delete vector store
      await fetch(`https://api.openai.com/v1/vector_stores/${vectorStore.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      // Clean up uploaded files
      for (const fileId of uploadedFiles) {
        await fetch(`https://api.openai.com/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
          },
        });
      }
      
      console.log('Cleaned up OpenAI resources');
    } catch (cleanupError) {
      console.warn('Failed to cleanup some OpenAI resources:', cleanupError);
    }

    // Parse the JSON response with enhanced error handling
    let extractedItems;
    
    // Clean the response content first
    function cleanJsonResponse(content: string): string {
      // Remove markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Fix common JSON issues
      content = content.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      
      // Fix truncated URLs and strings
      content = content.replace(/"https?:[^"]*$/gm, '"unspecified"');
      content = content.replace(/"[^"]*$/gm, '"unspecified"');
      
      return content.trim();
    }
    
    try {
      console.log('Raw response content length:', responseContent.length);
      console.log('Raw response starts with:', responseContent.substring(0, 100));
      console.log('Raw response ends with:', responseContent.substring(responseContent.length - 100));
      
      const cleanedContent = cleanJsonResponse(responseContent);
      console.log('Cleaned response preview (first 300 chars):', cleanedContent.substring(0, 300));
      console.log('Cleaned response preview (last 100 chars):', cleanedContent.substring(cleanedContent.length - 100));
      
      // First, try to parse the entire cleaned content as JSON
      try {
        const directParse = JSON.parse(cleanedContent);
        if (directParse.items && Array.isArray(directParse.items)) {
          extractedItems = directParse.items;
          console.log(`✅ Direct JSON parse successful with ${extractedItems.length} items`);
        } else if (Array.isArray(directParse)) {
          extractedItems = directParse;
          console.log(`✅ Direct array parse successful with ${extractedItems.length} items`);
        } else {
          throw new Error('Parsed JSON does not contain items array');
        }
      } catch (directError) {
        console.log('❌ Direct JSON parse failed, trying pattern matching...');
        
        // Try to extract JSON object with items array
        const jsonMatch = cleanedContent.match(/\{[\s\S]*?"items"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            extractedItems = parsed.items || [];
            console.log(`✅ Pattern match JSON parse successful with ${extractedItems.length} items`);
          } catch (matchError) {
            console.error('❌ Pattern matched JSON parse failed:', matchError);
            throw matchError;
          }
        } else {
          // Try to find just the items array
          const arrayMatch = cleanedContent.match(/\[[\s\S]*?\]/);
          if (arrayMatch) {
            try {
              extractedItems = JSON.parse(arrayMatch[0]);
              console.log(`✅ Array pattern match successful with ${extractedItems.length} items`);
            } catch (arrayError) {
              console.error('❌ Array pattern match failed:', arrayError);
              throw arrayError;
            }
          } else {
            console.error('❌ No JSON patterns found in response');
            throw new Error('No valid JSON structure found in response');
          }
        }
      }
    } catch (parseError) {
      console.error('🚨 ALL JSON parsing methods failed:', parseError);
      console.error('Response content analysis:');
      console.error('- Length:', responseContent.length);
      console.error('- Starts with "{" or "[":', responseContent.trim().startsWith('{') || responseContent.trim().startsWith('['));
      console.error('- Contains "items":', responseContent.includes('"items"'));
      console.error('- Contains "issue_to_check":', responseContent.includes('"issue_to_check"'));
      
      // Count potential items by looking for issue_to_check fields
      const potentialItems = responseContent.match(/"issue_to_check":\s*"[^"]*"/g);
      const itemCount = potentialItems ? potentialItems.length : 0;
      
      if (itemCount > 0) {
        console.log(`Found ${itemCount} potential items, but response format is invalid`);
        throw new Error(`Response contains ${itemCount} correction items but is not in valid JSON format. AI may have included explanatory text.`);
      } else {
        throw new Error(`Invalid response format from OpenAI: ${parseError.message}`);
      }
    }

    if (!Array.isArray(extractedItems)) {
      console.error('Extracted items is not an array:', typeof extractedItems, extractedItems);
      throw new Error('OpenAI response does not contain a valid items array');
    }

    if (extractedItems.length === 0) {
      console.warn('WARNING: No items extracted from OpenAI response');
      console.log('This may indicate incomplete processing or document parsing issues');
    }

    console.log(`Successfully extracted ${extractedItems.length} items from OpenAI response`);
    
    // Log first item structure for debugging
    if (extractedItems.length > 0) {
      console.log('First item structure:', JSON.stringify(extractedItems[0], null, 2));
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
      zone_primary: item.zone_primary || null,
      occupancy_group: item.occupancy_group || null,
      natural_hazard_zone: item.natural_hazard_zone || null,
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
    console.error('Critical error in agent1-extract-checklist function:', error);
    console.error('Error stack:', error.stack);
    console.error('Error type:', error.constructor.name);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
        stack: error.stack,
        type: error.constructor.name
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});