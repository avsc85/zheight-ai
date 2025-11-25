-- Drop existing RLS policies on architectural_issue_reports
DROP POLICY IF EXISTS "Users can view their own issue reports" ON public.architectural_issue_reports;
DROP POLICY IF EXISTS "Users can create their own issue reports" ON public.architectural_issue_reports;
DROP POLICY IF EXISTS "Users can update their own issue reports" ON public.architectural_issue_reports;
DROP POLICY IF EXISTS "Users can delete their own issue reports" ON public.architectural_issue_reports;
DROP POLICY IF EXISTS "Admins can manage all issue reports" ON public.architectural_issue_reports;

-- Drop foreign key constraint
ALTER TABLE public.architectural_issue_reports 
DROP CONSTRAINT IF EXISTS architectural_issue_reports_checklist_item_id_fkey;

-- Change UUID columns to TEXT type in architectural_issue_reports table
ALTER TABLE public.architectural_issue_reports 
ALTER COLUMN id TYPE text,
ALTER COLUMN user_id TYPE text,
ALTER COLUMN checklist_item_id TYPE text,
ALTER COLUMN analysis_session_id TYPE text;

-- Recreate RLS policies with text types
CREATE POLICY "Users can view their own issue reports" 
ON public.architectural_issue_reports 
FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own issue reports" 
ON public.architectural_issue_reports 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own issue reports" 
ON public.architectural_issue_reports 
FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own issue reports" 
ON public.architectural_issue_reports 
FOR DELETE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Admins can manage all issue reports" 
ON public.architectural_issue_reports 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));