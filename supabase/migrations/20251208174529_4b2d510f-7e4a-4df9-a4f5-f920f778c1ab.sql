-- =====================================================
-- Fix PM Permissions: Add RLS policies for PMs assigned via project_manager_name
-- =====================================================

-- Create a helper function to check if user is PM for a project by name match
CREATE OR REPLACE FUNCTION public.is_assigned_pm(project_id_param uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pm_name TEXT;
    v_user_name TEXT;
BEGIN
    -- Get the project's project_manager_name
    SELECT project_manager_name INTO v_pm_name
    FROM projects
    WHERE id = project_id_param;
    
    -- Get current user's profile name
    SELECT name INTO v_user_name
    FROM profiles
    WHERE user_id = auth.uid();
    
    -- Check if names match
    RETURN v_pm_name IS NOT NULL 
           AND v_user_name IS NOT NULL 
           AND v_pm_name = v_user_name;
END;
$$;

-- Add SELECT policy for PMs to view projects where they are assigned as PM
CREATE POLICY "PMs can view projects where they are assigned as PM"
ON public.projects
FOR SELECT
TO authenticated
USING (
    has_role(auth.uid(), 'pm') 
    AND project_manager_name IN (
        SELECT name FROM profiles WHERE user_id = auth.uid()
    )
);

-- Add UPDATE policy for PMs to update projects where they are assigned as PM
CREATE POLICY "PMs can update projects where they are assigned as PM"
ON public.projects
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'pm') 
    AND project_manager_name IN (
        SELECT name FROM profiles WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    has_role(auth.uid(), 'pm') 
    AND project_manager_name IN (
        SELECT name FROM profiles WHERE user_id = auth.uid()
    )
);

-- Add policy for PMs to view tasks for projects they manage
CREATE POLICY "PMs can view tasks for projects they manage"
ON public.project_tasks
FOR SELECT
TO authenticated
USING (
    has_role(auth.uid(), 'pm') 
    AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_tasks.project_id
        AND p.project_manager_name IN (
            SELECT name FROM profiles WHERE user_id = auth.uid()
        )
    )
);

-- Add policy for PMs to update tasks for projects they manage
CREATE POLICY "PMs can update tasks for projects they manage"
ON public.project_tasks
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'pm') 
    AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_tasks.project_id
        AND p.project_manager_name IN (
            SELECT name FROM profiles WHERE user_id = auth.uid()
        )
    )
)
WITH CHECK (
    has_role(auth.uid(), 'pm') 
    AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_tasks.project_id
        AND p.project_manager_name IN (
            SELECT name FROM profiles WHERE user_id = auth.uid()
        )
    )
);

-- Add policy for PMs to insert tasks for projects they manage
CREATE POLICY "PMs can insert tasks for projects they manage"
ON public.project_tasks
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'pm') 
    AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_tasks.project_id
        AND p.project_manager_name IN (
            SELECT name FROM profiles WHERE user_id = auth.uid()
        )
    )
);

-- Add policy for PMs to delete tasks for projects they manage
CREATE POLICY "PMs can delete tasks for projects they manage"
ON public.project_tasks
FOR DELETE
TO authenticated
USING (
    has_role(auth.uid(), 'pm') 
    AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_tasks.project_id
        AND p.project_manager_name IN (
            SELECT name FROM profiles WHERE user_id = auth.uid()
        )
    )
);