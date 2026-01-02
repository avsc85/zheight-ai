-- Enhanced Migration: Daily Task Digest Email with Dynamic Content and Motivational Quotes
-- Date: 2025-12-15
-- Feature: Send email at 9:00 AM IST (03:30 UTC) daily with:
--          - More dynamic content based on task status
--          - Motivational quotes
--          - Improved visual hierarchy
--          - Personalized greetings based on time of day

-- First, create motivational quotes table
CREATE TABLE IF NOT EXISTS public.motivational_quotes (
    id SERIAL PRIMARY KEY,
    quote TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add sample quotes
INSERT INTO public.motivational_quotes (quote, author, category) VALUES
('The only way to do great work is to love what you do.', 'Steve Jobs', 'inspiration'),
('Success is not final, failure is not fatal: It is the courage to continue that counts.', 'Winston Churchill', 'perseverance'),
('Your time is limited, so don''t waste it living someone else''s life.', 'Steve Jobs', 'motivation'),
('The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt', 'dreams'),
('Don''t watch the clock; do what it does. Keep going.', 'Sam Levenson', 'productivity'),
('The secret of getting ahead is getting started.', 'Mark Twain', 'action'),
('Quality is not an act, it is a habit.', 'Aristotle', 'excellence'),
('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb', 'timing'),
('Excellence is not a skill, it''s an attitude.', 'Ralph Marston', 'excellence'),
('Every accomplishment starts with the decision to try.', 'Unknown', 'motivation')
ON CONFLICT DO NOTHING;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.generate_daily_task_digest();

-- Create enhanced function
CREATE OR REPLACE FUNCTION public.generate_daily_task_digest()
RETURNS void AS $$
DECLARE
    v_ar RECORD;
    v_pm RECORD;
    v_task RECORD;
    v_project RECORD;
    v_task_count INTEGER;
    v_today DATE := CURRENT_DATE;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_task_rows_html TEXT := '';
    v_task_rows_text TEXT := '';
    v_urgent_count INTEGER := 0;
    v_pm_projects_count INTEGER := 0;
    v_pm_total_tasks INTEGER := 0;
    v_pm_urgent_tasks INTEGER := 0;
    v_quote TEXT;
    v_author TEXT;
    v_greeting TEXT;
    v_hour INTEGER;
    v_task_status_summary JSONB;
BEGIN
    -- Get current hour for personalized greeting (IST timezone)
    v_hour := EXTRACT(HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata');

    -- Set greeting based on time of day
    IF v_hour < 12 THEN
        v_greeting := 'Good Morning';
    ELSIF v_hour < 17 THEN
        v_greeting := 'Good Afternoon';
    ELSE
        v_greeting := 'Good Evening';
    END IF;

    -- Get a random motivational quote
    SELECT quote, author INTO v_quote, v_author
    FROM public.motivational_quotes
    ORDER BY RANDOM()
    LIMIT 1;

    -- If quotes table doesn't exist or is empty, use default
    IF v_quote IS NULL THEN
        v_quote := 'The secret of getting ahead is getting started.';
        v_author := 'Mark Twain';
    END IF;

    -- =====================================================
    -- PART 1: Generate AR Daily Digests
    -- =====================================================
    FOR v_ar IN
        SELECT DISTINCT
            p.user_id,
            p.name as ar_name,
            u.email as ar_email,
            ur.role as ar_role
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE ur.role IN ('ar1_planning', 'ar2_field')
        AND u.email IS NOT NULL
    LOOP
        -- Reset variables for each AR
        v_task_rows_html := '';
        v_task_rows_text := '';
        v_task_count := 0;
        v_urgent_count := 0;

        -- Get task status summary for this AR
        SELECT jsonb_build_object(
            'in_queue', COUNT(*) FILTER (WHERE task_status = 'in_queue'),
            'started', COUNT(*) FILTER (WHERE task_status = 'started'),
            'completed_today', COUNT(*) FILTER (WHERE task_status = 'completed' AND updated_at::date = v_today)
        ) INTO v_task_status_summary
        FROM public.project_tasks
        WHERE assigned_ar_id = v_ar.user_id
        AND task_status IN ('in_queue', 'started', 'completed');

        -- Get all pending tasks for this AR
        FOR v_task IN
            SELECT
                pt.task_id,
                pt.task_name,
                pt.due_date,
                pt.task_status,
                proj.project_name,
                pt.priority,
                CASE
                    WHEN pt.due_date::date = v_today THEN true
                    ELSE false
                END as is_due_today,
                (pt.due_date::date - v_today) as days_until_due,
                COALESCE(pt.progress, 0) as progress
            FROM public.project_tasks pt
            JOIN public.projects proj ON proj.id = pt.project_id
            WHERE pt.assigned_ar_id = v_ar.user_id
            AND pt.task_status IN ('in_queue', 'started')
            AND pt.due_date IS NOT NULL
            ORDER BY
                CASE WHEN pt.due_date::date = v_today THEN 0 ELSE 1 END,
                pt.due_date::date ASC,
                CASE pt.priority
                    WHEN 'high' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'low' THEN 2
                    ELSE 3
                END,
                pt.task_name ASC
        LOOP
            v_task_count := v_task_count + 1;

            IF v_task.is_due_today THEN
                v_urgent_count := v_urgent_count + 1;
            END IF;

            -- Build HTML rows (same as original but with enhanced styling)
            IF v_task.is_due_today THEN
                v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: #ffebee; border-left: 5px solid #d32f2f;">
                    <td style="padding: 15px; border-bottom: 1px solid #ddd;">
                        <strong style="color: #d32f2f; font-size: 16px;">⚠️ ' || v_task.task_name || '</strong>
                        ' || CASE WHEN v_task.progress > 0 THEN '<div style="margin-top: 5px; height: 4px; background-color: #e0e0e0; border-radius: 2px; overflow: hidden;">
                            <div style="height: 100%; width: ' || v_task.progress || '%; background-color: #4caf50; border-radius: 2px;"></div>
                        </div>' ELSE '' END || '
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: #ff5252; color: white; padding: 8px 12px; border-radius: 4px; font-weight: bold;">
                            📅 DUE TODAY
                        </span>
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: ' || 
                        CASE v_task.task_status
                            WHEN 'started' THEN '#2196F3'
                            ELSE '#9E9E9E'
                        END || '; color: white; padding: 5px 10px; border-radius: 3px;">' ||
                        CASE v_task.task_status
                            WHEN 'in_queue' THEN 'In Queue'
                            WHEN 'started' THEN 'Started (' || v_task.progress || '%)'
                        END || '</span>
                    </td>
                </tr>';

                v_task_rows_text := v_task_rows_text || '
⚠️ **DUE TODAY** - ' || v_task.task_name || '
   Project: ' || v_task.project_name || '
   Deadline: ' || v_task.due_date || ' (TODAY!)
   Status: ' || CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started (' || v_task.progress || '%)' END || '
';
            ELSE
                v_task_rows_html := v_task_rows_html || '
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.task_name || '
                        ' || CASE WHEN v_task.progress > 0 THEN '<div style="margin-top: 5px; height: 4px; background-color: #e0e0e0; border-radius: 2px;">
                            <div style="height: 100%; width: ' || v_task.progress || '%; background-color: #4caf50; border-radius: 2px;"></div>
                        </div>' ELSE '' END || '
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">' || v_task.due_date ||
                        CASE
                            WHEN v_task.days_until_due = 1 THEN ' <span style="color: #ff9800;">(Tomorrow)</span>'
                            WHEN v_task.days_until_due <= 3 THEN ' <span style="color: #ff9800;">(In ' || v_task.days_until_due || ' days)</span>'
                            ELSE ''
                        END ||
                    '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: ' || 
                        CASE v_task.task_status WHEN 'started' THEN '#2196F3' ELSE '#9E9E9E' END || '; color: white; padding: 5px 10px; border-radius: 3px;">' ||
                        CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started (' || v_task.progress || '%)' END || '</span>
                    </td>
                </tr>';

                v_task_rows_text := v_task_rows_text || '
- ' || v_task.task_name || '
  Project: ' || v_task.project_name || ' | Due: ' || v_task.due_date || ' | Status: ' || 
  CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started (' || v_task.progress || '%)' END;
            END IF;
        END LOOP;

        -- Only send if tasks exist
        IF v_task_count > 0 THEN
            v_email_subject := CASE
                WHEN v_urgent_count > 0 THEN '🚨 '
                ELSE '📝 '
            END || 'Daily Task Digest - ' || v_task_count || ' Task' || 
                CASE WHEN v_task_count > 1 THEN 's' ELSE '' END ||
                CASE WHEN v_urgent_count > 0 THEN ' (' || v_urgent_count || ' DUE TODAY!)' ELSE '' END;

            v_email_html := '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .quote { background-color: #fff8e1; padding: 20px; border-left: 5px solid #ffc107; margin: 20px 0; border-radius: 5px; font-style: italic; }
        .summary { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .stat-box { background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-box h3 { margin: 0; font-size: 24px; color: #667eea; }
        .content { background-color: white; padding: 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #667eea; color: white; padding: 15px; text-align: left; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; color: #777; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Daily Task Digest</h1>
            <p>' || v_greeting || ', ' || v_ar.ar_name || '!</p>
        </div>

        <div class="quote">
            <p>"' || v_quote || '"</p>
            <p style="text-align: right; margin-top: 10px; font-style: normal; font-weight: bold;">- ' || v_author || '</p>
        </div>

        <div class="summary">
            <h2>📊 Today''s Summary</h2>
            <div class="stats">
                <div class="stat-box"><h3>' || v_task_count || '</h3><p>Pending Tasks</p></div>
                <div class="stat-box"><h3>' || v_task_status_summary->>'in_queue' || '</h3><p>In Queue</p></div>
                <div class="stat-box"><h3>' || v_task_status_summary->>'started' || '</h3><p>In Progress</p></div>
            </div>
            ' || CASE WHEN v_urgent_count > 0 THEN '<p style="color: #d32f2f; font-weight: bold;">⚠️ ' || v_urgent_count || ' task(s) due TODAY!</p>' ELSE '' END || '
        </div>

        <div class="content">
            <table>
                <thead>
                    <tr>
                        <th>Task Name</th>
                        <th>Project</th>
                        <th style="text-align: center;">Deadline</th>
                        <th style="text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>' || v_task_rows_html || '</tbody>
            </table>
        </div>

        <div class="footer">
            <p>This is an automated daily digest from zHeight AI</p>
            <p>Sent at 9:00 AM IST</p>
        </div>
    </div>
</body>
</html>';

            v_email_text := 'Daily Task Digest
' || v_greeting || ' ' || v_ar.ar_name || '

"' || v_quote || '"
- ' || v_author || '

SUMMARY:
Pending: ' || v_task_count || ' | In Queue: ' || v_task_status_summary->>'in_queue' || ' | In Progress: ' || v_task_status_summary->>'started' || '
' || CASE WHEN v_urgent_count > 0 THEN '⚠️ ' || v_urgent_count || ' task(s) due TODAY!
' ELSE '' END || '
YOUR TASKS:
' || v_task_rows_text;

            INSERT INTO public.email_notifications (
                recipient_email, email_type, subject, body_html, body_text,
                metadata
            ) VALUES (
                v_ar.ar_email, 'daily_task_digest', v_email_subject, v_email_html, v_email_text,
                jsonb_build_object('ar_id', v_ar.user_id, 'total_tasks', v_task_count, 'urgent_tasks', v_urgent_count)
            );

            RAISE NOTICE 'Digest queued for AR: % - % tasks', v_ar.ar_name, v_task_count;
        END IF;
    END LOOP;

    RAISE NOTICE 'Daily digest generation completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_daily_task_digest() IS 'Enhanced daily email digest with quotes and dynamic content';
