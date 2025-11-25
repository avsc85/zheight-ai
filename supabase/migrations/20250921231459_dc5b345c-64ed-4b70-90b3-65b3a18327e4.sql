-- Update user_roles policy to allow AR2 users to view AR1 roles for project assignment
DROP POLICY IF EXISTS "Enhanced admin and PM access to user roles" ON public.user_roles;

CREATE POLICY "Enhanced admin, PM and AR2 access to user roles" 
ON public.user_roles 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pm'::app_role)
  OR (has_role(auth.uid(), 'ar2_field'::app_role) AND role = 'ar1_planning'::app_role)
);

-- Update profiles policy to allow AR2 users to view AR1 profiles for project assignment
DROP POLICY IF EXISTS "Enhanced admin and PM access to profiles" ON public.profiles;

CREATE POLICY "Enhanced admin, PM and AR2 access to profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pm'::app_role)
  OR (has_role(auth.uid(), 'ar2_field'::app_role) AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = profiles.user_id 
    AND ur.role = 'ar1_planning'::app_role
  ))
);