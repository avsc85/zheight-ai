-- Remove unused fields from projects and project_tasks tables
-- Date: 2025-12-15

-- Remove columns from projects table
ALTER TABLE projects 
  DROP COLUMN IF EXISTS difficulty_level,
  DROP COLUMN IF EXISTS project_notes;

-- Remove column from project_tasks table
ALTER TABLE project_tasks 
  DROP COLUMN IF EXISTS priority_exception;

-- Note: start_date is kept in projects table as it's auto-set to creation date
