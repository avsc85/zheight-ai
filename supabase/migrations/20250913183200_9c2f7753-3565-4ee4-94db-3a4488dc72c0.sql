-- Create enum types for issue reports
CREATE TYPE public.issue_type_enum AS ENUM ('Missing', 'Non-compliant', 'Inconsistent');
CREATE TYPE public.compliance_source_enum AS ENUM ('California Code', 'Local');
CREATE TYPE public.confidence_level_enum AS ENUM ('High', 'Medium', 'Low');

-- Create architectural_issue_reports table
CREATE TABLE public.architectural_issue_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  checklist_item_id UUID REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  analysis_session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  plan_sheet_name TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  location_in_sheet TEXT NOT NULL,
  issue_type issue_type_enum NOT NULL,
  compliance_source compliance_source_enum NOT NULL,
  specific_code_identifier TEXT NOT NULL,
  short_code_requirement TEXT NOT NULL,
  long_code_requirement TEXT NOT NULL,
  source_link TEXT NOT NULL,
  confidence_level confidence_level_enum NOT NULL,
  confidence_rationale TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.architectural_issue_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own issue reports" 
ON public.architectural_issue_reports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own issue reports" 
ON public.architectural_issue_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own issue reports" 
ON public.architectural_issue_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own issue reports" 
ON public.architectural_issue_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can manage all issue reports
CREATE POLICY "Admins can manage all issue reports" 
ON public.architectural_issue_reports 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_architectural_issue_reports_updated_at
BEFORE UPDATE ON public.architectural_issue_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_architectural_issue_reports_user_id ON public.architectural_issue_reports(user_id);
CREATE INDEX idx_architectural_issue_reports_session_id ON public.architectural_issue_reports(analysis_session_id);
CREATE INDEX idx_architectural_issue_reports_checklist_item ON public.architectural_issue_reports(checklist_item_id);