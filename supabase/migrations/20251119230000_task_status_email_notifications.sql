-- Add email notifications for task status changes (Started/Completed)
-- Sends email to Admin and Project Manager when AR user changes task status

-- Update the existing trigger function to handle status changes
CREATE OR REPLACE FUNCTION public.log_task_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
    v_project_name TEXT;
    v_ar_name TEXT;
    v_ar_email TEXT;
    v_admin_emails TEXT[];
    v_pm_emails TEXT[];
    v_all_recipient_emails TEXT[];
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_due_date_formatted TEXT;
    v_should_send BOOLEAN := FALSE;
    v_email_type TEXT;
    v_status_label TEXT;
    v_notes TEXT;
    v_recipient_email TEXT;
BEGIN
    -- Determine if we should send email and what type
    IF TG_OP = 'INSERT' THEN
        -- On INSERT: Send assignment email if both AR and due date are set
        IF NEW.assigned_ar_id IS NOT NULL AND NEW.due_date IS NOT NULL THEN
            v_should_send := TRUE;
            v_email_type := 'task_assignment';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- On UPDATE: Check for assignment changes OR status changes
        IF (NEW.assigned_ar_id IS NOT NULL AND NEW.due_date IS NOT NULL) AND
           (OLD.assigned_ar_id IS DISTINCT FROM NEW.assigned_ar_id OR 
            OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
            v_should_send := TRUE;
            v_email_type := 'task_assignment';
        -- Check for status changes to 'started' or 'completed'
        ELSIF OLD.task_status IS DISTINCT FROM NEW.task_status AND 
              (NEW.task_status = 'started' OR NEW.task_status = 'completed') THEN
            v_should_send := TRUE;
            v_email_type := 'task_status_change';
            v_status_label := CASE 
                WHEN NEW.task_status = 'started' THEN 'Started'
                WHEN NEW.task_status = 'completed' THEN 'Completed'
            END;
        END IF;
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
        
        -- Format due date
        v_due_date_formatted := NEW.due_date;
        
        -- Get notes if status changed
        v_notes := COALESCE(NEW.notes_tasks_ar, '');
        
        -- Determine recipients based on email type
        IF v_email_type = 'task_assignment' THEN
            -- Send to AR user for task assignment
            v_all_recipient_emails := ARRAY[v_ar_email];
        ELSIF v_email_type = 'task_status_change' THEN
            -- Send to Admin and PM for status changes
            -- Get all admin emails
            SELECT ARRAY_AGG(DISTINCT u.email)
            INTO v_admin_emails
            FROM public.user_roles ur
            JOIN auth.users u ON u.id = ur.user_id
            WHERE ur.role = 'admin';
            
            -- Get PM email from project
            SELECT ARRAY[u.email]
            INTO v_pm_emails
            FROM public.projects p
            JOIN auth.users u ON u.id = p.assigned_pm_id
            WHERE p.id = NEW.project_id AND p.assigned_pm_id IS NOT NULL;
            
            -- Combine admin and PM emails
            v_all_recipient_emails := COALESCE(v_admin_emails, ARRAY[]::TEXT[]) || COALESCE(v_pm_emails, ARRAY[]::TEXT[]);
        END IF;
        
        -- Loop through all recipients and create email for each
        FOREACH v_recipient_email IN ARRAY v_all_recipient_emails
        LOOP
            IF v_recipient_email IS NOT NULL THEN
                -- Create email subject
                IF v_email_type = 'task_assignment' THEN
                    v_email_subject := 'New Task Assignment: ' || NEW.task_name || ' - ' || v_project_name;
                ELSE
                    v_email_subject := 'Task ' || v_status_label || ': ' || NEW.task_name || ' - ' || v_project_name;
                END IF;
                
                -- Create HTML email body
                IF v_email_type = 'task_assignment' THEN
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
            <p>A new task has been assigned to you in the zHeight AI system.</p>
            <div class="info-row"><span class="info-label">Assigned To:</span><span class="info-value">' || COALESCE(v_ar_name, 'Unknown') || '</span></div>
            <div class="info-row"><span class="info-label">Project Name:</span><span class="info-value">' || COALESCE(v_project_name, 'Unknown') || '</span></div>
            <div class="info-row"><span class="info-label">Task Name:</span><span class="info-value">' || NEW.task_name || '</span></div>
            <div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">' || v_due_date_formatted || '</span></div>
            <div class="info-row"><span class="info-label">Assignment Time:</span><span class="info-value">' || TO_CHAR(NOW(), 'Day, Month DD, YYYY at HH24:MI:SS') || '</span></div>
        </div>
        <div class="footer"><p>© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p></div>
    </div>
</body>
</html>';
                ELSE
                    -- Status change email
                    v_email_html := '
<!DOCTYPE html>
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
            <div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">' || v_due_date_formatted || '</span></div>
            <div class="info-row"><span class="info-label">Updated Time:</span><span class="info-value">' || TO_CHAR(NOW(), 'Day, Month DD, YYYY at HH24:MI:SS') || '</span></div>'
            || CASE WHEN v_notes != '' THEN 
                '<div class="notes-section"><strong>💬 AR Notes:</strong><p style="margin-top: 10px;">' || v_notes || '</p></div>'
            ELSE '' END ||
        '</div>
        <div class="footer"><p>© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p></div>
    </div>
</body>
</html>';
                END IF;
                
                -- Create plain text version
                v_email_text := CASE 
                    WHEN v_email_type = 'task_assignment' THEN
                        'New Task Assignment' || E'\n\n' ||
                        'Assigned To: ' || COALESCE(v_ar_name, 'Unknown') || E'\n' ||
                        'Project: ' || COALESCE(v_project_name, 'Unknown') || E'\n' ||
                        'Task: ' || NEW.task_name || E'\n' ||
                        'Due Date: ' || v_due_date_formatted
                    ELSE
                        'Task Status Update: ' || v_status_label || E'\n\n' ||
                        'AR User: ' || COALESCE(v_ar_name, 'Unknown') || E'\n' ||
                        'Project: ' || COALESCE(v_project_name, 'Unknown') || E'\n' ||
                        'Task: ' || NEW.task_name || E'\n' ||
                        'New Status: ' || v_status_label || E'\n' ||
                        'Due Date: ' || v_due_date_formatted ||
                        CASE WHEN v_notes != '' THEN E'\n\nAR Notes: ' || v_notes ELSE '' END
                END;
                
                -- Insert into email notifications queue
                INSERT INTO public.email_notifications (
                    recipient_email,
                    email_type,
                    subject,
                    body_html,
                    body_text,
                    metadata
                ) VALUES (
                    v_recipient_email,
                    v_email_type,
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
                        'due_date', NEW.due_date,
                        'status', NEW.task_status,
                        'notes', v_notes
                    )
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Email notification logged for task: % (Type: %)', NEW.task_name, v_email_type;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_task_assignment_email() IS 'Logs task assignment and status change emails to notifications queue';
