-- Fix difficulty_level constraint to allow null values
ALTER TABLE public.projects 
ALTER COLUMN difficulty_level DROP DEFAULT;

ALTER TABLE public.projects 
ALTER COLUMN difficulty_level SET DEFAULT NULL;

-- Update RLS policies for better admin and PM access to user data
DROP POLICY IF EXISTS "Admins and PMs can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and PMs can view all profiles" ON public.profiles;

-- Enhanced policy for user_roles - allow admins and PMs to view all user roles
CREATE POLICY "Enhanced admin and PM access to user roles" 
ON public.user_roles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'pm'::app_role)
);

-- Enhanced policy for profiles - allow admins and PMs to view all profiles  
CREATE POLICY "Enhanced admin and PM access to profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'pm'::app_role)
);

-- Ensure admins can manage projects created by anyone
DROP POLICY IF EXISTS "Admins can manage all projects" ON public.projects;

CREATE POLICY "Enhanced admin access to all projects" 
ON public.projects 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ensure admins can manage all project tasks
DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.project_tasks;

CREATE POLICY "Enhanced admin access to all tasks" 
ON public.project_tasks 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));