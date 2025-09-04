-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  difficulty_level TEXT CHECK (difficulty_level IN ('high', 'medium', 'low')),
  notes TEXT,
  hours_allocated INTEGER DEFAULT 32,
  ar1_planning TEXT,
  ar2_field TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_milestones table
CREATE TABLE public.project_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_number INTEGER NOT NULL,
  task_name TEXT NOT NULL,
  ar_assigned TEXT,
  assigned_skip TEXT CHECK (assigned_skip IN ('Y', 'N', 'Skip')) DEFAULT 'N',
  due_date TEXT,
  priority_exception TEXT,
  time_percentage INTEGER DEFAULT 0,
  hours TEXT,
  notes TEXT DEFAULT '',
  status TEXT CHECK (status IN ('in_queue', 'started', 'completed', 'blocked')) DEFAULT 'in_queue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects
CREATE POLICY "Users can view their own projects" 
ON public.projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for project_milestones
CREATE POLICY "Users can view milestones for their projects" 
ON public.project_milestones 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert milestones for their projects" 
ON public.project_milestones 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update milestones for their projects" 
ON public.project_milestones 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete milestones for their projects" 
ON public.project_milestones 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_milestones.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_milestones_updated_at
BEFORE UPDATE ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();