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

-- Update profiles table structure carefully
ALTER TABLE profiles
  DROP COLUMN IF EXISTS id,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;

-- Rename full_name to name if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE profiles RENAME COLUMN full_name TO name;
  END IF;
END $$;

-- Create new RLS policies for projects table
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

-- Create new RLS policies for project_tasks table
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