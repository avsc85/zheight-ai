import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert PDF file to base64 data URL
async function pdfToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  return `data:application/pdf;base64,${base64}`;
}

// Extract city from PDF first page using Lovable AI
async function extractCityFromPDF(pdfBase64: string, lovableApiKey: string): Promise<string | null> {
  console.log('Extracting city from PDF...');
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the project city name from this architectural plan. Look for the title block, project information section, or address field on the first page. Return ONLY the city name in a standardized format (e.g., "San Mateo", "Sunnyvale"). If you cannot find a city, respond with "UNKNOWN".'
              },
              {
                type: 'image_url',
                image_url: {
                  url: pdfBase64
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('City extraction API error:', response.status);
      return null;
    }

    const data = await response.json();
    const cityText = data.choices?.[0]?.message?.content?.trim() || null;
    
    if (cityText && cityText !== 'UNKNOWN') {
      console.log('Extracted city:', cityText);
      return cityText;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting city:', error);
    return null;
  }
}

// Analyze plan against checklist items using Lovable AI
async function analyzePlanCompliance(
  pdfBase64: string,
  checklistItems: any[],
  lovableApiKey: string
): Promise<any[]> {
  console.log(`Starting AI analysis for ${checklistItems.length} checklist items...`);
  
  const issues: any[] = [];
  
  // Process items in batches of 3 to avoid token limits
  const batchSize = 3;
  for (let i = 0; i < checklistItems.length; i += batchSize) {
    const batch = checklistItems.slice(i, i + batchSize);
    console.log(`Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(checklistItems.length / batchSize)}`);
    
    for (const item of batch) {
      try {
        const analysisPrompt = `You are an expert architectural plan reviewer analyzing residential building plans for code compliance.

CHECKLIST ITEM TO VERIFY:
- Issue: ${item.issue_to_check}
- Code Reference: ${item.code_identifier || 'General'}
- Requirement: ${item.short_code_requirement || 'See long requirement'}
- Full Requirement: ${item.long_code_requirement || 'Standard compliance required'}
- Expected Location: ${item.location || 'Various locations'}
- Sheet: ${item.sheet_name || 'Any sheet'}

ANALYSIS INSTRUCTIONS:
1. Carefully examine the uploaded architectural plan
2. Look for the specified issue in the indicated location and sheet
3. Determine if the requirement is met, missing, non-compliant, or inconsistent
4. If an issue is found, provide specific details

Return your analysis in this exact JSON format:
{
  "has_issue": true/false,
  "issue_type": "Missing" | "Non-compliant" | "Inconsistent",
  "plan_sheet_name": "sheet name where issue found",
  "issue_description": "detailed description of the issue",
  "location_in_sheet": "specific location within the sheet",
  "confidence_level": "High" | "Medium" | "Low",
  "confidence_rationale": "explanation for your confidence level"
}

If no issue is found, set has_issue to false and provide brief rationale.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: analysisPrompt
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: pdfBase64
                    }
                  }
                ]
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'report_compliance_issue',
                description: 'Report a compliance issue found in the architectural plan',
                parameters: {
                  type: 'object',
                  properties: {
                    has_issue: { type: 'boolean' },
                    issue_type: { 
                      type: 'string',
                      enum: ['Missing', 'Non-compliant', 'Inconsistent']
                    },
                    plan_sheet_name: { type: 'string' },
                    issue_description: { type: 'string' },
                    location_in_sheet: { type: 'string' },
                    confidence_level: { 
                      type: 'string',
                      enum: ['High', 'Medium', 'Low']
                    },
                    confidence_rationale: { type: 'string' }
                  },
                  required: ['has_issue']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'report_compliance_issue' } }
          })
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.warn('Rate limit hit, waiting before retry...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          console.error('AI analysis API error:', response.status);
          continue;
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall?.function?.arguments) {
          const aiResult = JSON.parse(toolCall.function.arguments);
          
          if (aiResult.has_issue) {
            issues.push({
              checklist_item_id: item.id,
              plan_sheet_name: aiResult.plan_sheet_name || item.sheet_name || 'Unknown',
              issue_description: aiResult.issue_description || item.issue_to_check,
              location_in_sheet: aiResult.location_in_sheet || item.location || 'See plan',
              issue_type: aiResult.issue_type || 'Non-compliant',
              compliance_source: item.code_source === 'California Residential Code' ? 'California Code' : 'Local',
              specific_code_identifier: item.code_identifier || 'General',
              short_code_requirement: item.short_code_requirement || 'See full requirement',
              long_code_requirement: item.long_code_requirement || 'Compliance required',
              source_link: item.source_link || '',
              confidence_level: aiResult.confidence_level || 'Medium',
              confidence_rationale: aiResult.confidence_rationale || 'AI analysis completed'
            });
          }
        }
      } catch (error) {
        console.error('Error analyzing item:', error);
      }
    }
  }
  
  return issues;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting AI-Powered Plan Checker');
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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

    // Extract uploaded files
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      throw new Error('No files provided');
    }

    console.log(`Processing ${files.length} plan file(s)`);

    // Generate analysis session ID
    const analysisSessionId = crypto.randomUUID();

    // Step 1: Extract city from first PDF
    const firstFile = files[0];
    const pdfBase64 = await pdfToBase64(firstFile);
    const extractedCity = await extractCityFromPDF(pdfBase64, lovableApiKey);
    
    console.log('City detection result:', extractedCity || 'Not detected');

    // Step 2: Query checklist items based on city
    let checklistQuery = supabase
      .from('checklist_items')
      .select('*')
      .eq('user_id', user.id);

    if (extractedCity) {
      checklistQuery = checklistQuery.eq('city', extractedCity);
    }

    const { data: checklistItems, error: checklistError } = await checklistQuery;

    if (checklistError) {
      console.error('Error fetching checklist items:', checklistError);
      throw new Error('Failed to load checklist items');
    }

    if (!checklistItems || checklistItems.length === 0) {
      console.log('No checklist items found for city, using general items');
      // Fallback: get general items without city filter
      const { data: generalItems } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('user_id', user.id)
        .limit(15);
      
      if (!generalItems || generalItems.length === 0) {
        throw new Error('No checklist items available for analysis');
      }
      
      checklistItems.push(...generalItems);
    }

    // Randomly select 10-20 items
    const numItems = Math.floor(Math.random() * 11) + 10; // 10-20
    const selectedItems = checklistItems
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(numItems, checklistItems.length));

    console.log(`Selected ${selectedItems.length} checklist items for analysis`);

    // Step 3: AI-powered compliance analysis
    const detectedIssues = await analyzePlanCompliance(pdfBase64, selectedItems, lovableApiKey);

    console.log(`AI analysis complete. Found ${detectedIssues.length} issues`);

    // Step 4: Save issues to database
    const issuesToSave = detectedIssues.map(issue => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      analysis_session_id: analysisSessionId,
      ...issue,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    if (issuesToSave.length > 0) {
      const { error: insertError } = await supabase
        .from('architectural_issue_reports')
        .insert(issuesToSave);

      if (insertError) {
        console.error('Error saving issues:', insertError);
        // Continue anyway, we can still return the results
      } else {
        console.log(`Saved ${issuesToSave.length} issues to database`);
      }
    }

    // Prepare summary
    const highConfCount = detectedIssues.filter(i => i.confidence_level === 'High').length;
    const medConfCount = detectedIssues.filter(i => i.confidence_level === 'Medium').length;
    const lowConfCount = detectedIssues.filter(i => i.confidence_level === 'Low').length;

    // Return structured response
    return new Response(JSON.stringify({
      success: true,
      data: {
        analysis_session_id: analysisSessionId,
        city_detected: extractedCity || 'Not detected',
        checklist_items_analyzed: selectedItems.length,
        issues: detectedIssues,
        analysis_summary: {
          total_checked: selectedItems.length,
          issues_found: detectedIssues.length,
          high_confidence: highConfCount,
          medium_confidence: medConfCount,
          low_confidence: lowConfCount
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Analysis failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});