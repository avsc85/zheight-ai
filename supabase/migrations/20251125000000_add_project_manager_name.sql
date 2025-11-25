-- Add project_manager_name column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_manager_name TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.projects.project_manager_name IS 'Name of the project manager responsible for this project';
