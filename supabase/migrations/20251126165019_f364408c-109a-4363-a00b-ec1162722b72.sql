-- Fix 1: Enable RLS on pending_count table
ALTER TABLE public.pending_count ENABLE ROW LEVEL SECURITY;

-- Add policy for pending_count (admin access only)
CREATE POLICY "Admins can view pending email count"
ON public.pending_count
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Fix 2: Add search_path to functions that are missing it
-- This prevents security vulnerabilities from search path manipulation

-- Update log_task_assignment_email function
CREATE OR REPLACE FUNCTION public.log_task_assignment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_project_name TEXT;
    v_ar_name TEXT;
    v_ar_email TEXT;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_due_date_formatted TEXT;
    v_should_send BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_should_send := (NEW.assigned_ar_id IS NOT NULL AND NEW.due_date IS NOT NULL);
    ELSIF TG_OP = 'UPDATE' THEN
        v_should_send := (
            NEW.assigned_ar_id IS NOT NULL AND 
            OLD.assigned_ar_id IS DISTINCT FROM NEW.assigned_ar_id
        );
    END IF;
    
    IF v_should_send THEN
        SELECT project_name INTO v_project_name
        FROM public.projects
        WHERE id = NEW.project_id;
        
        SELECT p.name, u.email INTO v_ar_name, v_ar_email
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.user_id = NEW.assigned_ar_id;
        
        v_due_date_formatted := NEW.due_date;
        v_email_subject := 'New Task Assignment: ' || NEW.task_name || ' - ' || v_project_name;
        
        v_email_html := '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-row { margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #4CAF50; }
        .info-label { font-weight: bold; color: #555; }
        .info-value { color: #333; margin-left: 10px; }
        .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ New Task Assignment</h1>
        </div>
        <div class="content">
            <p>Hello ' || COALESCE(v_ar_name, 'User') || ',</p>
            <p>A new task has been assigned to you in the zHeight AI system.</p>
            <div class="info-row"><span class="info-label">Assigned To:</span><span class="info-value">' || COALESCE(v_ar_name, 'Unknown') || '</span></div>
            <div class="info-row"><span class="info-label">Project Name:</span><span class="info-value">' || COALESCE(v_project_name, 'Unknown') || '</span></div>
            <div class="info-row"><span class="info-label">Task Name:</span><span class="info-value">' || NEW.task_name || '</span></div>
            <div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">' || v_due_date_formatted || '</span></div>
            <div class="info-row"><span class="info-label">Assignment Time:</span><span class="info-value">' || NOW()::text || '</span></div>
        </div>
        <div class="footer"><p>© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p></div>
    </div>
</body>
</html>';
        
        v_email_text := 'New Task Assignment Notification

Hello ' || COALESCE(v_ar_name, 'User') || ',

A new task has been assigned to you in the zHeight AI system.

Assigned To: ' || COALESCE(v_ar_name, 'Unknown') || '
Project Name: ' || COALESCE(v_project_name, 'Unknown') || '
Task Name: ' || NEW.task_name || '
Due Date: ' || v_due_date_formatted || '
Assignment Time: ' || NOW()::text || '

This is an automated notification from the zHeight AI project management system.';
        
        INSERT INTO public.email_notifications (
            recipient_email,
            email_type,
            subject,
            body_html,
            body_text,
            metadata
        ) VALUES (
            v_ar_email,
            'task_assignment',
            v_email_subject,
            v_email_html,
            v_email_text,
            jsonb_build_object(
                'task_id', NEW.task_id,
                'project_id', NEW.project_id,
                'assigned_ar_id', NEW.assigned_ar_id,
                'task_name', NEW.task_name,
                'project_name', v_project_name,
                'ar_name', v_ar_name,
                'due_date', NEW.due_date
            )
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Update log_task_status_update_email function
CREATE OR REPLACE FUNCTION public.log_task_status_update_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_project_name TEXT;
    v_ar_name TEXT;
    v_admin_emails TEXT[];
    v_all_recipient_emails TEXT[];
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_status_label TEXT;
    v_notes TEXT;
    v_recipient_email TEXT;
BEGIN
    v_status_label := CASE 
        WHEN NEW.task_status = 'started' THEN 'Started'
        WHEN NEW.task_status = 'completed' THEN 'Completed'
    END;
        
    SELECT project_name INTO v_project_name
    FROM public.projects
    WHERE id = NEW.project_id;
    
    SELECT p.name INTO v_ar_name
    FROM public.profiles p
    WHERE p.user_id = NEW.assigned_ar_id;
    
    v_notes := COALESCE(NEW.notes_tasks_ar, '');
    
    SELECT ARRAY_AGG(DISTINCT u.email)
    INTO v_admin_emails
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role = 'admin';
    
    v_all_recipient_emails := COALESCE(v_admin_emails, ARRAY[]::TEXT[]);
    
    FOREACH v_recipient_email IN ARRAY v_all_recipient_emails
    LOOP
        IF v_recipient_email IS NOT NULL THEN
            v_email_subject := 'Task ' || v_status_label || ': ' || NEW.task_name || ' - ' || v_project_name;
            
            v_email_html := '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
        .header { background-color: ' || CASE WHEN NEW.task_status = 'started' THEN '#3B82F6' ELSE '#10B981' END || '; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-row { margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid ' || CASE WHEN NEW.task_status = 'started' THEN '#3B82F6' ELSE '#10B981' END || '; }
        .info-label { font-weight: bold; color: #555; }
        .info-value { color: #333; margin-left: 10px; }
        .notes-section { margin: 20px 0; padding: 15px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px; }
        .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Task Status Update: ' || v_status_label || '</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>A task status has been updated in the zHeight AI system.</p>
            <div class="info-row"><span class="info-label">AR User:</span><span class="info-value">' || COALESCE(v_ar_name, 'Unknown') || '</span></div>
            <div class="info-row"><span class="info-label">Project Name:</span><span class="info-value">' || COALESCE(v_project_name, 'Unknown') || '</span></div>
            <div class="info-row"><span class="info-label">Task Name:</span><span class="info-value">' || NEW.task_name || '</span></div>
            <div class="info-row"><span class="info-label">New Status:</span><span class="info-value">' || v_status_label || '</span></div>
            <div class="info-row"><span class="info-label">Updated Time:</span><span class="info-value">' || NOW()::text || '</span></div>'
            || CASE WHEN v_notes != '' THEN 
                '<div class="notes-section"><strong>💬 AR Notes:</strong><p style="margin-top: 10px;">' || v_notes || '</p></div>'
            ELSE '' END ||
            '</div>
        <div class="footer"><p>© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p></div>
    </div>
</body>
</html>';
            
            v_email_text := 'Task Status Update: ' || v_status_label || E'\n\n' ||
                'AR User: ' || COALESCE(v_ar_name, 'Unknown') || E'\n' ||
                'Project: ' || COALESCE(v_project_name, 'Unknown') || E'\n' ||
                'Task: ' || NEW.task_name || E'\n' ||
                'New Status: ' || v_status_label || E'\n' ||
                'Updated Time: ' || NOW()::text ||
                CASE WHEN v_notes != '' THEN E'\n\nAR Notes: ' || v_notes ELSE '' END;
            
            INSERT INTO public.email_notifications (
                recipient_email,
                email_type,
                subject,
                body_html,
                body_text,
                metadata
            ) VALUES (
                v_recipient_email,
                'task_status_change',
                v_email_subject,
                v_email_html,
                v_email_text,
                jsonb_build_object(
                    'task_id', NEW.task_id,
                    'project_id', NEW.project_id,
                    'assigned_ar_id', NEW.assigned_ar_id,
                    'task_name', NEW.task_name,
                    'project_name', v_project_name,
                    'ar_name', v_ar_name,
                    'status', NEW.task_status,
                    'notes', v_notes
                )
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$function$;

-- Update log_pm_assignment_email function
CREATE OR REPLACE FUNCTION public.log_pm_assignment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    v_project_name := NEW.project_name;
    
    IF TG_OP = 'INSERT' THEN
        IF NEW.project_manager_name IS NOT NULL AND NEW.project_manager_name != '' THEN
            v_should_send := TRUE;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.project_manager_name IS DISTINCT FROM NEW.project_manager_name AND
           NEW.project_manager_name IS NOT NULL AND NEW.project_manager_name != '' THEN
            v_should_send := TRUE;
        END IF;
    END IF;
    
    IF v_should_send THEN
        SELECT u.email, p.name INTO v_pm_email, v_pm_name
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.name = NEW.project_manager_name
        LIMIT 1;
        
        IF v_pm_email IS NOT NULL THEN
            v_start_date := COALESCE(NEW.start_date::TEXT, 'Not set');
            v_end_date := COALESCE(NEW.expected_end_date::TEXT, 'Not set');
            
            IF TG_OP = 'INSERT' THEN
                v_email_subject := 'New Project Assignment: ' || v_project_name;
            ELSE
                v_email_subject := 'Project Manager Assignment: ' || v_project_name;
            END IF;
            
            v_email_html := '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
        .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; }
        .label { font-weight: bold; color: #4F46E5; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">🎯 Project Manager Assignment</h1>
        </div>
        <div class="content">
            <p>Hello ' || COALESCE(v_pm_name, 'Project Manager') || ',</p>
            <p>You have been assigned as the Project Manager for:</p>
            
            <div class="detail-row">
                <span class="label">Project Name:</span> ' || v_project_name || '
            </div>
            
            <div class="detail-row">
                <span class="label">Start Date:</span> ' || v_start_date || '
            </div>
            
            <div class="detail-row">
                <span class="label">Expected End Date:</span> ' || v_end_date || '
            </div>
            
            <div class="detail-row">
                <span class="label">Difficulty Level:</span> ' || COALESCE(UPPER(NEW.difficulty_level), 'Not specified') || '
            </div>
            
            <div class="detail-row">
                <span class="label">Hours Allocated:</span> ' || COALESCE(NEW.hours_allocated::TEXT, 'Not specified') || ' hours
            </div>
            
            ' || CASE WHEN NEW.project_notes IS NOT NULL AND NEW.project_notes != '' THEN 
                '<div class="detail-row">
                    <span class="label">Project Notes:</span><br>' || NEW.project_notes || '
                </div>' 
                ELSE '' END || '
            
            <p style="margin-top: 20px;">Please review the project details and coordinate with your team to ensure successful completion.</p>
            
            <a href="https://app.zheight.tech/project-mgmt/setup/' || NEW.id || '" class="button">
                View Project Details →
            </a>
        </div>
        <div class="footer">
            <p>This is an automated notification from zHeight Project Management System</p>
        </div>
    </div>
</body>
</html>';
            
            v_email_text := 'Project Manager Assignment

Hello ' || COALESCE(v_pm_name, 'Project Manager') || ',

You have been assigned as the Project Manager for:

Project Name: ' || v_project_name || '
Start Date: ' || v_start_date || '
Expected End Date: ' || v_end_date || '
Difficulty Level: ' || COALESCE(UPPER(NEW.difficulty_level), 'Not specified') || '
Hours Allocated: ' || COALESCE(NEW.hours_allocated::TEXT, 'Not specified') || ' hours

' || CASE WHEN NEW.project_notes IS NOT NULL AND NEW.project_notes != '' THEN 
    'Project Notes: ' || NEW.project_notes || E'\n\n'
    ELSE '' END || '

Please review the project details and coordinate with your team to ensure successful completion.

---
This is an automated notification from zHeight Project Management System';
            
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
                    'pm_name', NEW.project_manager_name,
                    'trigger_operation', TG_OP
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Update process_pending_emails_batch function
CREATE OR REPLACE FUNCTION public.process_pending_emails_batch()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    processed_count INTEGER := 0;
    result json;
BEGIN
    BEGIN
        PERFORM net.http_post(
            url := 'https://tiiuowhbntuoepxpnobs.supabase.co/functions/v1/process-email-queue',
            headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaXVvd2hibnR1b2VweHBub2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MDY3ODAsImV4cCI6MjA3MTQ4Mjc4MH0.5CU1K-glTA2wtmZNlcNqs1wCZineMmMXUCVen77LmOA", "Content-Type": "application/json"}'::jsonb,
            body := '{}'::jsonb
        );
        
        processed_count := 1;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Email processing error: %', SQLERRM;
    END;
    
    result := json_build_object(
        'processed', processed_count,
        'timestamp', NOW(),
        'pending_count', (SELECT COUNT(*) FROM email_notifications WHERE status = 'pending')
    );
    
    RETURN result;
END;
$function$;

-- Update process_emails_safely function
CREATE OR REPLACE FUNCTION public.process_emails_safely()
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    v_result json;
    v_pending_count INTEGER;
BEGIN
    FOR i IN 1..10 LOOP
        SELECT COUNT(*) INTO v_pending_count
        FROM email_notifications
        WHERE status = 'pending';
        
        EXIT WHEN v_pending_count = 0;
        
        PERFORM process_pending_emails_batch();
        PERFORM pg_sleep(3);
    END LOOP;
    
    v_result := json_build_object(
        'processed', true,
        'remaining', (SELECT COUNT(*) FROM email_notifications WHERE status = 'pending')
    );
    
    RETURN v_result;
END;
$function$;

-- Update email_scheduler_with_delay function
CREATE OR REPLACE FUNCTION public.email_scheduler_with_delay()
RETURNS TABLE(batch_number integer, processed integer, pending integer, run_time timestamp without time zone)
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    batch_num INTEGER := 1;
    batch_result json;
    pending_count INTEGER;
BEGIN
    LOOP
        SELECT process_pending_emails_batch() INTO batch_result;
        
        SELECT COUNT(*) INTO pending_count 
        FROM email_notifications 
        WHERE status = 'pending';
        
        RETURN QUERY SELECT 
            batch_num, 
            (batch_result->>'processed')::INTEGER, 
            pending_count,
            NOW();
        
        EXIT WHEN pending_count = 0;
        PERFORM pg_sleep(5);
        batch_num := batch_num + 1;
        EXIT WHEN batch_num > 50;
    END LOOP;
    
    RETURN;
END;
$function$;

-- Update trigger_email_processing function  
CREATE OR REPLACE FUNCTION public.trigger_email_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/process-email-queue',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to trigger email processing: %', SQLERRM;
        RETURN NEW;
END;
$function$;