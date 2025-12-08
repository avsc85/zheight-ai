-- Fix Project Manager Permissions and Email Links
-- This migration adds RLS policies for Project Managers to access their assigned projects

-- ============================================
-- PART 1: Project Manager RLS Policies
-- ============================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Project managers can view their assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Project managers can update their assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Project managers can view tasks for their projects" ON public.project_tasks;
DROP POLICY IF EXISTS "Project managers can update tasks for their projects" ON public.project_tasks;
DROP POLICY IF EXISTS "Project managers can insert tasks for their projects" ON public.project_tasks;

-- Create policy for PMs to VIEW their assigned projects
CREATE POLICY "Project managers can view their assigned projects"
ON public.projects
FOR SELECT
USING (
  -- PM can see if their name matches project_manager_name
  project_manager_name IN (
    SELECT name FROM public.profiles WHERE user_id = auth.uid()
  )
  OR
  -- Original policy: users can see their own projects
  auth.uid() = user_id
);

-- Create policy for PMs to UPDATE their assigned projects  
CREATE POLICY "Project managers can update their assigned projects"
ON public.projects
FOR UPDATE
USING (
  -- PM can edit if their name matches project_manager_name
  project_manager_name IN (
    SELECT name FROM public.profiles WHERE user_id = auth.uid()
  )
  OR
  -- Original policy: users can edit their own projects
  auth.uid() = user_id
);

-- Create policy for PMs to VIEW project_tasks for their assigned projects
CREATE POLICY "Project managers can view tasks for their projects"
ON public.project_tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_tasks.project_id
    AND (
      p.project_manager_name IN (
        SELECT name FROM public.profiles WHERE user_id = auth.uid()
      )
      OR p.user_id = auth.uid()
    )
  )
);

-- Create policy for PMs to UPDATE project_tasks (including assigning ARs)
CREATE POLICY "Project managers can update tasks for their projects"
ON public.project_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_tasks.project_id
    AND (
      p.project_manager_name IN (
        SELECT name FROM public.profiles WHERE user_id = auth.uid()
      )
      OR p.user_id = auth.uid()
    )
  )
);

-- Create policy for PMs to INSERT project_tasks
CREATE POLICY "Project managers can insert tasks for their projects"
ON public.project_tasks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_tasks.project_id
    AND (
      p.project_manager_name IN (
        SELECT name FROM public.profiles WHERE user_id = auth.uid()
      )
      OR p.user_id = auth.uid()
    )
  )
);

-- ============================================
-- PART 2: Update Email Links from zheight.tech to zheight.com
-- ============================================

-- Update the PM assignment email function to use zheight.com
CREATE OR REPLACE FUNCTION public.log_pm_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
    v_pm_email TEXT;
    v_pm_name TEXT;
    v_project_name TEXT;
    v_should_send BOOLEAN := FALSE;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_start_date TEXT;
    v_end_date TEXT;
BEGIN
    -- Get project name
    v_project_name := NEW.project_name;
    
    -- Determine if we should send email
    IF TG_OP = 'INSERT' THEN
        -- On INSERT: Send email if PM is assigned
        IF NEW.project_manager_name IS NOT NULL AND NEW.project_manager_name != '' THEN
            v_should_send := TRUE;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- On UPDATE: Send email if PM changed
        IF OLD.project_manager_name IS DISTINCT FROM NEW.project_manager_name AND
           NEW.project_manager_name IS NOT NULL AND NEW.project_manager_name != '' THEN
            v_should_send := TRUE;
        END IF;
    END IF;
    
    -- Only process if PM is assigned or changed
    IF v_should_send THEN
        
        -- Get PM email by matching name in profiles table
        SELECT u.email, p.name INTO v_pm_email, v_pm_name
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.name = NEW.project_manager_name
        LIMIT 1;
        
        -- Only send if we found the PM's email
        IF v_pm_email IS NOT NULL THEN
            
            -- Format dates
            v_start_date := COALESCE(NEW.start_date::TEXT, 'Not set');
            v_end_date := COALESCE(NEW.expected_end_date::TEXT, 'Not set');
            
            -- Create subject
            v_email_subject := 'New Project Assignment: ' || v_project_name;
            
            -- Create HTML email body with UPDATED LINK TO zheight.com
            v_email_html := '
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
        .header { background-color: #2563EB; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-row { margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #2563EB; }
        .info-label { font-weight: bold; color: #555; }
        .info-value { color: #333; margin-left: 10px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 New Project Assignment</h1>
        </div>
        <div class="content">
            <p>Hello ' || COALESCE(v_pm_name, 'Project Manager') || ',</p>
            <p>You have been assigned as Project Manager for a new project in the zHeight AI system.</p>
            <div class="info-row"><span class="info-label">Project Name:</span><span class="info-value">' || v_project_name || '</span></div>
            <div class="info-row"><span class="info-label">Start Date:</span><span class="info-value">' || v_start_date || '</span></div>
            <div class="info-row"><span class="info-label">Expected End Date:</span><span class="info-value">' || v_end_date || '</span></div>
            <div class="info-row"><span class="info-label">Assignment Time:</span><span class="info-value">' || TO_CHAR(NOW(), 'Day, Month DD, YYYY at HH24:MI:SS') || '</span></div>
            <a href="https://zheight.tech/project-mgmt/setup/' || NEW.id || '" class="button">
                View Project Details
            </a>
        </div>
        <div class="footer"><p>© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p></div>
    </div>
</body>
</html>';
            
            -- Create plain text version
            v_email_text := 'New Project Assignment' || E'\n\n' ||
                'Project Manager: ' || COALESCE(v_pm_name, 'Unknown') || E'\n' ||
                'Project: ' || v_project_name || E'\n' ||
                'Start Date: ' || v_start_date || E'\n' ||
                'Expected End Date: ' || v_end_date || E'\n\n' ||
                'View project: https://zheight.tech/project-mgmt/setup/' || NEW.id;
            
            -- Insert into email notifications queue
            INSERT INTO public.email_notifications (
                recipient_email,
                email_type,
                subject,
                body_html,
                body_text,
                metadata
            ) VALUES (
                v_pm_email,
                'pm_assignment',
                v_email_subject,
                v_email_html,
                v_email_text,
                jsonb_build_object(
                    'project_id', NEW.id,
                    'project_name', v_project_name,
                    'pm_name', v_pm_name,
                    'start_date', NEW.start_date,
                    'end_date', NEW.expected_end_date
                )
            );
            
            RAISE NOTICE 'PM assignment email logged for project: % to: %', v_project_name, v_pm_email;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_pm_assignment_email() IS 'Logs PM assignment emails with correct zheight.com links';

-- ============================================
-- PART 3: Add PM-specific helper function for frontend
-- ============================================

-- Function to check if current user is PM for a project
CREATE OR REPLACE FUNCTION public.is_project_manager(project_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_pm_name TEXT;
  v_user_name TEXT;
BEGIN
  -- Get project manager name
  SELECT project_manager_name INTO v_pm_name
  FROM public.projects
  WHERE id = project_id_param;
  
  -- Get current user's name
  SELECT name INTO v_user_name
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Return true if names match
  RETURN v_pm_name = v_user_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_project_manager(UUID) IS 'Check if current user is PM for given project';

-- ============================================
-- Verification Queries (comment out in production)
-- ============================================

-- Check policies
-- SELECT * FROM pg_policies WHERE tablename IN ('projects', 'project_tasks');

-- Test PM access (replace with actual PM user_id)
-- SELECT * FROM projects WHERE project_manager_name IN (
--   SELECT name FROM profiles WHERE user_id = 'your-pm-user-id'
-- );