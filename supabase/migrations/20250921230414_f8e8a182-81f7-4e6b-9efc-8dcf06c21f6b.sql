-- Add policy to allow AR2 users to create projects
CREATE POLICY "AR2 can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'ar2_field'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Update the existing AR2 policy to also allow access to projects they created
DROP POLICY IF EXISTS "AR2 can view and update assigned projects" ON public.projects;

CREATE POLICY "AR2 can manage assigned projects and projects they created" 
ON public.projects 
FOR ALL 
USING (
  (ar_field_id = auth.uid() OR user_id = auth.uid()) 
  AND (has_role(auth.uid(), 'ar2_field'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);