import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced debugging and logging utilities
const logStep = (step: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`🔧 [${timestamp}] [STEP] ${step}`, data ? JSON.stringify(data, null, 2).substring(0, 300) : '');
};

const logError = (step: string, error: any, context?: any) => {
  const timestamp = new Date().toISOString();
  console.error(`❌ [${timestamp}] [ERROR] ${step}:`, error.message || error);
  if (error.stack) console.error(`Stack: ${error.stack}`);
  if (context) console.error(`Context:`, JSON.stringify(context, null, 2).substring(0, 300));
};

const logWarning = (step: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.warn(`⚠️  [${timestamp}] [WARNING] ${step}: ${message}`, data ? JSON.stringify(data, null, 2).substring(0, 200) : '');
};

const logSuccess = (step: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`✅ [${timestamp}] [SUCCESS] ${step}`, data ? JSON.stringify(data, null, 2).substring(0, 200) : '');
};

// Enhanced timeout utility with progress tracking
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      logError('TIMEOUT', new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`));
      reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    logStep(`TIMEOUT_START`, { operation, timeoutMs });
    const result = await Promise.race([promise, timeoutPromise]);
    logSuccess(`TIMEOUT_COMPLETED`, { operation });
    return result;
  } catch (error) {
    logError('TIMEOUT_FAILED', error, { operation });
    throw error;
  }
};

// Enhanced API call wrapper with retry logic
const apiCallWithRetry = async (url: string, options: RequestInit, operation: string, retries = 2): Promise<Response> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      logStep(`API_CALL_ATTEMPT_${attempt}`, { operation, url: url.substring(0, 50) });
      
      const response = await withTimeout(
        fetch(url, options),
        60000, // 60 second timeout for API calls
        `${operation} (attempt ${attempt})`
      );
      
      // Log response details
      logStep(`API_RESPONSE`, {
        operation,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logError(`API_ERROR_RESPONSE`, new Error(`${response.status}: ${errorText}`), { operation, attempt });
        
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }
        
        // Retry on server errors (5xx) and network issues
        if (attempt <= retries) {
          logWarning(`API_RETRY`, `Retrying ${operation} in ${attempt * 2} seconds`, { attempt, status: response.status });
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      logSuccess(`API_CALL_SUCCESS`, { operation, attempt });
      return response;
      
    } catch (error) {
      lastError = error as Error;
      logError(`API_CALL_ERROR`, error, { operation, attempt });
      
      if (attempt <= retries) {
        logWarning(`API_RETRY`, `Retrying ${operation} in ${attempt * 2} seconds due to error`, { attempt, error: error.message });
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError!;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Track execution time
  const startTime = Date.now();
  let userId: string | null = null;
  let uploadedFiles: string[] = [];
  let vectorStoreId: string | null = null;
  let assistantId: string | null = null;

  try {
    logStep('FUNCTION_START', { method: req.method, url: req.url });
    
    // Phase 1: Environment and Authentication Validation
    logStep('ENV_VALIDATION_START');
    if (!supabaseUrl || !supabaseServiceKey || !openAIApiKey) {
      const missingVars = {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasOpenAI: !!openAIApiKey
      };
      logError('ENV_VALIDATION_FAILED', new Error('Missing environment variables'), missingVars);
      throw new Error('Missing required environment variables');
    }
    logSuccess('ENV_VALIDATION');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logError('AUTH_HEADER_MISSING', new Error('No authorization header provided'));
      throw new Error('No authorization header');
    }

    logStep('USER_AUTH_START');
    // Verify user authentication with timeout
    const authResult = await withTimeout(
      supabase.auth.getUser(authHeader.replace('Bearer ', '')),
      10000,
      'User Authentication'
    );

    if (authResult.error || !authResult.data?.user) {
      logError('USER_AUTH_FAILED', authResult.error || new Error('No user data'));
      throw new Error('Unauthorized');
    }

    userId = authResult.data.user.id;
    logSuccess('USER_AUTH', { userId });

    // Phase 2: Request Data Validation
    logStep('REQUEST_PARSING_START');
    const formData = await withTimeout(
      req.formData(),
      30000,
      'Form Data Parsing'
    );
    
    const files = formData.getAll('files') as File[];
    const customPrompt = formData.get('prompt') as string;

    if (!files.length) {
      logError('FILE_VALIDATION_FAILED', new Error('No files provided'));
      throw new Error('No files provided');
    }

    logSuccess('REQUEST_PARSING', { fileCount: files.length, hasCustomPrompt: !!customPrompt });

    // Validate file constraints
    const MAX_FILE_SIZE = 512 * 1024 * 1024; // 512MB
    const MAX_TOTAL_FILES = 10;
    
    if (files.length > MAX_TOTAL_FILES) {
      logError('FILE_COUNT_EXCEEDED', new Error(`Too many files: ${files.length}`));
      throw new Error(`Too many files. Maximum ${MAX_TOTAL_FILES} files allowed.`);
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        logError('FILE_SIZE_EXCEEDED', new Error(`File too large: ${file.name} (${file.size} bytes)`));
        throw new Error(`File ${file.name} is too large. Maximum size is 512MB.`);
      }
      if (file.size === 0) {
        logError('EMPTY_FILE', new Error(`Empty file detected: ${file.name}`));
        throw new Error(`File ${file.name} is empty`);
      }
    }

    // Phase 3: Prompt Retrieval
    let systemPrompt = customPrompt;
    
    if (!customPrompt) {
      logStep('DEFAULT_PROMPT_FETCH_START');
      try {
        const promptResult = await withTimeout(
          supabase
            .from('agent_prompts')
            .select('prompt')
            .eq('name', 'default_checklist_extractor')
            .single(),
          5000,
          'Default Prompt Retrieval'
        );
        
        if (promptResult.error) {
          logWarning('DEFAULT_PROMPT_NOT_FOUND', 'Using fallback prompt', { error: promptResult.error.message });
        } else {
          systemPrompt = promptResult.data?.prompt;
          logSuccess('DEFAULT_PROMPT_FETCH');
        }
      } catch (promptError) {
        logWarning('DEFAULT_PROMPT_ERROR', 'Using fallback prompt', { error: promptError.message });
      }
    }
    
    if (!systemPrompt) {
      systemPrompt = 'You are an AI assistant specialized in analyzing architectural plans and city correction letters to extract compliance checklists.';
      logWarning('USING_FALLBACK_PROMPT', 'No custom or default prompt available');
    }

    // Phase 4: File Upload to OpenAI
    logStep('FILE_UPLOAD_START', { fileCount: files.length });
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      logStep(`FILE_UPLOAD_${i + 1}`, { name: file.name, size: file.size, type: file.type });
      
      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('purpose', 'assistants');

        const uploadResponse = await apiCallWithRetry(
          'https://api.openai.com/v1/files',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
            },
            body: uploadFormData,
          },
          `File Upload: ${file.name}`,
          2 // 2 retries for file uploads
        );

        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult.id) {
          logError('FILE_UPLOAD_NO_ID', new Error('Upload response missing file ID'), { result: uploadResult });
          throw new Error(`File upload failed for ${file.name}: No file ID returned`);
        }
        
        uploadedFiles.push(uploadResult.id);
        logSuccess(`FILE_UPLOAD_${i + 1}`, { fileId: uploadResult.id, name: file.name });
        
      } catch (uploadError) {
        logError(`FILE_UPLOAD_${i + 1}_FAILED`, uploadError, { fileName: file.name });
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }
    }
    
    logSuccess('ALL_FILES_UPLOADED', { fileIds: uploadedFiles });

    // Phase 5: Vector Store Creation
    logStep('VECTOR_STORE_CREATE_START');
    
    const vectorStoreResponse = await apiCallWithRetry(
      'https://api.openai.com/v1/vector_stores',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          name: `Architectural Documents Store - ${userId}`,
          file_ids: uploadedFiles
        }),
      },
      'Vector Store Creation'
    );

    const vectorStore = await vectorStoreResponse.json();
    vectorStoreId = vectorStore.id;
    
    if (!vectorStoreId) {
      logError('VECTOR_STORE_NO_ID', new Error('Vector store response missing ID'), { result: vectorStore });
      throw new Error('Failed to create vector store: No ID returned');
    }
    
    logSuccess('VECTOR_STORE_CREATED', { vectorStoreId });

    // Wait for vector store to be ready
    logStep('VECTOR_STORE_STATUS_CHECK');
    let vectorStoreReady = false;
    let statusAttempts = 0;
    const maxStatusAttempts = 20;
    
    while (!vectorStoreReady && statusAttempts < maxStatusAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const statusResponse = await apiCallWithRetry(
          `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
          {
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'OpenAI-Beta': 'assistants=v2',
            },
          },
          'Vector Store Status Check'
        );
        
        const statusData = await statusResponse.json();
        logStep('VECTOR_STORE_STATUS', { status: statusData.status, attempt: statusAttempts + 1 });
        
        if (statusData.status === 'completed') {
          vectorStoreReady = true;
        } else if (statusData.status === 'failed') {
          throw new Error(`Vector store creation failed: ${statusData.last_error?.message || 'Unknown error'}`);
        }
        
        statusAttempts++;
      } catch (statusError) {
        logError('VECTOR_STORE_STATUS_ERROR', statusError);
        statusAttempts++;
      }
    }
    
    if (!vectorStoreReady) {
      logWarning('VECTOR_STORE_STATUS_TIMEOUT', 'Proceeding without confirmation of readiness');
    } else {
      logSuccess('VECTOR_STORE_READY');
    }

    // Phase 6: Assistant Creation
    logStep('ASSISTANT_CREATE_START');
    
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
          vector_store_ids: [vectorStoreId]
        }
      }
    };
    
    logStep('ASSISTANT_PAYLOAD', { 
      model: assistantPayload.model, 
      instructionsLength: assistantPayload.instructions.length,
      vectorStoreId 
    });
    
    const assistantResponse = await apiCallWithRetry(
      'https://api.openai.com/v1/assistants',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(assistantPayload),
      },
      'Assistant Creation'
    );
    
    const assistant = await assistantResponse.json();
    assistantId = assistant.id;
    
    if (!assistantId) {
      logError('ASSISTANT_NO_ID', new Error('Assistant response missing ID'), { result: assistant });
      throw new Error('Failed to create assistant: No ID returned');
    }
    
    logSuccess('ASSISTANT_CREATED', { assistantId });

    // Phase 7: Thread Creation and Message Addition
    logStep('THREAD_CREATE_START');
    
    const threadResponse = await apiCallWithRetry(
      'https://api.openai.com/v1/threads',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({}),
      },
      'Thread Creation'
    );

    const thread = await threadResponse.json();
    const threadId = thread.id;
    
    if (!threadId) {
      logError('THREAD_NO_ID', new Error('Thread response missing ID'), { result: thread });
      throw new Error('Failed to create thread: No ID returned');
    }
    
    logSuccess('THREAD_CREATED', { threadId });

    // Add message to thread
    logStep('MESSAGE_ADD_START');
    
    const messageResponse = await apiCallWithRetry(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
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
      },
      'Message Addition'
    );
    
    logSuccess('MESSAGE_ADDED');

    // Phase 8: Run Creation and Monitoring
    logStep('RUN_CREATE_START');
    
    const runResponse = await apiCallWithRetry(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          assistant_id: assistantId
        }),
      },
      'Run Creation'
    );
    
    const run = await runResponse.json();
    const runId = run.id;
    
    if (!runId) {
      logError('RUN_NO_ID', new Error('Run response missing ID'), { result: run });
      throw new Error('Failed to start run: No ID returned');
    }
    
    logSuccess('RUN_CREATED', { runId });

    // Enhanced run monitoring with timeout
    logStep('RUN_MONITORING_START');
    
    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 200; // Increased timeout for complex analysis
    const pollInterval = 3000; // 3 second intervals
    const maxRunTime = 10 * 60 * 1000; // 10 minutes max
    const runStartTime = Date.now();
    
    while (runStatus === 'queued' || runStatus === 'in_progress') {
      if (attempts >= maxAttempts || (Date.now() - runStartTime) > maxRunTime) {
        logError('RUN_TIMEOUT', new Error(`Analysis timeout after ${attempts} attempts or ${Date.now() - runStartTime}ms`));
        throw new Error('Analysis timeout - processing taking too long');
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      try {
        const statusResponse = await apiCallWithRetry(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
          {
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'OpenAI-Beta': 'assistants=v2',
            },
          },
          `Run Status Check (${attempts + 1})`
        );
        
        const statusData = await statusResponse.json();
        runStatus = statusData.status;
        attempts++;
        
        logStep('RUN_STATUS', { 
          status: runStatus, 
          attempt: attempts, 
          maxAttempts,
          elapsedMs: Date.now() - runStartTime
        });
        
        // Log additional details if available
        if (statusData.last_error) {
          logError('RUN_ERROR_DETAILS', new Error('Run has errors'), { lastError: statusData.last_error });
        }
        
        if (statusData.required_action) {
          logWarning('RUN_REQUIRES_ACTION', 'Run requires manual action', { requiredAction: statusData.required_action });
        }
        
      } catch (statusError) {
        logError('RUN_STATUS_CHECK_ERROR', statusError);
        attempts++;
        // Continue trying even if status check fails
      }
    }

    if (runStatus !== 'completed') {
      logError('RUN_FAILED', new Error(`Analysis failed with status: ${runStatus}`));
      throw new Error(`Analysis failed with status: ${runStatus}`);
    }
    
    logSuccess('RUN_COMPLETED', { totalAttempts: attempts, elapsedMs: Date.now() - runStartTime });

    // Phase 9: Response Retrieval and Processing
    logStep('RESPONSE_RETRIEVAL_START');
    
    const messagesResponse = await apiCallWithRetry(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      },
      'Messages Retrieval'
    );

    const messagesData = await messagesResponse.json();
    
    if (!messagesData.data || !messagesData.data.length) {
      logError('NO_MESSAGES', new Error('No messages returned from thread'));
      throw new Error('No response messages found');
    }
    
    const responseMessage = messagesData.data[0];
    if (!responseMessage.content || !responseMessage.content.length) {
      logError('EMPTY_MESSAGE_CONTENT', new Error('Message has no content'));
      throw new Error('Response message is empty');
    }
    
    const responseContent = responseMessage.content[0].text?.value;
    if (!responseContent) {
      logError('NO_TEXT_CONTENT', new Error('Message content has no text value'));
      throw new Error('Response content is not text');
    }

    logSuccess('RESPONSE_RETRIEVED', { 
      messageCount: messagesData.data.length,
      contentLength: responseContent.length,
      contentPreview: responseContent.substring(0, 200)
    });

    // Phase 10: Enhanced JSON Processing
    logStep('JSON_PROCESSING_START');
    
    let extractedItems;
    
    // Enhanced JSON cleaning function
    function cleanJsonResponse(content: string): string {
      logStep('JSON_CLEANING_START', { originalLength: content.length });
      
      // Remove markdown code blocks
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Remove any leading/trailing whitespace
      content = content.trim();
      
      // Fix common JSON issues
      content = content.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      
      // Fix truncated strings and URLs
      content = content.replace(/"https?:[^"]*$/gm, '"unspecified"');
      content = content.replace(/"[^"]*$/gm, '"unspecified"');
      
      // Fix missing quotes on property names
      content = content.replace(/(\w+):/g, '"$1":');
      
      // Fix trailing commas
      content = content.replace(/,(\s*[}\]])/g, '$1');
      
      logStep('JSON_CLEANING_COMPLETE', { cleanedLength: content.length });
      return content;
    }
    
    // Enhanced JSON extraction with multiple strategies
    function extractJsonFromResponse(content: string): any {
      logStep('JSON_EXTRACTION_START');
      
      const strategies = [
        // Strategy 1: Direct parse
        () => {
          logStep('JSON_STRATEGY_1', 'Direct parse');
          return JSON.parse(content);
        },
        
        // Strategy 2: Extract JSON object with items
        () => {
          logStep('JSON_STRATEGY_2', 'Extract JSON object with items');
          const match = content.match(/\{[\s\S]*?"items"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
          if (!match) throw new Error('No JSON object with items found');
          return JSON.parse(match[0]);
        },
        
        // Strategy 3: Extract items array only
        () => {
          logStep('JSON_STRATEGY_3', 'Extract items array only');
          const match = content.match(/"items"\s*:\s*(\[[\s\S]*?\])/);
          if (!match) throw new Error('No items array found');
          return { items: JSON.parse(match[1]) };
        },
        
        // Strategy 4: Find any JSON array
        () => {
          logStep('JSON_STRATEGY_4', 'Find any JSON array');
          const match = content.match(/\[[\s\S]*?\]/);
          if (!match) throw new Error('No JSON array found');
          const array = JSON.parse(match[0]);
          return { items: array };
        }
      ];
      
      for (let i = 0; i < strategies.length; i++) {
        try {
          const result = strategies[i]();
          logSuccess(`JSON_STRATEGY_${i + 1}_SUCCESS`);
          return result;
        } catch (error) {
          logWarning(`JSON_STRATEGY_${i + 1}_FAILED`, error.message);
        }
      }
      
      throw new Error('All JSON extraction strategies failed');
    }
    
    try {
      logStep('JSON_PARSE_START', {
        contentLength: responseContent.length,
        startsWithBrace: responseContent.trim().startsWith('{'),
        endsWithBrace: responseContent.trim().endsWith('}'),
        containsItems: responseContent.includes('"items"'),
        containsArray: responseContent.includes('[')
      });
      
      const cleanedContent = cleanJsonResponse(responseContent);
      logStep('JSON_CLEANED', {
        originalLength: responseContent.length,
        cleanedLength: cleanedContent.length
      });
      
      const parsedResult = extractJsonFromResponse(cleanedContent);
      
      // Validate the parsed result
      if (!parsedResult) {
        throw new Error('Parsed result is null or undefined');
      }
      
      if (parsedResult.items && Array.isArray(parsedResult.items)) {
        extractedItems = parsedResult.items;
      } else if (Array.isArray(parsedResult)) {
        extractedItems = parsedResult;
      } else {
        throw new Error('Parsed result does not contain valid items array');
      }
      
      logSuccess('JSON_PARSE_SUCCESS', { itemCount: extractedItems.length });
      
    } catch (parseError) {
      logError('JSON_PARSE_FAILED', parseError, {
        contentSample: responseContent.substring(0, 500),
        contentEnd: responseContent.substring(responseContent.length - 200)
      });
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    // Phase 11: Data Validation and Database Insertion
    logStep('DATA_VALIDATION_START');
    
    if (!extractedItems || extractedItems.length === 0) {
      logWarning('NO_ITEMS_EXTRACTED', 'No checklist items were extracted');
      throw new Error('No checklist items were extracted from the documents');
    }
    
    // Validate and clean each item
    const validatedItems = extractedItems.map((item: any, index: number) => {
      logStep(`ITEM_VALIDATION_${index + 1}`, { item: JSON.stringify(item).substring(0, 100) });
      
      const validatedItem = {
        user_id: userId,
        sheet_name: item.sheet_name || 'unspecified',
        issue_to_check: item.issue_to_check || item.issue || 'No issue specified',
        location: item.location || 'unspecified',
        type_of_issue: item.type_of_issue || 'unspecified',
        code_source: item.code_source || 'unspecified',
        code_identifier: item.code_identifier || 'unspecified',
        short_code_requirement: item.short_code_requirement || 'unspecified',
        long_code_requirement: item.long_code_requirement || 'unspecified',
        source_link: item.source_link || 'unspecified',
        project_type: item.project_type || 'unspecified',
        city: item.city || 'unspecified',
        zip_code: item.zip_code || 'unspecified',
        reviewer_name: item.reviewer_name || 'unspecified',
        type_of_correction: item.type_of_correction || 'unspecified',
        zone_primary: item.zone_primary || 'unspecified',
        occupancy_group: item.occupancy_group || 'unspecified',
        natural_hazard_zone: item.natural_hazard_zone || 'unspecified',
      };
      
      // Ensure required fields are not empty
      if (!validatedItem.issue_to_check || validatedItem.issue_to_check === 'unspecified') {
        logWarning(`ITEM_${index + 1}_MISSING_ISSUE`, 'Item missing required issue description');
        validatedItem.issue_to_check = `Checklist item ${index + 1} - description not provided`;
      }
      
      return validatedItem;
    });
    
    logSuccess('DATA_VALIDATION', { validatedCount: validatedItems.length });
    
    // Database insertion with transaction
    logStep('DATABASE_INSERT_START');
    
    try {
      const { data: insertedData, error: insertError } = await withTimeout(
        supabase
          .from('checklist_items')
          .insert(validatedItems)
          .select(),
        30000,
        'Database Insertion'
      );
      
      if (insertError) {
        logError('DATABASE_INSERT_ERROR', insertError);
        throw new Error(`Database insertion failed: ${insertError.message}`);
      }
      
      logSuccess('DATABASE_INSERT', { insertedCount: insertedData?.length || 0 });
      
      // Final success response
      const executionTime = Date.now() - startTime;
      logSuccess('FUNCTION_COMPLETE', {
        executionTimeMs: executionTime,
        itemsProcessed: extractedItems.length,
        itemsInserted: insertedData?.length || 0,
        filesProcessed: files.length
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully extracted ${extractedItems.length} checklist items from ${files.length} files`,
          data: {
            extractedItems: extractedItems.length,
            insertedItems: insertedData?.length || 0,
            executionTimeMs: executionTime,
            items: insertedData
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
      
    } catch (dbError) {
      logError('DATABASE_OPERATION_FAILED', dbError);
      throw dbError;
    }

  } catch (error) {
    logError('FUNCTION_ERROR', error, { 
      userId, 
      uploadedFiles: uploadedFiles.length,
      vectorStoreId,
      assistantId,
      executionTimeMs: Date.now() - startTime
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: {
          userId,
          filesUploaded: uploadedFiles.length,
          vectorStoreCreated: !!vectorStoreId,
          assistantCreated: !!assistantId,
          executionTimeMs: Date.now() - startTime
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } finally {
    // Enhanced cleanup with error handling
    logStep('CLEANUP_START');
    
    const cleanupTasks = [];
    
    // Clean up assistant
    if (assistantId) {
      cleanupTasks.push(
        apiCallWithRetry(
          `https://api.openai.com/v1/assistants/${assistantId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'OpenAI-Beta': 'assistants=v2',
            },
          },
          'Assistant Cleanup',
          1 // Only 1 retry for cleanup
        ).catch(error => logWarning('ASSISTANT_CLEANUP_FAILED', error.message))
      );
    }
    
    // Clean up vector store
    if (vectorStoreId) {
      cleanupTasks.push(
        apiCallWithRetry(
          `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'OpenAI-Beta': 'assistants=v2',
            },
          },
          'Vector Store Cleanup',
          1
        ).catch(error => logWarning('VECTOR_STORE_CLEANUP_FAILED', error.message))
      );
    }
    
    // Clean up uploaded files
    for (const fileId of uploadedFiles) {
      cleanupTasks.push(
        apiCallWithRetry(
          `https://api.openai.com/v1/files/${fileId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
            },
          },
          `File Cleanup: ${fileId}`,
          1
        ).catch(error => logWarning('FILE_CLEANUP_FAILED', error.message, { fileId }))
      );
    }
    
    // Execute all cleanup tasks in parallel with timeout
    try {
      await withTimeout(
        Promise.allSettled(cleanupTasks),
        30000,
        'Resource Cleanup'
      );
      logSuccess('CLEANUP_COMPLETE');
    } catch (cleanupError) {
      logWarning('CLEANUP_TIMEOUT', 'Some cleanup tasks may not have completed', { error: cleanupError.message });
    }
  }
});