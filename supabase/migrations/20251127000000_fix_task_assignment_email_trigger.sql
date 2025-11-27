-- Migration: Fix task assignment email trigger to prevent duplicate emails
-- Date: 2025-11-27
-- Issue: Old AR was receiving emails when new AR assigned
-- Fix: More explicit AR change detection and safety checks

-- Drop and recreate the function with improved logic
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
    -- Determine if we should send email based on operation
    IF TG_OP = 'INSERT' THEN
        -- On INSERT: Send if both AR and due date are set
        v_should_send := (NEW.assigned_ar_id IS NOT NULL AND NEW.due_date IS NOT NULL);
    ELSIF TG_OP = 'UPDATE' THEN
        -- On UPDATE: Send ONLY if AR actually changed
        -- Use IS DISTINCT FROM to handle NULL cases properly
        -- This will be TRUE only when the AR ID actually changes
        IF (OLD.assigned_ar_id IS DISTINCT FROM NEW.assigned_ar_id) AND NEW.assigned_ar_id IS NOT NULL THEN
            v_should_send := TRUE;
            RAISE NOTICE 'AR changed from % to % for task %', OLD.assigned_ar_id, NEW.assigned_ar_id, NEW.task_id;
        ELSE
            v_should_send := FALSE;
            RAISE NOTICE 'AR not changed (OLD: %, NEW: %) - skipping email for task %', OLD.assigned_ar_id, NEW.assigned_ar_id, NEW.task_id;
        END IF;
    END IF;
    
    -- Only process if conditions met
    IF v_should_send THEN
        
        -- Get project name
        SELECT project_name INTO v_project_name
        FROM public.projects
        WHERE id = NEW.project_id;
        
        -- Get AR user name and email (ONLY the NEW assigned AR)
        -- This query ONLY fetches the NEW AR, not the old one
        SELECT p.name, u.email INTO v_ar_name, v_ar_email
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.user_id = NEW.assigned_ar_id;
        
        -- Additional safety check: Ensure we got valid email
        IF v_ar_email IS NULL THEN
            RAISE WARNING 'Could not find email for AR ID: %', NEW.assigned_ar_id;
            RETURN NEW;
        END IF;
        
        -- Format due date (due_date is already stored as text/varchar)
        v_due_date_formatted := NEW.due_date;
    
    -- Create email subject
    v_email_subject := 'New Task Assignment: ' || NEW.task_name || ' - ' || v_project_name;
    
    -- Create HTML email body
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
            'old_ar_id', OLD.assigned_ar_id,  -- Track old AR for debugging
            'task_name', NEW.task_name,
            'project_name', v_project_name,
            'ar_name', v_ar_name,
            'ar_email', v_ar_email,  -- Track email for debugging
            'due_date', NEW.due_date,
            'trigger_operation', TG_OP  -- Track INSERT vs UPDATE
        )
        );
        
        -- Log for debugging
        RAISE NOTICE 'Email notification logged for task: % (Project: %) assigned to % (%)', NEW.task_name, v_project_name, v_ar_name, v_ar_email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_task_assignment_email() IS 'Logs task assignment emails - FIXED: Only sends to NEW AR when AR changes';
