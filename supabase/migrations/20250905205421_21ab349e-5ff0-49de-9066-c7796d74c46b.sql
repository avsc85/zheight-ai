-- Comprehensive RLS policies update for admin access and PM functionality

-- Drop existing restrictive policies to recreate them
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "PMs can manage their projects" ON public.projects;
DROP POLICY IF EXISTS "AR1 can view assigned projects" ON public.projects;
DROP POLICY IF EXISTS "AR2 can view and update assigned projects" ON public.projects;

DROP POLICY IF EXISTS "Users can view tasks for their projects" ON public.project_tasks;
DROP POLICY IF EXISTS "PMs and AR2 can manage tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "AR1 can update assigned task status and notes" ON public.project_tasks;

-- Enhanced user_roles policies with admin access and PM visibility for AR users
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own roles" 
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins and PMs can view all user roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pm'));

CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Enhanced profiles policies with admin access and PM visibility for AR users
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins and PMs can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pm'));

-- Enhanced projects policies with full admin access
CREATE POLICY "PMs can manage their projects"
  ON public.projects FOR ALL
  USING (user_id = auth.uid() AND (has_role(auth.uid(), 'pm') OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can manage all projects"
  ON public.projects FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "AR1 can view assigned projects"
  ON public.projects FOR SELECT
  USING (ar_planning_id = auth.uid() AND (has_role(auth.uid(), 'ar1_planning') OR has_role(auth.uid(), 'admin')));

CREATE POLICY "AR2 can view and update assigned projects"
  ON public.projects FOR ALL
  USING (ar_field_id = auth.uid() AND (has_role(auth.uid(), 'ar2_field') OR has_role(auth.uid(), 'admin')));

-- Enhanced project_tasks policies with full admin access
CREATE POLICY "Users can view tasks for their projects"
  ON public.project_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id 
        AND (p.user_id = auth.uid() OR p.ar_planning_id = auth.uid() OR p.ar_field_id = auth.uid())
    ) OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "PMs and AR2 can manage tasks"
  ON public.project_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id 
        AND (
          (p.user_id = auth.uid() AND has_role(auth.uid(), 'pm')) OR
          (p.ar_field_id = auth.uid() AND has_role(auth.uid(), 'ar2_field'))
        )
    ) OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "AR1 can update assigned task status and notes"
  ON public.project_tasks FOR UPDATE
  USING (
    (assigned_ar_id = auth.uid() AND has_role(auth.uid(), 'ar1_planning')) OR 
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage all tasks"
  ON public.project_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'));