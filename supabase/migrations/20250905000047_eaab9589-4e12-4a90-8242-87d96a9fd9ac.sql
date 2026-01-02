-- Create project assignments table for AR2 users
CREATE TABLE public.project_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ar2_user_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, ar2_user_id)
);

-- Enable RLS on project_assignments
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for projects to handle new roles
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- New RLS policies for projects
CREATE POLICY "PMs can view all projects they created" 
ON public.projects 
FOR SELECT 
USING (
  auth.uid() = user_id AND 
  has_role(auth.uid(), 'pm')
);

CREATE POLICY "AR2 can view assigned projects" 
ON public.projects 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ar2_field') AND
  EXISTS (
    SELECT 1 FROM public.project_assignments 
    WHERE project_id = projects.id 
    AND ar2_user_id = auth.uid()
  )
);

CREATE POLICY "PMs can insert projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  has_role(auth.uid(), 'pm')
);

CREATE POLICY "PMs can update their projects" 
ON public.projects 
FOR UPDATE 
USING (
  auth.uid() = user_id AND 
  has_role(auth.uid(), 'pm')
);

CREATE POLICY "AR2 can update assigned projects" 
ON public.projects 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'ar2_field') AND
  EXISTS (
    SELECT 1 FROM public.project_assignments 
    WHERE project_id = projects.id 
    AND ar2_user_id = auth.uid()
  )
);

CREATE POLICY "PMs can delete their projects" 
ON public.projects 
FOR DELETE 
USING (
  auth.uid() = user_id AND 
  has_role(auth.uid(), 'pm')
);

-- Update RLS policies for project_milestones
DROP POLICY IF EXISTS "Users can view milestones for their projects" ON public.project_milestones;
DROP POLICY IF EXISTS "Users can insert milestones for their projects" ON public.project_milestones;
DROP POLICY IF EXISTS "Users can update milestones for their projects" ON public.project_milestones;
DROP POLICY IF EXISTS "Users can delete milestones for their projects" ON public.project_milestones;

-- New RLS policies for project_milestones
CREATE POLICY "PMs and AR2 can view milestones for their projects" 
ON public.project_milestones 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND (
      (projects.user_id = auth.uid() AND has_role(auth.uid(), 'pm')) OR
      (has_role(auth.uid(), 'ar2_field') AND EXISTS (
        SELECT 1 FROM public.project_assignments 
        WHERE project_id = projects.id AND ar2_user_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "AR1 can view assigned milestones" 
ON public.project_milestones 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ar1_planning') AND 
  ar_assigned = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "PMs and AR2 can insert milestones" 
ON public.project_milestones 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND (
      (projects.user_id = auth.uid() AND has_role(auth.uid(), 'pm')) OR
      (has_role(auth.uid(), 'ar2_field') AND EXISTS (
        SELECT 1 FROM public.project_assignments 
        WHERE project_id = projects.id AND ar2_user_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "PMs and AR2 can update milestones for their projects" 
ON public.project_milestones 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND (
      (projects.user_id = auth.uid() AND has_role(auth.uid(), 'pm')) OR
      (has_role(auth.uid(), 'ar2_field') AND EXISTS (
        SELECT 1 FROM public.project_assignments 
        WHERE project_id = projects.id AND ar2_user_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "AR1 can update notes on assigned milestones" 
ON public.project_milestones 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'ar1_planning') AND 
  ar_assigned = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "PMs and AR2 can delete milestones" 
ON public.project_milestones 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND (
      (projects.user_id = auth.uid() AND has_role(auth.uid(), 'pm')) OR
      (has_role(auth.uid(), 'ar2_field') AND EXISTS (
        SELECT 1 FROM public.project_assignments 
        WHERE project_id = projects.id AND ar2_user_id = auth.uid()
      ))
    )
  )
);

-- RLS policies for project_assignments
CREATE POLICY "PMs can view all assignments" 
ON public.project_assignments 
FOR SELECT 
USING (has_role(auth.uid(), 'pm'));

CREATE POLICY "AR2 can view their assignments" 
ON public.project_assignments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ar2_field') AND 
  ar2_user_id = auth.uid()
);

CREATE POLICY "PMs can create assignments" 
ON public.project_assignments 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'pm') AND
  assigned_by = auth.uid()
);

CREATE POLICY "PMs can update assignments" 
ON public.project_assignments 
FOR UPDATE 
USING (has_role(auth.uid(), 'pm'));

CREATE POLICY "PMs can delete assignments" 
ON public.project_assignments 
FOR DELETE 
USING (has_role(auth.uid(), 'pm'));

-- Add trigger for project_assignments
CREATE TRIGGER update_project_assignments_updated_at
BEFORE UPDATE ON public.project_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();