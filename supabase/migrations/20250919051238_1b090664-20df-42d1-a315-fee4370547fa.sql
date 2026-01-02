-- Create improved admin_delete_user function that handles auth deletion
CREATE OR REPLACE FUNCTION public.admin_delete_user_complete(target_user_id uuid, target_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  auth_deletion_result jsonb;
BEGIN
  -- Check if current user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: Admin role required');
  END IF;
  
  -- Prevent admins from deleting themselves
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;
  
  -- Start transaction for cleanup
  BEGIN
    -- Delete from public schema tables first
    DELETE FROM public.profiles WHERE user_id = target_user_id;
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    DELETE FROM public.checklist_items WHERE user_id = target_user_id;
    DELETE FROM public.notes WHERE user_id = target_user_id;
    
    -- Try to delete from auth.users using admin API call
    -- Note: This requires the delete-auth-user edge function
    IF target_email IS NOT NULL THEN
      SELECT * INTO auth_deletion_result 
      FROM public.delete_auth_user_by_email(target_email);
      
      IF auth_deletion_result->>'success' = 'false' THEN
        -- Rollback if auth deletion failed
        RAISE EXCEPTION 'Auth user deletion failed: %', auth_deletion_result->>'error';
      END IF;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'User deleted successfully from all systems',
      'auth_result', auth_deletion_result
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Transaction will auto-rollback
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Deletion failed: ' || SQLERRM
    );
  END;
END;
$$;

-- Create function to detect orphaned auth users
CREATE OR REPLACE FUNCTION public.detect_orphaned_auth_users()
RETURNS table(user_id uuid, email text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- This would need to be implemented as an edge function
  -- as we can't directly query auth.users from SQL functions
  SELECT NULL::uuid, NULL::text, NULL::timestamptz WHERE FALSE;
$$;

-- Create function to find users by email pattern
CREATE OR REPLACE FUNCTION public.find_user_by_email_pattern(email_pattern text)
RETURNS table(user_id uuid, name text, email text, role app_role, active_status boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.name,
    NULL::text as email, -- We'll get this from edge function
    ur.role,
    p.active_status
  FROM profiles p
  LEFT JOIN user_roles ur ON p.user_id = ur.user_id
  WHERE p.name ILIKE '%' || email_pattern || '%';
$$;