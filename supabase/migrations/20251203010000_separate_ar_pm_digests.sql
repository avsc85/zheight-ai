-- Migration: Separate AR and PM Daily Digests with Different Triggers
-- Date: 2025-12-03
-- Purpose: Send AR digest at 9:00 AM IST, PM digest at 9:30 AM IST (separate emails)

-- Function to generate AR-only daily digests
CREATE OR REPLACE FUNCTION public.generate_ar_daily_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ar RECORD;
    v_task RECORD;
    v_today DATE;
    v_task_count INT;
    v_urgent_count INT;
    v_task_rows_html TEXT;
    v_task_rows_text TEXT;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
BEGIN
    v_today := CURRENT_DATE;

    -- PART 1: Generate AR Daily Digests (Users with ar1_planning or ar2_field roles)
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

        -- Get all pending tasks assigned to this AR
        FOR v_task IN
            SELECT 
                pt.task_id,
                pt.task_name,
                pt.due_date,
                pt.task_status,
                proj.project_name,
                CASE 
                    WHEN pt.due_date::date = v_today THEN true
                    ELSE false
                END as is_due_today,
                (pt.due_date::date - v_today) as days_until_due
            FROM public.project_tasks pt
            JOIN public.projects proj ON proj.id = pt.project_id
            WHERE pt.assigned_ar_id = v_ar.user_id
            AND pt.task_status IN ('in_queue', 'started')
            AND pt.due_date IS NOT NULL
            AND (pt.updated_at IS NULL OR pt.updated_at < NOW() - INTERVAL '12 hours')
            ORDER BY pt.due_date::date ASC, pt.task_name ASC
        LOOP
            v_task_count := v_task_count + 1;

            IF v_task.is_due_today THEN
                v_urgent_count := v_urgent_count + 1;
            END IF;

            -- Build HTML row (RED BOLD for today's deadline)
            IF v_task.is_due_today THEN
                v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: #ffebee; border-left: 5px solid #d32f2f;">
                    <td style="padding: 12px 12px 12px 30px; border-bottom: 1px solid #ddd;">
                        <strong style="color: #d32f2f;">⚠️ ' || v_task.task_name || '</strong>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: #ff5252; color: white; padding: 6px 10px; border-radius: 4px; font-weight: bold; font-size: 13px;">
                            📅 DUE TODAY
                        </span>
                    </td>
                </tr>';
                
                v_task_rows_text := v_task_rows_text || '⚠️ ' || v_task.task_name || ' [' || v_task.project_name || '] - DUE TODAY' || CHR(10);
            ELSE
                v_task_rows_html := v_task_rows_html || '
                <tr>
                    <td style="padding: 12px 12px 12px 30px; border-bottom: 1px solid #ddd;">' || v_task.task_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: #FFA500; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px;">
                            ' || v_task.days_until_due || ' day(s)
                        </span>
                    </td>
                </tr>';
                
                v_task_rows_text := v_task_rows_text || '• ' || v_task.task_name || ' [' || v_task.project_name || '] - ' || v_task.days_until_due || ' day(s)' || CHR(10);
            END IF;
        END LOOP;

        -- Skip if AR has no pending tasks
        IF v_task_count = 0 THEN
            RAISE NOTICE 'AR % has no pending tasks - skipping digest', v_ar.ar_name;
            CONTINUE;
        END IF;

        -- Build email subject
        v_email_subject := '📋 Daily Task Digest - ' || v_task_count || ' Pending Task' || 
            CASE WHEN v_task_count > 1 THEN 's' ELSE '' END ||
            CASE WHEN v_urgent_count > 0 THEN ' (' || v_urgent_count || ' due today)' ELSE '' END;

        -- Build HTML email
        v_email_html := '
<html>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
    <div style="max-width: 800px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1>📋 Daily Task Digest</h1>
            <p style="margin: 5px 0;">For ' || v_ar.ar_name || '</p>
        </div>
        <div style="padding: 20px;">
            <p>Hi <strong>' || v_ar.ar_name || '</strong>,</p>
            <p>You have <strong>' || v_task_count || '</strong> pending task(s) to complete today and upcoming days:</p>
            ' || CASE WHEN v_urgent_count > 0 THEN '<p style="background-color: #fff3cd; padding: 12px; border-radius: 4px; color: #856404; border-left: 4px solid #ff9800;">
                <strong>⚠️ ' || v_urgent_count || ' task(s) are due TODAY!</strong>
            </p>' ELSE '' END || '
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <th style="text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6;">Task Name</th>
                    <th style="text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6;">Project</th>
                    <th style="text-align: center; padding: 12px; border-bottom: 2px solid #dee2e6;">Timeline</th>
                </tr>
                ' || v_task_rows_html || '
            </table>
            <p style="color: #666; font-size: 14px; margin-top: 15px;">This is an automated daily digest from the zHeight AI project management system.</p>
        </div>
    </div>
</body>
</html>';

        -- Build text email
        v_email_text := 'Daily Task Digest - ' || TO_CHAR(v_today, 'Day, Month DD, YYYY') || '

Hi ' || v_ar.ar_name || ',

You have ' || v_task_count || ' pending task(s):

' || v_task_rows_text || '

This is an automated daily digest from zHeight AI.';

        -- Insert into email notification queue
        INSERT INTO public.email_notifications (
            recipient_email,
            email_type,
            subject,
            body_html,
            body_text,
            metadata
        ) VALUES (
            v_ar.ar_email,
            'daily_task_digest',
            v_email_subject,
            v_email_html,
            v_email_text,
            jsonb_build_object(
                'ar_id', v_ar.user_id,
                'ar_name', v_ar.ar_name,
                'ar_role', v_ar.ar_role,
                'task_count', v_task_count,
                'urgent_count', v_urgent_count
            )
        );

        RAISE NOTICE 'Daily digest email queued for AR: % (%) - % tasks (% urgent)', 
            v_ar.ar_name, v_ar.ar_role, v_task_count, v_urgent_count;
    END LOOP;

    RAISE NOTICE 'AR daily digest generation completed at %', NOW();
END;
$$;

-- Function to generate PM-only daily digests (consolidated project report)
CREATE OR REPLACE FUNCTION public.generate_pm_daily_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pm RECORD;
    v_project RECORD;
    v_task RECORD;
    v_today DATE;
    v_pm_projects_count INT;
    v_pm_total_tasks INT;
    v_pm_urgent_tasks INT;
    v_task_rows_html TEXT;
    v_task_rows_text TEXT;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
BEGIN
    v_today := CURRENT_DATE;

    -- PART 2: Generate PM Daily Digests (Consolidated)
    -- Only for ACTIVE PMs (active_status = true)
    FOR v_pm IN
        SELECT DISTINCT
            p.user_id,
            p.name as pm_name,
            u.email as pm_email,
            p.active_status
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE ur.role IN ('pm', 'admin')
        AND u.email IS NOT NULL
        AND p.active_status = true  -- Only active PMs
    LOOP
        -- Reset variables for each PM
        v_task_rows_html := '';
        v_task_rows_text := '';
        v_pm_projects_count := 0;
        v_pm_total_tasks := 0;
        v_pm_urgent_tasks := 0;
        
        -- Count projects assigned to this PM using project_manager_name
        SELECT COUNT(DISTINCT id) INTO v_pm_projects_count
        FROM public.projects
        WHERE project_manager_name = v_pm.pm_name;
        
        -- Skip if PM has no projects
        IF v_pm_projects_count = 0 THEN
            RAISE NOTICE 'PM % has no assigned projects - skipping digest', v_pm.pm_name;
            CONTINUE;
        END IF;
        
        -- Loop through all projects assigned to this PM
        FOR v_project IN
            SELECT 
                proj.id as project_id,
                proj.project_name,
                COUNT(DISTINCT pt.task_id) as total_tasks,
                SUM(CASE WHEN pt.due_date::date = v_today THEN 1 ELSE 0 END) as urgent_tasks
            FROM public.projects proj
            LEFT JOIN public.project_tasks pt ON pt.project_id = proj.id
                AND pt.task_status IN ('in_queue', 'started')
                AND pt.due_date IS NOT NULL
            WHERE proj.project_manager_name = v_pm.pm_name
            GROUP BY proj.id, proj.project_name
            ORDER BY proj.project_name ASC
        LOOP
            v_pm_total_tasks := v_pm_total_tasks + COALESCE(v_project.total_tasks, 0);
            v_pm_urgent_tasks := v_pm_urgent_tasks + COALESCE(v_project.urgent_tasks, 0);
            
            -- Build project section with AR breakdown
            v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: #e3f2fd; font-weight: bold;">
                    <td colspan="4" style="padding: 15px; border-bottom: 2px solid #1976d2;">
                        📁 ' || v_project.project_name || ' (' || COALESCE(v_project.total_tasks, 0) || ' tasks)
                    </td>
                </tr>';
            
            v_task_rows_text := v_task_rows_text || CHR(10) || '📁 ' || v_project.project_name || ' (' || COALESCE(v_project.total_tasks, 0) || ' tasks)' || CHR(10);
            
            -- Get tasks for this project grouped by AR
            FOR v_task IN
                SELECT 
                    pt.task_id,
                    pt.task_name,
                    pt.due_date,
                    pt.task_status,
                    p.name as ar_name,
                    CASE 
                        WHEN pt.due_date::date = v_today THEN true
                        ELSE false
                    END as is_due_today,
                    (pt.due_date::date - v_today) as days_until_due
                FROM public.project_tasks pt
                LEFT JOIN public.profiles p ON p.user_id = pt.assigned_ar_id
                WHERE pt.project_id = v_project.project_id
                AND pt.task_status IN ('in_queue', 'started')
                AND pt.due_date IS NOT NULL
                AND (pt.updated_at IS NULL OR pt.updated_at < NOW() - INTERVAL '12 hours')
                ORDER BY pt.due_date::date ASC, pt.task_name ASC
            LOOP
                -- Build HTML row (RED BOLD for today's deadline)
                IF v_task.is_due_today THEN
                    v_task_rows_html := v_task_rows_html || '
                    <tr style="background-color: #ffebee; border-left: 5px solid #d32f2f;">
                        <td style="padding: 12px 12px 12px 30px; border-bottom: 1px solid #ddd;">
                            <strong style="color: #d32f2f;">⚠️ ' || v_task.task_name || '</strong>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || COALESCE(v_task.ar_name, 'Unassigned') || '</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                            <span style="background-color: #ff5252; color: white; padding: 6px 10px; border-radius: 4px; font-weight: bold; font-size: 13px;">
                                📅 DUE TODAY
                            </span>
                        </td>
                    </tr>';
                    
                    v_task_rows_text := v_task_rows_text || '  ⚠️ ' || v_task.task_name || ' → ' || COALESCE(v_task.ar_name, 'Unassigned') || ' [DUE TODAY]' || CHR(10);
                ELSE
                    v_task_rows_html := v_task_rows_html || '
                    <tr>
                        <td style="padding: 12px 12px 12px 30px; border-bottom: 1px solid #ddd;">' || v_task.task_name || '</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || COALESCE(v_task.ar_name, 'Unassigned') || '</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                            <span style="background-color: #FFA500; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px;">
                                ' || v_task.days_until_due || ' day(s)
                            </span>
                        </td>
                    </tr>';
                    
                    v_task_rows_text := v_task_rows_text || '  • ' || v_task.task_name || ' → ' || COALESCE(v_task.ar_name, 'Unassigned') || ' [' || v_task.days_until_due || ' day(s)]' || CHR(10);
                END IF;
            END LOOP;
        END LOOP;

        -- Skip if PM has no tasks across projects
        IF v_pm_total_tasks = 0 THEN
            RAISE NOTICE 'PM % has no pending tasks - skipping digest', v_pm.pm_name;
            CONTINUE;
        END IF;

        -- Build email subject
        v_email_subject := '📊 PM Daily Digest - ' || v_pm_projects_count || ' Project' || 
            CASE WHEN v_pm_projects_count > 1 THEN 's' ELSE '' END || 
            ' (' || v_pm_total_tasks || ' task' || CASE WHEN v_pm_total_tasks > 1 THEN 's' ELSE '' END || ')' ||
            CASE WHEN v_pm_urgent_tasks > 0 THEN ' - ⚠️ ' || v_pm_urgent_tasks || ' due TODAY' ELSE '' END;

        -- Build HTML email
        v_email_html := '
<html>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
    <div style="max-width: 900px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1>📊 Project Manager Daily Digest</h1>
            <p style="margin: 5px 0;">Consolidated Project Report</p>
        </div>
        <div style="padding: 20px;">
            <p>Hi <strong>' || v_pm.pm_name || '</strong>,</p>
            <p>Here is your consolidated project status for today (' || TO_CHAR(v_today, 'Day, Month DD, YYYY') || '):</p>
            <p><strong>📊 Summary:</strong> ' || v_pm_projects_count || ' project(s) | ' || v_pm_total_tasks || ' pending task(s)' ||
                CASE WHEN v_pm_urgent_tasks > 0 THEN ' | <span style="color: #d32f2f;"><strong>⚠️ ' || v_pm_urgent_tasks || ' due TODAY</strong></span>' ELSE '' END || '</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <th style="text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6;">Task Name</th>
                    <th style="text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6;">Assigned AR</th>
                    <th style="text-align: center; padding: 12px; border-bottom: 2px solid #dee2e6;">Timeline</th>
                </tr>
                ' || v_task_rows_html || '
            </table>
            <p style="color: #666; font-size: 14px; margin-top: 15px;">This is an automated daily digest from the zHeight AI project management system.</p>
        </div>
    </div>
</body>
</html>';

        -- Build text email
        v_email_text := 'Project Manager Daily Digest - ' || TO_CHAR(v_today, 'Day, Month DD, YYYY') || '

Hi ' || v_pm.pm_name || ',

SUMMARY: ' || v_pm_projects_count || ' project(s) | ' || v_pm_total_tasks || ' pending task(s)' ||
CASE WHEN v_pm_urgent_tasks > 0 THEN ' | ⚠️ ' || v_pm_urgent_tasks || ' due TODAY' ELSE '' END || '

' || v_task_rows_text || '

This is an automated daily digest from zHeight AI.';

        -- Insert into email notification queue
        INSERT INTO public.email_notifications (
            recipient_email,
            email_type,
            subject,
            body_html,
            body_text,
            metadata
        ) VALUES (
            v_pm.pm_email,
            'pm_daily_digest',
            v_email_subject,
            v_email_html,
            v_email_text,
            jsonb_build_object(
                'pm_id', v_pm.user_id,
                'pm_name', v_pm.pm_name,
                'projects_count', v_pm_projects_count,
                'total_tasks', v_pm_total_tasks,
                'urgent_tasks', v_pm_urgent_tasks
            )
        );

        RAISE NOTICE 'PM daily digest email queued: % (ACTIVE, %s projects, %s tasks, %s urgent)',
            v_pm.pm_name, v_pm_projects_count, v_pm_total_tasks, v_pm_urgent_tasks;
    END LOOP;

    -- Log skipped inactive PMs
    FOR v_pm IN
        SELECT DISTINCT
            p.name as pm_name
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE ur.role IN ('pm', 'admin')
        AND p.active_status = false  -- Inactive PMs
    LOOP
        RAISE NOTICE 'PM % is INACTIVE - digest NOT sent', v_pm.pm_name;
    END LOOP;

    RAISE NOTICE 'PM daily digest generation completed at % - only active PMs received digest', NOW();
END;
$$;

COMMENT ON FUNCTION public.generate_ar_daily_digest() IS 'Generates daily task digest emails for AR1/AR2 users at 9:00 AM IST (03:30 UTC) - individual task lists with urgent RED highlighting';

COMMENT ON FUNCTION public.generate_pm_daily_digest() IS 'Generates consolidated project report for ACTIVE PMs ONLY at 9:30 AM IST (04:00 UTC) - shows all project tasks grouped by project and AR - skips inactive PMs';

-- Remove any existing daily digest cron jobs
SELECT cron.unschedule('daily_task_digest');
SELECT cron.unschedule('pm_daily_digest');

-- Schedule AR digest at 9:00 AM IST (03:30 UTC) every day
SELECT cron.schedule(
    'daily_task_digest',
    '30 3 * * *',  -- 03:30 UTC = 9:00 AM IST
    $$SELECT public.generate_ar_daily_digest()$$
);

-- Schedule PM digest at 9:30 AM IST (04:00 UTC) every day (30 minutes after AR digest)
SELECT cron.schedule(
    'pm_daily_digest',
    '0 4 * * *',   -- 04:00 UTC = 9:30 AM IST
    $$SELECT public.generate_pm_daily_digest()$$
);

RAISE NOTICE 'Separate AR and PM daily digest scheduling completed';
