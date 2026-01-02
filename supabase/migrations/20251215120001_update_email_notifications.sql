-- Update email notification functions to remove references to removed fields
-- Date: 2025-12-15

-- Drop and recreate the PM email notification function without difficulty_level and project_notes
CREATE OR REPLACE FUNCTION send_project_manager_email()
RETURNS TRIGGER AS $$
DECLARE
  v_pm_email TEXT;
  v_start_date TEXT;
  v_end_date TEXT;
  v_html_content TEXT;
  v_plain_content TEXT;
BEGIN
  -- Get PM email from profiles if user_id exists
  IF NEW.user_id IS NOT NULL THEN
    SELECT email INTO v_pm_email
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;

  -- If no email found or no user_id, try to find email by manager name
  IF v_pm_email IS NULL AND NEW.project_manager_name IS NOT NULL THEN
    SELECT u.email INTO v_pm_email
    FROM auth.users u
    JOIN profiles p ON u.id = p.id
    WHERE p.name = NEW.project_manager_name
    LIMIT 1;
  END IF;

  -- Format dates
  v_start_date := COALESCE(TO_CHAR(NEW.start_date, 'Mon DD, YYYY'), 'Not specified');
  v_end_date := COALESCE(TO_CHAR(NEW.expected_end_date, 'Mon DD, YYYY'), 'Not specified');

  -- Build HTML email content (without difficulty_level and project_notes)
  v_html_content := '
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .detail-row { margin: 15px 0; padding: 10px; background: white; border-left: 4px solid #667eea; }
            .label { font-weight: bold; color: #667eea; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 New Project Assigned</h1>
            </div>
            
            <div class="content">
                <p>Hello ' || COALESCE(NEW.project_manager_name, 'Project Manager') || ',</p>
                
                <p>You have been assigned as the Project Manager for the following project:</p>
                
                <div class="detail-row">
                    <span class="label">Project Name:</span> ' || NEW.project_name || '
                </div>
                
                <div class="detail-row">
                    <span class="label">Start Date:</span> ' || v_start_date || '
                </div>
                
                <div class="detail-row">
                    <span class="label">Expected End Date:</span> ' || v_end_date || '
                </div>
                
                <div class="detail-row">
                    <span class="label">Hours Allocated:</span> ' || COALESCE(NEW.hours_allocated::TEXT, 'Not specified') || ' hours
                </div>
                
                <p style="margin-top: 20px;">Please review the project details and coordinate with your team to ensure successful completion.</p>
                
                <div class="footer">
                    <p>This is an automated notification from zHeight Project Management System</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  ';

  -- Build plain text content (without difficulty_level and project_notes)
  v_plain_content := 'New Project Assigned

Hello ' || COALESCE(NEW.project_manager_name, 'Project Manager') || ',

You have been assigned as the Project Manager for the following project:

Project Name: ' || NEW.project_name || '
Start Date: ' || v_start_date || '
Expected End Date: ' || v_end_date || '
Hours Allocated: ' || COALESCE(NEW.hours_allocated::TEXT, 'Not specified') || ' hours

Please review the project details and coordinate with your team to ensure successful completion.

---
This is an automated notification from zHeight Project Management System';

  -- Send email if PM email exists
  IF v_pm_email IS NOT NULL THEN
    PERFORM
      net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.resend_api_key', true)
        ),
        body := jsonb_build_object(
          'from', 'zHeight Projects <projects@zheight.com>',
          'to', ARRAY[v_pm_email],
          'subject', '🎯 New Project Assignment: ' || NEW.project_name,
          'html', v_html_content,
          'text', v_plain_content
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
