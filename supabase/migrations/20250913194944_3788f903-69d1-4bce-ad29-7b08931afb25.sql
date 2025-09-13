-- Change UUID columns to TEXT type in architectural_issue_reports table
ALTER TABLE public.architectural_issue_reports 
ALTER COLUMN id TYPE text,
ALTER COLUMN user_id TYPE text,
ALTER COLUMN checklist_item_id TYPE text,
ALTER COLUMN analysis_session_id TYPE text;