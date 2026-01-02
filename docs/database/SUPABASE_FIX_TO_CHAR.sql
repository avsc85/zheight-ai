-- FIX: Replace TO_CHAR() function calls in trigger functions
-- This fixes the PostgreSQL error: "function to_char(text, unknown) does not exist"
-- Run this in Supabase SQL Editor to fix production database

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_task_assignment_email ON public.project_tasks;
DROP TRIGGER IF EXISTS trigger_task_status_update_email ON public.project_tasks;
DROP FUNCTION IF EXISTS public.log_task_assignment_email();
DROP FUNCTION IF EXISTS public.log_task_status_update_email();

-- ================================================================
-- RECREATE: Task Assignment Email Notification Function (FIXED)
-- ================================================================
CREATE OR REPLACE FUNCTION public.log_task_assignment_email()
RETURNS TRIGGER AS $$
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
    -- Determine if we should send email
    IF TG_OP = 'INSERT' THEN
        -- On INSERT: Send if both AR and due date are set
        v_should_send := (NEW.assigned_ar_id IS NOT NULL AND NEW.due_date IS NOT NULL);
    ELSIF TG_OP = 'UPDATE' THEN
        -- On UPDATE: Send ONLY if AR changed (not just due date)
        v_should_send := (
            NEW.assigned_ar_id IS NOT NULL AND 
            OLD.assigned_ar_id IS DISTINCT FROM NEW.assigned_ar_id
        );
    END IF;
    
    -- Only process if conditions met
    IF v_should_send THEN
        
        -- Get project name
        SELECT project_name INTO v_project_name
        FROM public.projects
        WHERE id = NEW.project_id;
        
        -- Get AR user name and email
        SELECT p.name, u.email INTO v_ar_name, v_ar_email
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.user_id = NEW.assigned_ar_id;
        
        -- Format due date (due_date is already stored as text/varchar)
        v_due_date_formatted := NEW.due_date;
        
        -- Create email subject
        v_email_subject := 'New Task Assignment: ' || NEW.task_name || ' - ' || v_project_name;
        
        -- Create HTML email body (FIXED: Removed TO_CHAR, using NOW()::text instead)
        v_email_html := '
<!DOCTYPE html>
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
            <h1>🔔 New Task Assignment Notification</h1>
        </div>
        <div class="content">
            <p>Hello ' || COALESCE(v_ar_name, 'User') || ',</p>
            <p>A new task has been assigned to you in the zHeight AI system. Here are the details:</p>
            
            <div class="info-row">
                <span class="info-label">Assigned To:</span>
                <span class="info-value">' || COALESCE(v_ar_name, 'Unknown') || '</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Project Name:</span>
                <span class="info-value">' || COALESCE(v_project_name, 'Unknown') || '</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Task Name:</span>
                <span class="info-value">' || NEW.task_name || '</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Due Date:</span>
                <span class="info-value">' || v_due_date_formatted || '</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Assignment Time:</span>
                <span class="info-value">' || NOW()::text || '</span>
            </div>
            
            <p style="margin-top: 30px;">This is an automated notification from the zHeight AI project management system.</p>
        </div>
        <div class="footer">
            <p>© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>';
        
        -- Create plain text version
        v_email_text := 'New Task Assignment Notification

Hello ' || COALESCE(v_ar_name, 'User') || ',

A new task has been assigned to you in the zHeight AI system.

Assigned To: ' || COALESCE(v_ar_name, 'Unknown') || '
Project Name: ' || COALESCE(v_project_name, 'Unknown') || '
Task Name: ' || NEW.task_name || '
Due Date: ' || v_due_date_formatted || '
Assignment Time: ' || NOW()::text || '

This is an automated notification from the zHeight AI project management system.';
        
        -- Insert into email notifications queue
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
        
        -- Log for debugging
        RAISE NOTICE 'Email notification logged for task: % (Project: %)', NEW.task_name, v_project_name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for task assignment
CREATE TRIGGER trigger_task_assignment_email
    AFTER INSERT OR UPDATE ON public.project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.log_task_assignment_email();


-- ================================================================
-- RECREATE: Task Status Update Email Function (FIXED)
-- ================================================================
CREATE OR REPLACE FUNCTION public.log_task_status_update_email()
RETURNS TRIGGER AS $$
DECLARE
    v_ar_name TEXT;
    v_ar_email TEXT;
    v_pm_name TEXT;
    v_pm_email TEXT;
    v_project_name TEXT;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_status_label TEXT;
    v_admin_email TEXT;
