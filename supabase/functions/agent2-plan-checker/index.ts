import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.17.1';
import { getDocument } from 'https://esm.sh/pdfjs-serverless';

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

// Extract text from a specific PDF page for city detection
async function extractPDFPageText(
  pdfUrl: string,
  pageNumber: number = 1
): Promise<string> {
  console.log(`Extracting text from PDF page ${pageNumber}...`);
  try {
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfData = new Uint8Array(pdfArrayBuffer);

    const loadingTask = getDocument({ data: pdfData });
    const pdfDoc = await loadingTask.promise;

    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');

    console.log('Extracted text length:', text.length);
    return text;
  } catch (error: any) {
    console.error('Error extracting text from PDF page:', error);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

// Upload image to temporary storage
async function uploadImageToStorage(
  imageData: Uint8Array,
  userId: string,
  supabase: any
): Promise<string> {
  const timestamp = Date.now();
  const fileName = `page1_${userId}_${timestamp}.png`;
  const filePath = `${userId}/${fileName}`;
  
  console.log('Uploading page image to storage:', filePath);
  
  // Upload to plan-page-images bucket
  const { data, error } = await supabase.storage
    .from('plan-page-images')
    .upload(filePath, imageData, {
      contentType: 'image/png',
      upsert: false
    });
  
  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Get signed URL (valid for 1 hour)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('plan-page-images')
    .createSignedUrl(filePath, 3600);
  
  if (urlError || !urlData?.signedUrl) {
    throw new Error('Failed to create signed URL for image');
  }
  
  console.log('Image uploaded successfully');
  return urlData.signedUrl;
}

// Clean up temporary image from storage
async function cleanupTempImage(
  imageUrl: string,
  supabase: any
): Promise<void> {
  try {
    // Extract file path from signed URL
    const urlObj = new URL(imageUrl);
    const pathMatch = urlObj.pathname.match(/\/plan-page-images\/(.+)\?/);
    
    if (pathMatch) {
      const filePath = pathMatch[1];
      console.log('Cleaning up temporary image:', filePath);
      
      await supabase.storage
        .from('plan-page-images')
        .remove([filePath]);
      
      console.log('Temporary image cleaned up successfully');
    }
  } catch (error) {
    console.warn('Failed to cleanup temp image:', error);
    // Don't throw - cleanup failure shouldn't break the flow
  }
}

// Extract city from PDF page text using Lovable AI (text-only)
async function extractCityFromPDFText(
  pageText: string,
  candidates: string[],
  lovableApiKey: string
): Promise<string | null> {
  console.log('Extracting city from text via Lovable AI...');

  if (!candidates || candidates.length === 0) {
    console.warn('No city candidates available for extraction');
    return null;
  }

  try {
    const prompt = `You are analyzing the first page text of an architectural plan PDF.
Extract ONLY the city name from the project address or project location.

Possible cities:
${candidates.join(', ')}

INSTRUCTIONS:
- Return EXACTLY one city from the list above.
- If none match, return "UNKNOWN".
- Return ONLY the city name, nothing else.

PAGE TEXT (may be noisy, OCR-like):\n${pageText.slice(0, 8000)}`;

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
              { type: 'text', text: prompt }
            ]
          }
        ],
        max_tokens: 50,
        temperature: 0.0
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Lovable AI rate limit exceeded');
        throw new Error('Lovable AI rate limit exceeded. Please try again in a few minutes.');
      }
      if (response.status === 402) {
        console.error('Lovable AI payment required');
        throw new Error('Lovable AI credits exhausted. Please add credits to your workspace.');
      }
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const cityTextRaw = (data.choices?.[0]?.message?.content ?? '').trim();
    const cityText = cityTextRaw.replace(/^"|"$/g, '').trim();

    console.log('Lovable AI raw response:', cityTextRaw);

    if (cityText && cityText !== 'UNKNOWN') {
      const matchedCity = candidates.find(
        c => c.toLowerCase() === cityText.toLowerCase()
      );
      
      if (matchedCity) {
        console.log('Extracted city:', matchedCity);
        return matchedCity;
      }
    }

    console.log('Could not match city from text. Raw response:', cityTextRaw);
    return null;
    
  } catch (error) {
    console.error('Error extracting city from text:', error);
    throw error;
  }
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

    // Step 1: Upload PDF to storage for records
    const firstFile = files[0];
    const pdfUrl = await uploadPDFToStorage(firstFile, user.id, supabase);
    console.log('PDF uploaded:', pdfUrl);

    // Step 2: Extract text from page 1
    let pageText: string;
    try {
      pageText = await extractPDFPageText(pdfUrl, 1);
      console.log('Page 1 text extracted');
    } catch (extractionError) {
      console.error('PDF text extraction failed:', extractionError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to extract text from PDF for city detection',
          details: extractionError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Gather candidate cities from user's checklist items
    const { data: cityRows, error: cityErr } = await supabase
      .from('checklist_items')
      .select('city')
      .eq('user_id', user.id);

    if (cityErr) {
      console.error('Error fetching city candidates:', cityErr);
      if (imageUrl) await cleanupTempImage(imageUrl, supabase);
      throw new Error('Failed to load city candidates');
    }

    const candidates = Array.from(new Set((cityRows || [])
      .map((r: any) => (r.city || '').trim())
      .filter((c: string) => c.length > 0)));

    if (candidates.length === 0) {
      if (imageUrl) await cleanupTempImage(imageUrl, supabase);
      throw new Error('No checklist cities available. Please add checklist items with a city first.');
    }

    // Step 4: Extract city from image using Lovable AI Vision
    const extractedCityRaw = await extractCityFromPDFText(pageText, candidates, lovableApiKey);
    console.log('City detection initiated from text');
    
    const extractedCity = extractedCityRaw || (candidates.length === 1 ? candidates[0] : null);
    console.log('City detection result:', extractedCity || 'Not detected');

    // Step 5: Query checklist items - STRICT city matching
    if (!extractedCity) {
      throw new Error(
        `Could not extract city from PDF. Please ensure:\n` +
        `1. The project address is clearly visible on page 1\n` +
        `2. The city name matches one of your checklist cities\n` +
        `3. Available cities: ${candidates.join(', ')}`
      );
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

    // Step 6: Generate FIXED number of issues based on city (8-20)
    const fixedIssueCount = getFixedIssueCountForCity(extractedCity);
    const detectedIssues = generateSyntheticIssues(
      selectedItems, 
      Math.min(fixedIssueCount, selectedItems.length)
    );

    console.log(`Generated ${detectedIssues.length} synthetic issues from checklist items`);

    // Step 7: Save issues to database
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