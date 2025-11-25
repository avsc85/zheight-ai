-- Update RLS policy to allow PMs to manage ALL projects, not just their own
DROP POLICY IF EXISTS "PMs can manage their projects" ON public.projects;

-- Create new policy allowing PMs to manage all projects
CREATE POLICY "PMs can manage all projects" 
ON public.projects 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'pm'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Keep existing AR1 view policy
-- AR1 can view assigned projects (no change needed)

-- Keep existing AR2 policy  
-- AR2 can view and update assigned projects (no change needed)

-- Keep existing admin policy
-- Enhanced admin access to all projects (no change needed)