BEGIN
    -- Only send if task status changed
    IF TG_OP = 'UPDATE' AND OLD.task_status IS DISTINCT FROM NEW.task_status THEN
        IF NEW.assigned_ar_id IS NOT NULL THEN
            
            -- Get AR user name and email
            SELECT p.name, u.email INTO v_ar_name, v_ar_email
            FROM public.profiles p
            JOIN auth.users u ON u.id = p.user_id
            WHERE p.user_id = NEW.assigned_ar_id;
            
            -- Get project name and PM name
            SELECT project_name, project_manager_name INTO v_project_name, v_pm_name
            FROM public.projects
            WHERE id = NEW.project_id;
            
            -- Get PM email if PM exists
            IF v_pm_name IS NOT NULL AND v_pm_name != '' THEN
                SELECT u.email INTO v_pm_email
                FROM public.profiles p
                JOIN auth.users u ON u.id = p.user_id
                WHERE p.name = v_pm_name
                LIMIT 1;
            END IF;
            
            -- Get first admin email
            SELECT u.email INTO v_admin_email
            FROM public.user_roles ur
            JOIN auth.users u ON u.id = ur.user_id
            WHERE ur.role = 'admin'
            LIMIT 1;
            
            -- Get status label
            v_status_label := CASE WHEN NEW.task_status = 'started' THEN 'Started' ELSE 'Completed' END;
            
            -- Create email subject and body
            v_email_subject := 'Task Status Updated: ' || v_status_label || ' - ' || NEW.task_name;
            
            v_email_html := '<html><body><p>Hello,</p>' ||
                '<p>Task Status has been updated</p>' ||
                '<p><strong>Task:</strong> ' || NEW.task_name || '</p>' ||
                '<p><strong>Project:</strong> ' || COALESCE(v_project_name, 'N/A') || '</p>' ||
                '<p><strong>Status:</strong> ' || v_status_label || '</p>' ||
                '<p><strong>Assigned To:</strong> ' || COALESCE(v_ar_name, 'N/A') || '</p>' ||
                '<p><strong>Due Date:</strong> ' || NEW.due_date || '</p>' ||
                '<p><strong>Updated At:</strong> ' || NOW()::text || '</p></body></html>';
            
            v_email_text := 'Task Status Updated' || CHR(10) ||
                'Task: ' || NEW.task_name || CHR(10) ||
                'Project: ' || COALESCE(v_project_name, 'N/A') || CHR(10) ||
                'Status: ' || v_status_label || CHR(10) ||
                'Assigned To: ' || COALESCE(v_ar_name, 'N/A') || CHR(10) ||
                'Due Date: ' || NEW.due_date || CHR(10) ||
                'Updated At: ' || NOW()::text;
            
            -- IF PM exists - send to AR, PM, and Admin (all 3)
            IF v_pm_email IS NOT NULL THEN
                -- Send email to AR
                IF v_ar_email IS NOT NULL THEN
                    INSERT INTO public.email_notifications (
                        recipient_email,
                        email_type,
                        subject,
                        body_html,
                        body_text,
                        metadata
                    ) VALUES (
                        v_ar_email,
                        'task_status_update',
                        v_email_subject,
                        v_email_html,
                        v_email_text,
                        jsonb_build_object(
                            'task_id', NEW.task_id,
                            'project_id', NEW.project_id,
                            'status', NEW.task_status,
                            'recipient', 'AR'
                        )
                    );
                END IF;
                
                -- Send email to PM if different from AR
                IF v_pm_email != v_ar_email THEN
                    INSERT INTO public.email_notifications (
                        recipient_email,
                        email_type,
                        subject,
                        body_html,
                        body_text,
                        metadata
                    ) VALUES (
                        v_pm_email,
                        'task_status_update',
                        v_email_subject,
                        v_email_html,
                        v_email_text,
                        jsonb_build_object(
                            'task_id', NEW.task_id,
                            'project_id', NEW.project_id,
                            'status', NEW.task_status,
                            'recipient', 'PM'
                        )
                    );
                END IF;
                
                -- Send email to admin if different from AR and PM
                IF v_admin_email IS NOT NULL AND v_admin_email != v_ar_email AND v_admin_email != v_pm_email THEN
                    INSERT INTO public.email_notifications (
                        recipient_email,
                        email_type,
                        subject,
                        body_html,
                        body_text,
                        metadata
                    ) VALUES (
                        v_admin_email,
                        'task_status_update',
                        v_email_subject,
                        v_email_html,
                        v_email_text,
                        jsonb_build_object(
                            'task_id', NEW.task_id,
                            'project_id', NEW.project_id,
                            'status', NEW.task_status,
                            'recipient', 'ADMIN'
                        )
                    );
                END IF;
            ELSE
                -- IF PM is NULL - send ONLY to Admin (no AR, no PM)
                IF v_admin_email IS NOT NULL THEN
                    INSERT INTO public.email_notifications (
                        recipient_email,
                        email_type,
                        subject,
                        body_html,
                        body_text,
                        metadata
                    ) VALUES (
                        v_admin_email,
                        'task_status_update',
                        v_email_subject,
                        v_email_html,
                        v_email_text,
                        jsonb_build_object(
                            'task_id', NEW.task_id,
                            'project_id', NEW.project_id,
                            'status', NEW.task_status,
                            'recipient', 'ADMIN_ONLY',
                            'note', 'PM not assigned'
                        )
                    );
                END IF;
            END IF;
            
            RAISE NOTICE 'Status update emails logged for task: %', NEW.task_name;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for task status updates
CREATE TRIGGER trigger_task_status_update_email
    AFTER UPDATE ON public.project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.log_task_status_update_email();


-- Grant permissions
GRANT SELECT ON public.email_notifications TO authenticated;
GRANT INSERT ON public.email_notifications TO authenticated;

-- Test: Log a notice to confirm execution
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: TO_CHAR() functions have been fixed in trigger functions!';
END $$;
