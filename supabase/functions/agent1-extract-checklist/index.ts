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

// Helper function for cleanup - defined at module level
async function cleanupOpenAIResources(assistantId: string, vectorStoreId: string, fileIds: string[], apiKey: string) {
  try {
    // Delete assistant
    await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });
    
    // Delete vector store
    await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });
    
    // Clean up uploaded files
    for (const fileId of fileIds) {
      await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
    }
    
    console.log('Cleaned up OpenAI resources');
  } catch (cleanupError) {
    console.warn('Failed to cleanup some OpenAI resources:', cleanupError);
  }
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
        instructions: systemPrompt + "\n\nIMPORTANT: Respond ONLY with valid JSON without any comments, markdown formatting, or additional text. Each item should have these exact field names: sheet_name, issue_to_check, location, type_of_issue, code_source, code_identifier, short_code_requirement, long_code_requirement, source_link, project_type, city, zip_code, reviewer_name, type_of_correction, zone_primary, occupancy_group, natural_hazard_zone. Return the result as: {\"items\": [...]}. Do not include any JavaScript-style comments (//) or any text outside the JSON object.",
        model: "gpt-4.1-2025-04-14",
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
    console.log('Response preview:', responseContent.substring(0, 500) + '...');
    console.log('Original response length:', responseContent.length);

    // CRITICAL: Parse JSON BEFORE cleanup to avoid losing response data
    let extractedItems;
    try {
      extractedItems = robustJsonParse(responseContent);
      console.log('Successfully parsed response, found items:', extractedItems.items?.length || 0);
    } catch (parseError) {
      console.error('Parse error:', parseError.message);
      console.error('Original response:', responseContent);
      console.error('Response preview:', responseContent.substring(0, 1000));
      
      // Clean up resources before throwing error
      await cleanupOpenAIResources(assistant.id, vectorStore.id, uploadedFiles, openAIApiKey);
      throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
    }

    // Clean up resources after successful parsing
    await cleanupOpenAIResources(assistant.id, vectorStore.id, uploadedFiles, openAIApiKey);

    // Enhanced JSON validation and sanitization functions
    function sanitizeUrl(url: string): string {
      try {
        // Handle incomplete URLs
        if (!url || url === 'unspecified') return 'unspecified';
        
        // If URL is cut off mid-way, handle gracefully
        if (url.includes('https:') && !url.includes('://')) {
          // Incomplete URL like "https:" - return unspecified
          return 'unspecified';
        }
        
        // Basic URL validation
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return url;
        }
        
        // If it looks like a partial URL path, mark as unspecified
        if (url.startsWith('/') || url.includes('DocumentCenter') || url.includes('.org') || url.includes('.com')) {
          return 'unspecified';
        }
        
        return url;
      } catch (error) {
        console.warn('URL sanitization error:', error);
        return 'unspecified';
      }
    }

    function sanitizeJsonString(text: string): string {
      // Remove control characters that cause JSON parsing errors
      let cleaned = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      // Handle escaped quotes and backslashes
      cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      
      // Remove single-line comments (// comment)
      cleaned = cleaned.replace(/\/\/.*$/gm, '');
      
      // Remove multi-line comments (/* comment */)
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Remove markdown code blocks if present
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      cleaned = cleaned.replace(/```\s*/g, '');
      
      // Fix common JSON formatting issues
      cleaned = cleaned.replace(/,\s*}/g, '}'); // Remove trailing commas
      cleaned = cleaned.replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
      
      // Handle incomplete string values (especially URLs)
      cleaned = cleaned.replace(/"source_link":\s*"https:[^"]*(?="[^}]*})/g, '"source_link": "unspecified"');
      cleaned = cleaned.replace(/"source_link":\s*"[^"]*$/g, '"source_link": "unspecified"');
      
      // Fix incomplete JSON objects at the end
      if (cleaned.includes('{') && !cleaned.trim().endsWith('}')) {
        // Find the last complete object
        const lastCompleteObj = cleaned.lastIndexOf('},');
        if (lastCompleteObj !== -1) {
          cleaned = cleaned.substring(0, lastCompleteObj + 1) + '\n    ]\n}';
        }
      }
      
      return cleaned.trim();
    }

    function validateJsonStructure(text: string): boolean {
      try {
        // Basic structure validation before parsing
        const trimmed = text.trim();
        
        // Must start with { or [
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          return false;
        }
        
        // Must end with } or ]
        if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
          return false;
        }
        
        // Check for balanced braces and brackets
        let braceCount = 0;
        let bracketCount = 0;
        let inString = false;
        let escaped = false;
        
        for (let i = 0; i < trimmed.length; i++) {
          const char = trimmed[i];
          
          if (escaped) {
            escaped = false;
            continue;
          }
          
          if (char === '\\') {
            escaped = true;
            continue;
          }
          
          if (char === '"' && !escaped) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
            if (char === '[') bracketCount++;
            if (char === ']') bracketCount--;
          }
        }
        
        return braceCount === 0 && bracketCount === 0;
      } catch (error) {
        return false;
      }
    }

    function robustJsonParse(text: string): any {
      console.log('Starting robust JSON parsing...');
      
      // Step 1: Sanitize the input
      let cleaned = sanitizeJsonString(text);
      console.log('Sanitized response length:', cleaned.length);
      
      // Step 2: Validate structure
      if (!validateJsonStructure(cleaned)) {
        console.warn('JSON structure validation failed, attempting repair...');
        // Try to find and extract valid JSON portion
        const match = cleaned.match(/\{[\s\S]*"items"[\s\S]*?\}(?=\s*$)/);
        if (match) {
          cleaned = match[0];
        } else {
          throw new Error('Invalid JSON structure detected');
        }
      }
      
      // Step 3: Multiple parsing strategies
      const parseStrategies = [
        // Strategy 1: Direct parse
        () => JSON.parse(cleaned),
        
        // Strategy 2: Extract JSON object with items
        () => {
          const jsonMatch = cleaned.match(/\{[\s\S]*?"items"[\s\S]*?\}/);
          if (!jsonMatch) throw new Error('No items object found');
          return JSON.parse(jsonMatch[0]);
        },
        
        // Strategy 3: Extract just the items array
        () => {
          const arrayMatch = cleaned.match(/"items":\s*(\[[\s\S]*?\])/);
          if (!arrayMatch) throw new Error('No items array found');
          return { items: JSON.parse(arrayMatch[1]) };
        },
        
        // Strategy 4: Manual object reconstruction
        () => {
          console.log('Attempting manual JSON reconstruction...');
          // Try to reconstruct from individual item objects
          const itemMatches = cleaned.match(/\{[^{}]*"issue_to_check"[^{}]*\}/g);
          if (!itemMatches) throw new Error('No item objects found');
          
          const items = itemMatches.map(item => JSON.parse(item));
          return { items };
        }
      ];
      
      for (let i = 0; i < parseStrategies.length; i++) {
        try {
          console.log(`Trying parsing strategy ${i + 1}...`);
          const result = parseStrategies[i]();
          
          // Validate and sanitize URLs in the result
          if (result.items && Array.isArray(result.items)) {
            result.items = result.items.map((item: any) => ({
              ...item,
              source_link: sanitizeUrl(item.source_link || 'unspecified')
            }));
          }
          
          console.log(`Strategy ${i + 1} succeeded, found ${result.items?.length || 0} items`);
          return result;
        } catch (error) {
          console.log(`Strategy ${i + 1} failed:`, error.message);
          if (i === parseStrategies.length - 1) {
            throw error;
          }
        }
      }
      
      throw new Error('All parsing strategies failed');
    }

    // Prepare data for database insertion using already parsed items
    const checklistItems = extractedItems.items.map((item: any) => ({
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
        extractedCount: extractedItems.items.length
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