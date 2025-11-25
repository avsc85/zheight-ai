-- Make aditya@zheight.com an admin user
-- First, we need to find the user and update their role

-- Update the user role to admin for aditya@zheight.com
UPDATE public.user_roles 
SET role = 'admin'
WHERE user_id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'aditya@zheight.com'
);

-- If the user doesn't have a role entry yet, insert one
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users 
WHERE email = 'aditya@zheight.com'
AND id NOT IN (SELECT user_id FROM public.user_roles);

-- Create policies for admins to manage user roles
CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Create policies for admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Create a function to safely delete users (admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Prevent admins from deleting themselves
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  
  -- Delete user data (profiles and roles will cascade)
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.checklist_items WHERE user_id = target_user_id;
  
  RETURN TRUE;
END;
$$;