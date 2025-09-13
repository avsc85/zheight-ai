-- Change issue_type column from enum to text in architectural_issue_reports table
ALTER TABLE public.architectural_issue_reports 
ALTER COLUMN issue_type TYPE text;