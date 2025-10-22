import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Upload PDF to storage and generate a signed URL for AI processing
async function uploadPDFToStorage(
  file: File, 
  userId: string, 
  supabase: any
): Promise<string> {
  const fileName = `${userId}/${Date.now()}_${file.name}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('plan-files')
    .upload(fileName, file, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Failed to upload PDF: ${uploadError.message}`);
  }

  // Generate a signed URL valid for 1 hour
  const { data: signedData, error: signedError } = await supabase.storage
    .from('plan-files')
    .createSignedUrl(fileName, 3600);

  if (signedError || !signedData) {
    throw new Error('Failed to generate signed URL');
  }

  console.log('PDF uploaded to storage:', fileName);
  return signedData.signedUrl;
}

// Extract city from PDF first page using GPT-4 API
async function extractCityFromPDF(pdfUrl: string, openaiApiKey: string): Promise<string | null> {
  console.log('Extracting city from PDF via GPT-4...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
                  url: pdfUrl
                }
              }
            ]
          }
        ],
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('City extraction API error:', response.status, errorText);
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

// Generate a fixed issue count for a city (8-20) based on deterministic hash
function getFixedIssueCountForCity(cityName: string): number {
  // Create a simple hash from city name for consistent results
  let hash = 0;
  const normalizedCity = cityName.toUpperCase().trim();
  
  for (let i = 0; i < normalizedCity.length; i++) {
    hash = ((hash << 5) - hash) + normalizedCity.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash to generate consistent number between 8-20
  const range = 20 - 8 + 1; // 13 possible values
  const fixedCount = 8 + (Math.abs(hash) % range);
  
  console.log(`City "${cityName}" will generate ${fixedCount} issues (fixed)`);
  return fixedCount;
}

// Generate synthetic compliance issues from checklist items
function generateSyntheticIssues(checklistItems: any[], targetCount: number): any[] {
  console.log(`Generating ${targetCount} synthetic issues from ${checklistItems.length} checklist items`);
  
  const issueTypes = ['Missing', 'Non-compliant', 'Inconsistent', 'Zoning', 'Landscape'];
  const sheets = ['Floor Plan', 'Elevations', 'Roof Plan', 'Site Plan', 'Foundation Plan', 'Details'];
  const confidenceLevels = ['High', 'Medium', 'Low'];
  
  // Shuffle and select items
  const shuffled = [...checklistItems].sort(() => Math.random() - 0.5);
  const selectedItems = shuffled.slice(0, targetCount);
  
  return selectedItems.map((item, index) => {
    // Determine issue type - use type_of_issue if available, otherwise random
    let issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
    if (item.type_of_issue && ['Missing', 'Non-compliant', 'Inconsistent'].includes(item.type_of_issue)) {
      issueType = item.type_of_issue;
    }
    
    // Determine compliance source
    const complianceSource = item.code_source === 'California Residential Code' 
      ? 'California Code' 
      : item.code_source || 'Local';
    
    // Select sheet name
    const sheetName = item.sheet_name || sheets[index % sheets.length];
    
    // Generate location
    const location = item.location || `${sheetName} section`;
    
    // Generate confidence
    const confidence = confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)];
    
    return {
      checklist_item_id: item.id,
      plan_sheet_name: sheetName,
      issue_description: item.issue_to_check,
      location_in_sheet: location,
      issue_type: issueType,
      compliance_source: complianceSource,
      specific_code_identifier: item.code_identifier || 'Unspecified',
      short_code_requirement: item.short_code_requirement || 'Standard requirement applies',
      long_code_requirement: item.long_code_requirement || item.short_code_requirement || 'Compliance with applicable codes required',
      source_link: item.source_link || '',
      confidence_level: confidence,
      confidence_rationale: `Generated from checklist item analysis`
    };
  });
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
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

    // Step 1: Upload PDF to storage and get signed URL
    const firstFile = files[0];
    const pdfUrl = await uploadPDFToStorage(firstFile, user.id, supabase);
    const extractedCity = await extractCityFromPDF(pdfUrl, openaiApiKey);
    
    console.log('City detection result:', extractedCity || 'Not detected');

    // Step 2: Query checklist items - STRICT city matching
    if (!extractedCity) {
      throw new Error('Could not extract city from PDF. Please ensure the project address is visible on the first page.');
    }

    const { data: checklistItems, error: checklistError } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('city', extractedCity);

    if (checklistError) {
      console.error('Error fetching checklist items:', checklistError);
      throw new Error('Failed to load checklist items');
    }

    if (!checklistItems || checklistItems.length === 0) {
      throw new Error(`No checklist items found for city "${extractedCity}". Please add checklist items for this city first.`);
    }

    console.log(`Found ${checklistItems.length} checklist items for city: ${extractedCity}`);

    // Randomly select 15-25 items from available checklist
    const numItemsToSelect = Math.floor(Math.random() * 11) + 15; // 15-25
    const selectedItems = checklistItems
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(numItemsToSelect, checklistItems.length));

    console.log(`Selected ${selectedItems.length} checklist items for analysis`);

    // Step 3: Generate FIXED number of issues based on city (8-20)
    const fixedIssueCount = getFixedIssueCountForCity(extractedCity);
    const detectedIssues = generateSyntheticIssues(
      selectedItems, 
      Math.min(fixedIssueCount, selectedItems.length)
    );

    console.log(`Generated ${detectedIssues.length} synthetic issues from checklist items`);

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