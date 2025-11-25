-- Drop existing project_assignments table as it's no longer needed
DROP TABLE IF EXISTS project_assignments CASCADE;

-- Update projects table structure
ALTER TABLE projects 
  DROP COLUMN IF EXISTS ar1_planning,
  DROP COLUMN IF EXISTS ar2_field,
  ADD COLUMN IF NOT EXISTS expected_end_date DATE,
  ADD COLUMN IF NOT EXISTS project_notes TEXT,
  ADD COLUMN IF NOT EXISTS ar_planning_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ar_field_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_edit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_edit_by UUID REFERENCES auth.users(id);

-- Rename project_milestones to project_tasks and update structure
ALTER TABLE project_milestones RENAME TO project_tasks;

-- Update project_tasks table structure
ALTER TABLE project_tasks
  RENAME COLUMN id TO task_id,
  RENAME COLUMN milestone_number TO milestone_number,
  RENAME COLUMN task_name TO task_name,
  RENAME COLUMN ar_assigned TO assigned_ar_id,
  RENAME COLUMN assigned_skip TO assigned_skip_flag,
  RENAME COLUMN notes TO notes_tasks,
  RENAME COLUMN status TO task_status,
  ADD COLUMN IF NOT EXISTS allocated_due_date DATE,
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS last_step_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Convert assigned_ar_id from text to UUID (will need to be set properly in the UI)
ALTER TABLE project_tasks ALTER COLUMN assigned_ar_id TYPE UUID USING NULL;

-- Update profiles table to match users table requirements
ALTER TABLE profiles
  RENAME COLUMN id TO user_id,
  RENAME COLUMN full_name TO name,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES project_tasks(task_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes_tasks TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on notes table
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notes table
CREATE POLICY "Users can view notes for their assigned tasks" ON notes
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM project_tasks pt
    JOIN projects p ON pt.project_id = p.id
    WHERE pt.task_id = notes.task_id 
    AND (p.user_id = auth.uid() OR p.ar_planning_id = auth.uid() OR p.ar_field_id = auth.uid())
  )
);

CREATE POLICY "Users can insert notes for their assigned tasks" ON notes
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM project_tasks pt
    JOIN projects p ON pt.project_id = p.id
    WHERE pt.task_id = notes.task_id 
    AND (p.user_id = auth.uid() OR p.ar_planning_id = auth.uid() OR p.ar_field_id = auth.uid())
  )
);

CREATE POLICY "Users can update their own notes" ON notes
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notes" ON notes
FOR DELETE USING (user_id = auth.uid());

-- Update RLS policies for projects table
DROP POLICY IF EXISTS "PMs can view all projects they created" ON projects;
DROP POLICY IF EXISTS "AR2 can view assigned projects" ON projects;
DROP POLICY IF EXISTS "PMs can insert projects" ON projects;
DROP POLICY IF EXISTS "PMs can update their projects" ON projects;
DROP POLICY IF EXISTS "AR2 can update assigned projects" ON projects;
DROP POLICY IF EXISTS "PMs can delete their projects" ON projects;

CREATE POLICY "PMs can manage their projects" ON projects
FOR ALL USING (
  (user_id = auth.uid() AND has_role(auth.uid(), 'pm'::app_role))
);

CREATE POLICY "AR1 can view assigned projects" ON projects
FOR SELECT USING (
  ar_planning_id = auth.uid() AND has_role(auth.uid(), 'ar1_planning'::app_role)
);

CREATE POLICY "AR2 can view and update assigned projects" ON projects
FOR ALL USING (
  ar_field_id = auth.uid() AND has_role(auth.uid(), 'ar2_field'::app_role)
);

-- Update RLS policies for project_tasks table
DROP POLICY IF EXISTS "PMs and AR2 can view milestones for their projects" ON project_tasks;
DROP POLICY IF EXISTS "AR1 can view assigned milestones" ON project_tasks;
DROP POLICY IF EXISTS "PMs and AR2 can insert milestones" ON project_tasks;
DROP POLICY IF EXISTS "PMs and AR2 can update milestones for their projects" ON project_tasks;
DROP POLICY IF EXISTS "AR1 can update notes on assigned milestones" ON project_tasks;
DROP POLICY IF EXISTS "PMs and AR2 can delete milestones" ON project_tasks;

CREATE POLICY "Users can view tasks for their projects" ON project_tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_tasks.project_id 
    AND (p.user_id = auth.uid() OR p.ar_planning_id = auth.uid() OR p.ar_field_id = auth.uid())
  )
);

CREATE POLICY "PMs and AR2 can manage tasks" ON project_tasks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_tasks.project_id 
    AND ((p.user_id = auth.uid() AND has_role(auth.uid(), 'pm'::app_role)) OR
         (p.ar_field_id = auth.uid() AND has_role(auth.uid(), 'ar2_field'::app_role)))
  )
);

CREATE POLICY "AR1 can update assigned task status and notes" ON project_tasks
FOR UPDATE USING (
  assigned_ar_id = auth.uid() AND has_role(auth.uid(), 'ar1_planning'::app_role)
);

-- Create trigger for updating last_edit_timestamp on projects
CREATE OR REPLACE FUNCTION update_project_edit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_edit_timestamp = now();
  NEW.last_edit_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_edit_timestamp
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_project_edit_timestamp();

-- Create trigger for updating last_step_timestamp on project_tasks
CREATE OR REPLACE FUNCTION update_task_step_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_step_timestamp = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_tasks_step_timestamp
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_step_timestamp();

-- Create trigger for notes updated_at
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();