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

// Function to create a summarized output of 8-15 items
async function createSummarizedOutput(
  newlyExtractedItems: any[],
  extractedCity: string | null,
  userId: string,
  supabase: any
): Promise<any[]> {
  const MIN_ITEMS = 8;
  const MAX_ITEMS = 15;
  
  console.log(`Creating summarized output: ${newlyExtractedItems.length} new items, city: ${extractedCity || 'Not detected'}`);
  
  // Start with all newly extracted items
  let summarizedItems = [...newlyExtractedItems];
  
  // If we already have 15 or more, return first 15
  if (summarizedItems.length >= MAX_ITEMS) {
    console.log(`Already have ${summarizedItems.length} items, returning first ${MAX_ITEMS}`);
    return summarizedItems.slice(0, MAX_ITEMS);
  }
  
  // If we have 8-14 items, return as-is
  if (summarizedItems.length >= MIN_ITEMS) {
    console.log(`Have ${summarizedItems.length} items (within 8-15 range), returning all`);
    return summarizedItems;
  }
  
  // If we have < 8 items, augment with existing items from database
  if (extractedCity && extractedCity !== 'Not detected' && extractedCity.trim() !== '') {
    const itemsNeeded = MAX_ITEMS - summarizedItems.length;
    console.log(`Need ${itemsNeeded} more items to reach target range, querying database for city: ${extractedCity}`);
    
    // Query existing checklist items for this city
    const { data: existingItems, error: queryError } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('user_id', userId)
      .ilike('city', extractedCity)
      .order('created_at', { ascending: false })
      .limit(itemsNeeded);
    
    if (queryError) {
      console.error('Error querying existing checklist items:', queryError);
    } else if (existingItems && existingItems.length > 0) {
      console.log(`Found ${existingItems.length} existing items for city: ${extractedCity}`);
      
      // Filter out duplicates (items with same issue_to_check)
      const existingIssues = new Set(summarizedItems.map(item => item.issue_to_check?.toLowerCase().trim()));
      const uniqueExistingItems = existingItems.filter(item => 
        !existingIssues.has(item.issue_to_check?.toLowerCase().trim())
      );
      
      console.log(`Adding ${uniqueExistingItems.length} unique existing items to summary`);
      summarizedItems.push(...uniqueExistingItems);
      
      // Cap at MAX_ITEMS
      if (summarizedItems.length > MAX_ITEMS) {
        summarizedItems = summarizedItems.slice(0, MAX_ITEMS);
      }
    } else {
      console.log(`No existing items found for city: ${extractedCity}`);
    }
  } else {
    console.log('No valid city detected, cannot augment with existing items');
  }
  
  console.log(`Final summarized output: ${summarizedItems.length} items`);
  return summarizedItems;
}

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
    
    for (const file of files) {
      console.log(`Uploading file to OpenAI: ${file.name}, size: ${file.size} bytes`);
      
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
        throw new Error(`Failed to upload ${file.name}: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      uploadedFiles.push(uploadResult.id);
      
      console.log(`Successfully uploaded file: ${file.name} with ID: ${uploadResult.id}`);
    }

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
    
    const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name: "Architectural Compliance Extractor",
        instructions: systemPrompt + "\n\nPlease respond with a JSON object containing an 'items' array. Each item should have these exact field names: sheet_name, issue_to_check, location, type_of_issue, code_source, code_identifier, short_code_requirement, long_code_requirement, source_link, project_type, city, zip_code, reviewer_name, type_of_correction. Return the result as: {\"items\": [...]}.",
        model: "gpt-4o",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStore.id]
          }
        }
      }),
    });

    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      console.error('Assistant creation error:', errorText);
      throw new Error(`Failed to create assistant: ${assistantResponse.status}`);
    }

    const assistant = await assistantResponse.json();
    console.log(`Created assistant: ${assistant.id}`);

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
        content: "Please analyze the uploaded architectural plans and correction documents to extract compliance checklist items according to your instructions. Focus on identifying specific building code violations, accessibility issues, fire safety requirements, and any reviewer comments that need to be addressed."
      }),
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Message creation error:', errorText);
      throw new Error(`Failed to create message: ${messageResponse.status}`);
    }

    // Run the assistant
    console.log('Running assistant analysis...');
    
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: assistant.id,
      }),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Run creation error:', errorText);
      throw new Error(`Failed to start run: ${runResponse.status}`);
    }

    const run = await runResponse.json();
    console.log(`Started run: ${run.id}`);

    // Poll for completion
    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes timeout
    
    while (runStatus === 'queued' || runStatus === 'in_progress') {
      if (attempts >= maxAttempts) {
        throw new Error('Analysis timeout - please try with smaller files');
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

    console.log('OpenAI assistant response received:', responseContent);

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

    // Parse the JSON response
    let extractedItems;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*"items"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extractedItems = parsed.items || [];
      } else {
        // Fallback: try to parse as array directly
        const arrayMatch = responseContent.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          extractedItems = JSON.parse(arrayMatch[0]);
        } else {
          extractedItems = JSON.parse(responseContent);
        }
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!Array.isArray(extractedItems)) {
      throw new Error('OpenAI response does not contain a valid items array');
    }

    console.log(`Extracted ${extractedItems.length} items from OpenAI response`);

    // Extract the most common city from the extracted items
    const cityFrequency: Record<string, number> = {};
    extractedItems.forEach((item: any) => {
      const city = item.city;
      if (city && city !== 'Unspecified' && city.trim() !== '') {
        cityFrequency[city] = (cityFrequency[city] || 0) + 1;
      }
    });

    // Get the most common city (or null if none found)
    let extractedCity: string | null = null;
    let maxFrequency = 0;
    for (const [city, frequency] of Object.entries(cityFrequency)) {
      if (frequency > maxFrequency) {
        maxFrequency = frequency;
        extractedCity = city;
      }
    }

    console.log(`Detected primary city: ${extractedCity || 'Not detected'}`);
    console.log(`City frequency:`, cityFrequency);

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

    console.log(`Successfully inserted ${insertedData.length} checklist items into database`);

    // Create summarized output of 8-15 items
    const summarizedOutput = await createSummarizedOutput(
      insertedData,
      extractedCity,
      user.id,
      supabase
    );

    console.log(`Returning summarized output of ${summarizedOutput.length} items to frontend`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully extracted and saved ${insertedData.length} checklist items`,
        data: summarizedOutput, // Return summarized output instead of all items
        extractedCount: extractedItems.length,
        totalSaved: insertedData.length,
        displayedCount: summarizedOutput.length,
        city: extractedCity || 'Not detected'
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