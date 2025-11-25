-- Drop existing project_assignments table as it's no longer needed
DROP TABLE IF EXISTS project_assignments CASCADE;

-- Update projects table structure
ALTER TABLE projects 
  DROP COLUMN IF EXISTS ar1_planning,
  DROP COLUMN IF EXISTS ar2_field;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS expected_end_date DATE,
  ADD COLUMN IF NOT EXISTS project_notes TEXT,
  ADD COLUMN IF NOT EXISTS ar_planning_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ar_field_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_edit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_edit_by UUID REFERENCES auth.users(id);

-- Rename project_milestones to project_tasks
ALTER TABLE project_milestones RENAME TO project_tasks;

-- Update project_tasks table structure step by step
ALTER TABLE project_tasks RENAME COLUMN id TO task_id;
ALTER TABLE project_tasks RENAME COLUMN ar_assigned TO assigned_ar_id;
ALTER TABLE project_tasks RENAME COLUMN assigned_skip TO assigned_skip_flag;
ALTER TABLE project_tasks RENAME COLUMN notes TO notes_tasks;
ALTER TABLE project_tasks RENAME COLUMN status TO task_status;

-- Add new columns to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS allocated_due_date DATE,
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS last_step_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Convert assigned_ar_id from text to UUID (will be set properly in the UI)
ALTER TABLE project_tasks ALTER COLUMN assigned_ar_id TYPE UUID USING NULL;

-- Update profiles table to match users table requirements
ALTER TABLE profiles RENAME COLUMN id TO user_id;
ALTER TABLE profiles RENAME COLUMN full_name TO name;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;