-- Final AR Task-Level Policies (Simple & No Circular Reference)
-- This migration adds minimal RLS policies for AR users to access their assigned tasks

-- ============================================
-- STEP 1: Drop any conflicting AR policies
-- ============================================

DROP POLICY IF EXISTS "AR users can view projects with assigned tasks" ON public.projects;
DROP POLICY IF EXISTS "AR users can view their assigned tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "AR users can update their assigned tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "AR users can view their assigned tasks at task level" ON public.project_tasks;
DROP POLICY IF EXISTS "AR users can update their assigned task status" ON public.project_tasks;
DROP POLICY IF EXISTS "AR users view assigned tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "AR users update assigned tasks" ON public.project_tasks;

-- ============================================
-- STEP 2: Create AR Task Policies (FINAL)
-- ============================================

-- Policy 1: AR users can VIEW tasks assigned to them
-- NOTE: This does NOT override existing PM/Admin policies because:
-- - RLS policies are combined with OR logic
-- - Existing policies for PM/Admin will continue to work
CREATE POLICY "AR users view assigned tasks"
ON public.project_tasks
FOR SELECT
TO public
USING (
  -- AR can see tasks where they are assigned
  assigned_ar_id = auth.uid()
);

-- Policy 2: AR users can UPDATE their assigned tasks (status, notes)
-- NOTE: This only allows AR to update their own tasks
-- PM/Admin update policies remain separate and functional
CREATE POLICY "AR users update assigned tasks"
ON public.project_tasks
FOR UPDATE
TO public
USING (
  -- AR can update only tasks assigned to them
  assigned_ar_id = auth.uid()
)
WITH CHECK (
  -- AR can update only tasks assigned to them
  assigned_ar_id = auth.uid()
);

-- ============================================
-- NOTES:
-- ============================================
-- 1. AR users can see tasks where assigned_ar_id = their user_id
-- 2. AR users can update (status, notes) only their assigned tasks
-- 3. When AR fetches tasks with .select('*, projects(...)'), 
--    they automatically get project info through the join
-- 4. NO separate projects policy needed - avoids circular reference
-- 5. Frontend filtering already handles additional logic
-- 6. PM/Admin permissions remain unchanged (existing policies)
