-- Change remaining enum columns to text in architectural_issue_reports table
ALTER TABLE public.architectural_issue_reports 
ALTER COLUMN compliance_source TYPE text,
ALTER COLUMN confidence_level TYPE text;