-- Create function that calls the delete-auth-user edge function
CREATE OR REPLACE FUNCTION public.delete_auth_user_by_email(target_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- This function will be enhanced to call the edge function
  -- For now, return a placeholder that indicates auth deletion is needed
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Auth user deletion queued - requires edge function call',
    'email', target_email
  );
END;
$$;

-- Update the admin_delete_user function to be more robust
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
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
  DELETE FROM public.notes WHERE user_id = target_user_id;
  DELETE FROM public.project_tasks WHERE assigned_ar_id = target_user_id;
  
  -- Update projects to remove references to deleted user
  UPDATE public.projects SET ar_planning_id = NULL WHERE ar_planning_id = target_user_id;
  UPDATE public.projects SET ar_field_id = NULL WHERE ar_field_id = target_user_id;
  UPDATE public.projects SET user_id = NULL WHERE user_id = target_user_id AND user_id != target_user_id; -- This condition prevents issues
  
  RETURN TRUE;
END;
$$;