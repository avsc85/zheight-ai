-- Add email notifications for project manager assignments
-- Sends email to PM when assigned to a new project or when PM is changed

-- Function to create project manager assignment email notification
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
            
            -- Create email subject
            IF TG_OP = 'INSERT' THEN
                v_email_subject := 'New Project Assignment: ' || v_project_name;
            ELSE
                v_email_subject := 'Project Manager Assignment: ' || v_project_name;
            END IF;
            
            -- Create HTML email body
            v_email_html := '
<!DOCTYPE html>
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
            
            <a href="' || COALESCE(current_setting('app.base_url', true), 'https://zheight.tech') || '/project-mgmt/setup/' || NEW.id || '" class="button">
                View Project Details →
            </a>
        </div>
        <div class="footer">
            <p>This is an automated notification from zHeight Project Management System</p>
        </div>
    </div>
</body>
</html>
';
            
            -- Create plain text email body
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
            
            -- Insert email notification
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project manager assignments
DROP TRIGGER IF EXISTS trigger_log_pm_assignment_email ON public.projects;
CREATE TRIGGER trigger_log_pm_assignment_email
    AFTER INSERT OR UPDATE OF project_manager_name ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.log_pm_assignment_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.log_pm_assignment_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_pm_assignment_email() TO service_role;
