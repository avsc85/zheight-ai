-- TEST: Daily Digest Fix - PM Notification Query
-- This test file shows the fixed PM digest query that uses project_manager_name instead of project_manager_id

-- BEFORE (BROKEN - Returns 0 rows):
-- SELECT pm_name, project_name, task_count, tasks
-- FROM generate_daily_task_digest()
-- WHERE email_type = 'pm_daily_digest'
-- Issue: Searching for project_manager_id (UUID) in profiles.user_id
--        But projects table stores project_manager_name (TEXT)
--        Result: NO MATCHES - PMs never get emails

-- AFTER (FIXED - Returns rows for each PM):
-- The fix changes the PM digest query to:
-- 1. Join projects table with profiles by project_manager_name = profiles.name
-- 2. Get PM email from profiles table: profiles.email
-- 3. Group by PM and consolidate all projects + tasks
-- 4. Only send if PM has pending tasks

-- To test the fix in Supabase:

-- Step 1: Check existing projects with PMs
SELECT 
    id,
    project_name,
    project_manager_name,
    created_at
FROM projects
WHERE project_manager_name IS NOT NULL
LIMIT 5;

-- Step 2: Verify PM names exist in profiles
SELECT 
    user_id,
    name,
    email
FROM profiles
WHERE name IN (
    SELECT DISTINCT project_manager_name 
    FROM projects 
    WHERE project_manager_name IS NOT NULL
)
LIMIT 10;

-- Step 3: Run the daily digest function manually
SELECT generate_daily_task_digest();

-- Step 4: Check email_notifications queue for pm_daily_digest emails
SELECT 
    email_id,
    email_type,
    recipient_email,
    metadata->>'pm_name' as pm_name,
    metadata->>'project_count' as projects,
    metadata->>'task_count' as tasks,
    created_at
FROM email_notifications
WHERE email_type = 'pm_daily_digest'
ORDER BY created_at DESC
LIMIT 10;

-- Expected Results:
-- - Multiple rows with email_type = 'pm_daily_digest'
-- - recipient_email should be PM's email (not NULL)
-- - Each PM should appear once with consolidated projects
-- - metadata should show project_count > 0 and task_count > 0

-- If you see 0 rows, the fix hasn't been applied yet
-- If you see rows with all PMs that have projects, the fix is working!
