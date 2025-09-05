-- First, create the notes table and update basic structures
-- Drop existing project_assignments table as it's no longer needed
DROP TABLE IF EXISTS project_assignments CASCADE;

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes_tasks TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on notes table
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

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

-- Update profiles table to match users table requirements  
ALTER TABLE profiles RENAME COLUMN id TO user_id;
ALTER TABLE profiles RENAME COLUMN full_name TO name;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;