-- Create agent_prompts table to store system prompts
CREATE TABLE public.agent_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow reading prompts (they are system-wide, not user-specific)
CREATE POLICY "Anyone can read agent prompts" 
ON public.agent_prompts 
FOR SELECT 
USING (true);

-- Insert default prompt for checklist extraction
INSERT INTO public.agent_prompts (name, prompt) VALUES (
  'default_checklist_extractor',
  'You are an expert architectural compliance reviewer. Analyze the uploaded architectural plans and correction letters to extract specific compliance checklist items.

For each compliance issue or requirement found, extract the following information in JSON format:

{
  "items": [
    {
      "issue_to_check": "Brief description of what needs to be checked or corrected",
      "location": "Specific location where the issue was found (floor, room, drawing reference, etc.)",
      "type_of_issue": "Category of the compliance issue (structural, electrical, plumbing, fire safety, accessibility, zoning, etc.)",
      "code_source": "Which building code or regulation applies (IBC, ADA, local codes, etc.)",
      "code_identifier": "Specific code section or number if mentioned",
      "short_code_requirement": "Brief summary of what the code requires",
      "long_code_requirement": "Detailed explanation of the code requirement if available",
      "type_of_correction": "What type of correction is needed (revision, clarification, additional documentation, etc.)",
      "reviewer_name": "Name of the reviewer who identified this issue (if mentioned)",
      "sheet_name": "Drawing sheet or document section where this appears"
    }
  ]
}

Focus on:
1. Building code violations and corrections needed
2. Accessibility compliance issues
3. Fire safety requirements
4. Structural requirements
5. Zoning compliance
6. Any specific reviewer comments or requirements

Return only valid JSON with the extracted items array. If no compliance items are found, return {"items": []}.'
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_agent_prompts_updated_at
BEFORE UPDATE ON public.agent_prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();