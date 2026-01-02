-- Migration: Update email trigger to send when due_date changes too
-- Date: 2025-11-27
-- Issue: Emails should be sent when either AR or due_date changes

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
    v_change_type TEXT := '';
BEGIN
    -- Determine if we should send email based on operation
    IF TG_OP = 'INSERT' THEN
        -- On INSERT: Send if both AR and due date are set
        v_should_send := (NEW.assigned_ar_id IS NOT NULL AND NEW.due_date IS NOT NULL);
        v_change_type := 'new_assignment';
    ELSIF TG_OP = 'UPDATE' THEN
        -- On UPDATE: Send if AR changed OR due_date changed
        IF (OLD.assigned_ar_id IS DISTINCT FROM NEW.assigned_ar_id) AND NEW.assigned_ar_id IS NOT NULL THEN
            v_should_send := TRUE;
            v_change_type := 'ar_changed';
            RAISE NOTICE 'AR changed from % to % for task %', OLD.assigned_ar_id, NEW.assigned_ar_id, NEW.task_id;
        ELSIF (OLD.due_date IS DISTINCT FROM NEW.due_date) AND NEW.due_date IS NOT NULL AND NEW.assigned_ar_id IS NOT NULL THEN
            v_should_send := TRUE;
            v_change_type := 'due_date_changed';
            RAISE NOTICE 'Due date changed from % to % for task %', OLD.due_date, NEW.due_date, NEW.task_id;
        ELSE
            v_should_send := FALSE;
            RAISE NOTICE 'No relevant changes (AR: % -> %, Due: % -> %) - skipping email for task %', 
                OLD.assigned_ar_id, NEW.assigned_ar_id, OLD.due_date, NEW.due_date, NEW.task_id;
        END IF;
    END IF;
    
    -- Only process if conditions met
    IF v_should_send THEN
        
        -- Get project name
        SELECT project_name INTO v_project_name
        FROM public.projects
        WHERE id = NEW.project_id;
        
        -- Get AR user name and email (ONLY the NEW assigned AR)
        SELECT p.name, u.email INTO v_ar_name, v_ar_email
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.user_id = NEW.assigned_ar_id;
        
        -- Additional safety check: Ensure we got valid email
        IF v_ar_email IS NULL THEN
            RAISE WARNING 'Could not find email for AR ID: %', NEW.assigned_ar_id;
            RETURN NEW;
        END IF;
        
        -- Format due date
        v_due_date_formatted := NEW.due_date;
    
    -- Create email subject based on change type
    IF v_change_type = 'due_date_changed' THEN
        v_email_subject := 'Due Date Updated: ' || NEW.task_name || ' - ' || v_project_name;
    ELSE
        v_email_subject := 'New Task Assignment: ' || NEW.task_name || ' - ' || v_project_name;
    END IF;
    
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
            <h1>🔔 Task Update Notification</h1>
        </div>
        <div class="content">
            <p>Hello ' || COALESCE(v_ar_name, 'User') || ',</p>
            <p>' || 
            CASE 
                WHEN v_change_type = 'due_date_changed' THEN 'The due date for your assigned task has been updated.'
                ELSE 'A new task has been assigned to you in the zHeight AI system.'
            END || '</p>
            
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
            </div>' ||
            CASE 
                WHEN v_change_type = 'due_date_changed' AND OLD.due_date IS NOT NULL THEN
                    '<div class="info-row" style="border-left-color: #FF9800;">
                        <span class="info-label">Previous Due Date:</span>
                        <span class="info-value">' || OLD.due_date || '</span>
                    </div>'
                ELSE ''
            END || '
            
            <div class="info-row">
                <span class="info-label">Update Time:</span>
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
    v_email_text := 'Task Update Notification

Hello ' || COALESCE(v_ar_name, 'User') || ',

' || 
CASE 
    WHEN v_change_type = 'due_date_changed' THEN 'The due date for your assigned task has been updated.'
    ELSE 'A new task has been assigned to you in the zHeight AI system.'
END || '

Assigned To: ' || COALESCE(v_ar_name, 'Unknown') || '
Project Name: ' || COALESCE(v_project_name, 'Unknown') || '
Task Name: ' || NEW.task_name || '
Due Date: ' || v_due_date_formatted || 
CASE 
    WHEN v_change_type = 'due_date_changed' AND OLD.due_date IS NOT NULL THEN '
Previous Due Date: ' || OLD.due_date
    ELSE ''
END || '
Update Time: ' || NOW()::text || '

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
            'old_ar_id', OLD.assigned_ar_id,
            'task_name', NEW.task_name,
            'project_name', v_project_name,
            'ar_name', v_ar_name,
            'ar_email', v_ar_email,
            'due_date', NEW.due_date,
            'old_due_date', OLD.due_date,
            'change_type', v_change_type,
            'trigger_operation', TG_OP
        )
    );
        
    -- Log for debugging
    RAISE NOTICE 'Email notification logged for task: % (Project: %) - Change: % - To: % (%)', 
        NEW.task_name, v_project_name, v_change_type, v_ar_name, v_ar_email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.log_task_assignment_email() IS 'Logs task assignment/update emails - sends when AR or due_date changes';