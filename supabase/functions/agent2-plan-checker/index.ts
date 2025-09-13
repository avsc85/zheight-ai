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
    console.log('Starting Agent 2 Plan Checker process');
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Simulate 5-second analysis
    console.log('Starting 5-second analysis simulation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Analysis complete');

    // Generate a unique analysis session ID
    const analysisSessionId = crypto.randomUUID();

    // Fetch existing architectural issue reports from the database to display
    const { data: existingIssues, error: fetchError } = await supabase
      .from('architectural_issue_reports')
      .select('*')
      .eq('user_id', user.id)
      .limit(10);

    if (fetchError) {
      console.error('Error fetching existing issues:', fetchError);
    }

    // Create sample data for demonstration (combining existing data with mock data)
    const sampleIssues = [
      {
        checklist_item_id: crypto.randomUUID(),
        plan_sheet_name: "A-2.0 Floor Plan",
        issue_description: "Window egress size does not meet minimum requirements",
        location_in_sheet: "North bedroom window",
        issue_type: "Non-compliant",
        compliance_source: "California Code",
        specific_code_identifier: "CRC R310.1",
        short_code_requirement: "Emergency escape and rescue openings required",
        long_code_requirement: "Emergency escape and rescue openings shall have a net clear opening of not less than 5.7 square feet",
        source_link: "https://codes.iccsafe.org/content/CRC2019/chapter-3-building-planning",
        confidence_level: "High",
        confidence_rationale: "Clear measurement discrepancy found in plan dimensions"
      },
      {
        checklist_item_id: crypto.randomUUID(),
        plan_sheet_name: "A-3.0 Elevations",
        issue_description: "Stair handrail height not specified",
        location_in_sheet: "Main stairway elevation view",
        issue_type: "Missing",
        compliance_source: "California Code", 
        specific_code_identifier: "CRC R311.7.8",
        short_code_requirement: "Handrail height shall be 34-38 inches",
        long_code_requirement: "Handrail height, measured above stair tread nosings, shall be uniform, not less than 34 inches and not more than 38 inches",
        source_link: "https://codes.iccsafe.org/content/CRC2019/chapter-3-building-planning",
        confidence_level: "Medium",
        confidence_rationale: "Handrail shown but dimensions not clearly specified"
      },
      {
        checklist_item_id: crypto.randomUUID(),
        plan_sheet_name: "A-4.0 Roof Plan", 
        issue_description: "Roof drainage plan incomplete",
        location_in_sheet: "South elevation roof area",
        issue_type: "Inconsistent",
        compliance_source: "Local",
        specific_code_identifier: "Local Code 15.04.030",
        short_code_requirement: "Roof drainage shall direct water away from foundation",
        long_code_requirement: "All roof drainage systems shall be designed to direct water flow away from the building foundation and toward approved drainage areas",
        source_link: "https://library.municode.com/ca/building_codes",
        confidence_level: "Low",
        confidence_rationale: "Partial drainage information shown but connection details unclear"
      }
    ];

    // If we have existing issues, include some of them
    if (existingIssues && existingIssues.length > 0) {
      const formattedExistingIssues = existingIssues.slice(0, 2).map(issue => ({
        checklist_item_id: issue.checklist_item_id || crypto.randomUUID(),
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
      }));
      
      sampleIssues.push(...formattedExistingIssues);
    }

    // Return the response
    return new Response(JSON.stringify({
      success: true,
      data: {
        analysis_session_id: analysisSessionId,
        issues: sampleIssues
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