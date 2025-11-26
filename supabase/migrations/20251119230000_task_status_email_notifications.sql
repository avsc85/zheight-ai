-- Add email notifications for task status changes (Started/Completed)
-- Sends email to Admin when task status changes to started or completed

-- Create separate function for task status change notifications
CREATE OR REPLACE FUNCTION public.log_task_status_update_email()
RETURNS TRIGGER AS $$
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
    -- This function ONLY handles status changes (started/completed)
    -- Status changes are only valid on UPDATE operations
    -- The WHEN clause in trigger ensures this is only called for status changes
    
    v_status_label := CASE 
        WHEN NEW.task_status = 'started' THEN 'Started'
        WHEN NEW.task_status = 'completed' THEN 'Completed'
    END;
        
    -- Get project name
    SELECT project_name INTO v_project_name
    FROM public.projects
    WHERE id = NEW.project_id;
    
    -- Get AR user name
    SELECT p.name INTO v_ar_name
    FROM public.profiles p
    WHERE p.user_id = NEW.assigned_ar_id;
    
    -- Get notes
    v_notes := COALESCE(NEW.notes_tasks_ar, '');
    
    -- Get all admin emails
    SELECT ARRAY_AGG(DISTINCT u.email)
    INTO v_admin_emails
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role = 'admin';
    
    v_all_recipient_emails := COALESCE(v_admin_emails, ARRAY[]::TEXT[]);
    
    -- Loop through all admin recipients and create email for each
    FOREACH v_recipient_email IN ARRAY v_all_recipient_emails
    LOOP
        IF v_recipient_email IS NOT NULL THEN
            v_email_subject := 'Task ' || v_status_label || ': ' || NEW.task_name || ' - ' || v_project_name;
            
            -- Create HTML email body for status update
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
            <div class="info-row"><span class="info-label">Updated Time:</span><span class="info-value">' || NOW()::text || '</span></div>'
            || CASE WHEN v_notes != '' THEN 
                '<div class="notes-section"><strong>💬 AR Notes:</strong><p style="margin-top: 10px;">' || v_notes || '</p></div>'
            ELSE '' END ||
            '</div>
        <div class="footer"><p>© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p></div>
    </div>
</body>
</html>';
            
            -- Create plain text version
            v_email_text := 'Task Status Update: ' || v_status_label || E'\n\n' ||
                'AR User: ' || COALESCE(v_ar_name, 'Unknown') || E'\n' ||
                'Project: ' || COALESCE(v_project_name, 'Unknown') || E'\n' ||
                'Task: ' || NEW.task_name || E'\n' ||
                'New Status: ' || v_status_label || E'\n' ||
                'Updated Time: ' || NOW()::text ||
                CASE WHEN v_notes != '' THEN E'\n\nAR Notes: ' || v_notes ELSE '' END;
            
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
    
    RAISE NOTICE 'Email notification logged for task status update: % (Status: %)', NEW.task_name, v_status_label;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_task_status_update_email() IS 'Logs task status change emails to notifications queue';

-- Drop old trigger if it exists and create new one for status updates only
DROP TRIGGER IF EXISTS trigger_task_status_update_email ON public.project_tasks;
CREATE TRIGGER trigger_task_status_update_email
    AFTER UPDATE ON public.project_tasks
    FOR EACH ROW
    WHEN (
        (OLD.task_status IS DISTINCT FROM NEW.task_status) AND
        (NEW.task_status = 'started' OR NEW.task_status = 'completed')
    )
    EXECUTE FUNCTION public.log_task_status_update_email();
