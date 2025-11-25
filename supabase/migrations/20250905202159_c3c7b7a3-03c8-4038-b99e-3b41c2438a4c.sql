-- Step 1: Drop all existing policies that reference columns we'll modify
DROP POLICY IF EXISTS "PMs and AR2 can view milestones for their projects" ON project_milestones;
DROP POLICY IF EXISTS "AR1 can view assigned milestones" ON project_milestones;
DROP POLICY IF EXISTS "PMs and AR2 can insert milestones" ON project_milestones;
DROP POLICY IF EXISTS "PMs and AR2 can update milestones for their projects" ON project_milestones;
DROP POLICY IF EXISTS "AR1 can update notes on assigned milestones" ON project_milestones;
DROP POLICY IF EXISTS "PMs and AR2 can delete milestones" ON project_milestones;

-- Step 2: Drop existing project policies
DROP POLICY IF EXISTS "PMs can view all projects they created" ON projects;
DROP POLICY IF EXISTS "AR2 can view assigned projects" ON projects;
DROP POLICY IF EXISTS "PMs can insert projects" ON projects;
DROP POLICY IF EXISTS "PMs can update their projects" ON projects;
DROP POLICY IF EXISTS "AR2 can update assigned projects" ON projects;
DROP POLICY IF EXISTS "PMs can delete their projects" ON projects;

-- Step 3: Drop and recreate project_assignments table if it exists
DROP TABLE IF EXISTS project_assignments CASCADE;

-- Step 4: Update projects table structure
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

-- Step 5: Rename project_milestones to project_tasks
ALTER TABLE project_milestones RENAME TO project_tasks;

-- Step 6: Update project_tasks columns step by step
ALTER TABLE project_tasks RENAME COLUMN id TO task_id;
ALTER TABLE project_tasks RENAME COLUMN ar_assigned TO assigned_ar_id;
ALTER TABLE project_tasks RENAME COLUMN assigned_skip TO assigned_skip_flag;
ALTER TABLE project_tasks RENAME COLUMN notes TO notes_tasks;
ALTER TABLE project_tasks RENAME COLUMN status TO task_status;

-- Step 7: Add new columns to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS allocated_due_date DATE,
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS last_step_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Step 8: Convert assigned_ar_id to UUID (after dropping policies)
ALTER TABLE project_tasks ALTER COLUMN assigned_ar_id TYPE UUID USING NULL;