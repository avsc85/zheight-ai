import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    console.log('Starting Agent 2 Plan Checker process');
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found');
    }

    console.log('Environment variables loaded successfully');

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    const formData = await req.formData();
    const files: File[] = [];
    const customPrompt = formData.get('prompt') as string || '';

    // Extract uploaded files
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      throw new Error('No files provided');
    }

    console.log(`Processing ${files.length} plan files`);

    // Fetch checklist items from database for this user
    const { data: checklistItems, error: checklistError } = await supabase
      .from('checklist_items')
      .select('id, sheet_name, issue_to_check, type_of_issue, code_source, code_identifier, short_code_requirement, long_code_requirement, source_link, project_type')
      .eq('user_id', user.id);

    if (checklistError) {
      console.error('Error fetching checklist items:', checklistError);
      throw new Error('Failed to fetch checklist items');
    }

    console.log(`Found ${checklistItems?.length || 0} checklist items`);

    // Normalize sheet hints before sending to LLM
    const normalizeSheetName = (sheetName: string): string[] => {
      const normalizedName = sheetName?.toLowerCase() || '';
      
      // Map common sheet names to likely candidates
      if (normalizedName.includes('electrical') || normalizedName.includes('elec')) {
        return ["A-6.0", "MEP", "ELECTRICAL", "ELEC"];
      }
      if (normalizedName.includes('site') && normalizedName.includes('plan')) {
        return ["A-1.1", "PROPOSED SITE", "SITE PLAN"];
      }
      if (normalizedName.includes('title') || normalizedName.includes('cover')) {
        return ["A-0.0", "TITLE", "COVER", "COVER SHEET"];
      }
      if (normalizedName.includes('floor plan') || normalizedName.includes('interior')) {
        return ["A-2.1", "A-2.0", "FIRST FLOOR PLAN", "FLOOR PLAN"];
      }
      if (normalizedName.includes('a3.1') || normalizedName.includes('second floor')) {
        return ["A-3.0", "SECOND FLOOR PLAN", "A-3.1"];
      }
      if (normalizedName.includes('foundation')) {
        return ["A-1.0", "FOUNDATION PLAN", "FOUNDATION"];
      }
      if (normalizedName.includes('roof')) {
        return ["A-4.0", "ROOF PLAN", "ROOF"];
      }
      if (normalizedName.includes('section') || normalizedName.includes('detail')) {
        return ["A-5.0", "SECTIONS", "DETAILS", "SECTION"];
      }
      if (normalizedName.includes('elevation')) {
        return ["A-3.0", "ELEVATIONS", "ELEVATION"];
      }
      
      // If no specific mapping, return the original name as candidate
      return [sheetName || ""];
    };

    // Add sheet label candidates to checklist items
    const enhancedChecklistItems = checklistItems?.map(item => ({
      ...item,
      sheet_label_candidates: normalizeSheetName(item.sheet_name)
    })) || [];

    // Get the plan checker prompt from database
    const { data: promptData } = await supabase
      .from('agent_prompts')
      .select('prompt')
      .eq('name', 'default_plan_checker')
      .single();

    const systemPrompt = promptData?.prompt || customPrompt || `You are Architectural Compliance Checker for single-family residential plan sets.
Your job is to read plan PDFs and compare them row-by-row against a compliance checklist (from a Supabase table called checklist_items). For each checklist row:
• Use the provided sheet_label_candidates array to find the best matching sheet in the plan. These candidates represent common variations of sheet names/labels that might appear in the PDF (e.g., "A-6.0", "MEP", "ELECTRICAL" for electrical plans).
• Search that sheet for the issue_to_check using both text and visual cues (callouts, tags, symbols, schedules, legends).
• Decide whether the requirement is present, missing, non-compliant, or inconsistent across sheets (cross-ref as relevant—e.g., a note on A-sheet vs detail on S-sheet).
• If you find an issue, output one JSON object per issue using the schema provided. If no issue is found for that row, output nothing for that row (do not emit "null" objects).

Use only these checklist fields below from the data Table checklist_items in Supabase (ignore others):
• sheet_name (original CSV sheet name for reference)
• sheet_label_candidates (normalized array of likely sheet labels to look for in the PDF)
• issue_to_check (what to verify)
• type_of_issue (mechanical / fire / etc., helps you reason about where details usually live)
• code_source (California vs Local)
• code_identifier (e.g., CRC R703.2)
• short_code_requirement (1-line interpretation for single-family)
• long_code_requirement (detailed interpretation for single-family)
• source_link (URL)
• project_type (e.g., "Single Family Residence", ADU, Addition/Remodel; use to ensure applicability)

Output rules (STRICT)
• Only return JSON that conforms to the Issue Report JSON Schema below.
• One object per issue found. If no issue for a row, return nothing for that row.
• Do not invent code identifiers or links; only use what's provided in the row.
• If you must choose California vs Local, use the row's code_source.
• When reporting plan_sheet_name, use the exact sheet label found in the PDF (e.g., "A2.1 – Floor Plan") that best matches one of the sheet_label_candidates.
• Use a short, human-readable location_in_sheet (e.g., "Kitchen range wall, upper right quadrant", "General Notes column B", "Detail 5/A4.2 callout").
• issue_type must be one of: Missing, Non-compliant, Inconsistent.
• confidence_level must be one of: High, Medium, Low.
• confidence_rationale should explain visibility/clarity, sheet match quality, and any cross-reference you used.

Confidence rubric
• High: Found matching sheet from candidates; requirement clearly absent or clearly violated; unambiguous notes/details.
• Medium: Partial sheet match from candidates; requirement inferred from partial notes/symbols; mild ambiguity.
• Low: Weak sheet match from candidates; blurry/obscured content; conflicting details with no clear resolution.
If you are unsure, lower confidence and explain why.`;

    // Upload files to OpenAI
    const uploadedFiles: string[] = [];
    
    for (const file of files) {
      console.log(`Uploading file: ${file.name}`);
      
      const fileFormData = new FormData();
      fileFormData.append('file', file);
      fileFormData.append('purpose', 'assistants');

      const uploadResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: fileFormData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        console.error('File upload failed:', errorData);
        throw new Error(`Failed to upload file: ${file.name}`);
      }

      const uploadData = await uploadResponse.json();
      uploadedFiles.push(uploadData.id);
      console.log(`File uploaded successfully: ${uploadData.id}`);
    }

    // Create vector store for the files
    console.log('Creating vector store');
    const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `plan-analysis-${Date.now()}`,
        file_ids: uploadedFiles,
      }),
    });

    if (!vectorStoreResponse.ok) {
      const errorData = await vectorStoreResponse.text();
      console.error('Vector store creation failed:', errorData);
      throw new Error('Failed to create vector store');
    }

    const vectorStoreData = await vectorStoreResponse.json();
    console.log('Vector store created:', vectorStoreData.id);

    // Create OpenAI Assistant for plan checking
    console.log('Creating OpenAI assistant');
    const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name: 'Plan Checker Agent',
        instructions: systemPrompt,
        model: 'gpt-4o',
        tools: [{ type: 'file_search' }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreData.id],
          },
        },
      }),
    });

    if (!assistantResponse.ok) {
      const errorData = await assistantResponse.text();
      console.error('Assistant creation failed:', errorData);
      throw new Error('Failed to create assistant');
    }

    const assistantData = await assistantResponse.json();
    console.log('Assistant created:', assistantData.id);

    // Create a thread
    console.log('Creating thread');
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
      const errorData = await threadResponse.text();
      console.error('Thread creation failed:', errorData);
      throw new Error('Failed to create thread');
    }

    const threadData = await threadResponse.json();
    console.log('Thread created:', threadData.id);

    // Add user message with checklist items context
    const userMessage = `Please analyze the uploaded architectural plans against the following checklist items and identify compliance issues:

CHECKLIST ITEMS:
${JSON.stringify(enhancedChecklistItems, null, 2)}

Please return your findings in the following JSON schema format. Return an array of issue objects, where each object represents a single compliance issue found:

[
  {
    "checklist_item_id": "string (ID from checklist_items that this issue relates to)",
    "plan_sheet_name": "string (exact sheet name from PDF where issue was found)",
    "issue_description": "string (concise description of what is wrong or missing)",
    "location_in_sheet": "string (plain-language locator within the sheet)",
    "issue_type": "Missing | Non-compliant | Inconsistent",
    "compliance_source": "California Code | Local",
    "specific_code_identifier": "string (exact code ref from checklist item)",
    "short_code_requirement": "string (1-line requirement summary from checklist item)",
    "long_code_requirement": "string (detailed requirement from checklist item)",
    "source_link": "string (URL from checklist item)",
    "confidence_level": "High | Medium | Low",
    "confidence_rationale": "string (why you chose this confidence level)"
  }
]

IMPORTANT: Only return issues that are actually found. Do not create null or empty objects for compliant items. Return an empty array [] if no issues are found.`;

    console.log('Adding message to thread');
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        role: 'user',
        content: userMessage,
      }),
    });

    if (!messageResponse.ok) {
      const errorData = await messageResponse.text();
      console.error('Message creation failed:', errorData);
      throw new Error('Failed to add message');
    }

    // Run the assistant
    console.log('Running assistant');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: assistantData.id,
      }),
    });

    if (!runResponse.ok) {
      const errorData = await runResponse.text();
      console.error('Run creation failed:', errorData);
      throw new Error('Failed to run assistant');
    }

    const runData = await runResponse.json();
    console.log('Run started:', runData.id);

    // Poll for completion
    let runStatus = runData.status;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (runStatus === 'queued' || runStatus === 'in_progress') {
      if (attempts >= maxAttempts) {
        throw new Error('Assistant run timed out');
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/runs/${runData.id}`, {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });

      if (!statusResponse.ok) {
        throw new Error('Failed to check run status');
      }

      const statusData = await statusResponse.json();
      runStatus = statusData.status;
      console.log(`Run status: ${runStatus} (attempt ${attempts})`);
    }

    if (runStatus !== 'completed') {
      throw new Error(`Assistant run failed with status: ${runStatus}`);
    }

    // Get the assistant's response
    console.log('Retrieving assistant response');
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/messages`, {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse.text();
      console.error('Failed to retrieve messages:', errorData);
      throw new Error('Failed to retrieve messages');
    }

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data.find(msg => msg.role === 'assistant');

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error('No response from assistant');
    }

    const responseText = assistantMessage.content[0].text.value;
    console.log('Assistant response received');

    // Clean up OpenAI resources
    console.log('Cleaning up resources');
    try {
      // Delete assistant
      await fetch(`https://api.openai.com/v1/assistants/${assistantData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });

      // Delete vector store
      await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });

      // Delete uploaded files
      for (const fileId of uploadedFiles) {
        await fetch(`https://api.openai.com/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
          },
        });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
      // Don't throw here as the main operation was successful
    }

    // Parse the JSON response
    let analysisResult;
    let savedIssues = [];
    
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/) || responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      
      // Parse as array directly or extract from object
      let issues = [];
      const parsed = JSON.parse(jsonText);
      
      if (Array.isArray(parsed)) {
        issues = parsed;
      } else if (parsed.issues && Array.isArray(parsed.issues)) {
        issues = parsed.issues;
      } else {
        issues = [];
      }
      
      // Generate a unique analysis session ID for this batch of issues
      const analysisSessionId = crypto.randomUUID();
      
      // Save each issue to the database
      for (const issue of issues) {
        const { data: savedIssue, error: saveError } = await supabase
          .from('architectural_issue_reports')
          .insert({
            user_id: user.id,
            checklist_item_id: issue.checklist_item_id,
            analysis_session_id: analysisSessionId,
            plan_sheet_name: issue.plan_sheet_name,
            issue_description: issue.issue_description,
            location_in_sheet: issue.location_in_sheet,
            issue_type: issue.issue_type,
            compliance_source: issue.compliance_source,
            specific_code_identifier: issue.specific_code_identifier,
            short_code_requirement: issue.short_code_requirement,
            long_code_requirement: issue.long_code_requirement,
            source_link: issue.source_link,
            confidence_level: issue.confidence_level,
            confidence_rationale: issue.confidence_rationale
          })
          .select()
          .single();
          
        if (saveError) {
          console.error('Error saving issue to database:', saveError);
        } else {
          savedIssues.push(savedIssue);
        }
      }
      
      analysisResult = {
        issues: savedIssues,
        analysis_session_id: analysisSessionId,
        total_issues_found: savedIssues.length
      };
      
    } catch (parseError) {
      console.error('Failed to parse assistant response as JSON:', parseError);
      // Return the raw response if JSON parsing fails
      analysisResult = { 
        raw_response: responseText, 
        issues: [],
        error: 'Failed to parse LLM response as JSON'
      };
    }

    console.log('Plan analysis completed successfully');

    return new Response(JSON.stringify({
      success: true,
      data: analysisResult,
      message: 'Plan analysis completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in plan checker:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Plan analysis failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});