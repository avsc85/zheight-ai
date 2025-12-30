
-- Update the cron schedule to run only on Monday (1) and Wednesday (3) at 9:00 AM IST (3:30 AM UTC)
SELECT cron.unschedule('daily_task_digest');

SELECT cron.schedule(
  'daily_task_digest',
  '30 3 * * 1,3',  -- 3:30 AM UTC = 9:00 AM IST, only on Monday and Wednesday
  $$SELECT public.generate_daily_task_digest()$$
);

-- Now update the generate_daily_task_digest function with improved PM consolidated report
CREATE OR REPLACE FUNCTION public.generate_daily_task_digest()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_ar RECORD;
    v_pm RECORD;
    v_task RECORD;
    v_project RECORD;
    v_task_count INTEGER;
    v_today DATE := CURRENT_DATE;
    v_day_name TEXT;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_task_rows_html TEXT := '';
    v_task_rows_text TEXT := '';
    v_urgent_count INTEGER := 0;
    v_pm_projects_count INTEGER := 0;
    v_pm_total_tasks INTEGER := 0;
    v_pm_urgent_tasks INTEGER := 0;
    v_pm_overdue_tasks INTEGER := 0;
    v_pm_completed_week INTEGER := 0;
    v_project_summary_html TEXT := '';
    v_ar_summary_html TEXT := '';
    v_ar_workload RECORD;
BEGIN
    -- Get day name for email
    v_day_name := TO_CHAR(v_today, 'Day');
    
    -- =====================================================
    -- PART 1: Generate AR Daily Digests (unchanged)
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
        
        -- Get all pending tasks for this AR
        FOR v_task IN
            SELECT 
                pt.task_id,
                pt.task_name,
                pt.due_date,
                pt.task_status,
                proj.project_name,
                CASE WHEN pt.due_date::date = v_today THEN true ELSE false END as is_due_today,
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
            
            IF v_task.is_due_today THEN
                v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: #ffebee; border-left: 5px solid #d32f2f;">
                    <td style="padding: 15px; border-bottom: 1px solid #ddd;"><strong style="color: #d32f2f; font-size: 16px;">⚠️ ' || v_task.task_name || '</strong></td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd; text-align: center;"><span style="background-color: #ff5252; color: white; padding: 8px 12px; border-radius: 4px; font-weight: bold;">📅 DUE TODAY</span></td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd; text-align: center;"><span style="background-color: ' || CASE v_task.task_status WHEN 'started' THEN '#2196F3' ELSE '#9E9E9E' END || '; color: white; padding: 5px 10px; border-radius: 3px;">' || CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started' END || '</span></td>
                </tr>';
            ELSE
                v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: white;">
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.task_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">' || v_task.due_date || CASE WHEN v_task.days_until_due <= 3 THEN ' <span style="color: #ff9800;">(In ' || v_task.days_until_due || ' days)</span>' ELSE '' END || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;"><span style="background-color: ' || CASE v_task.task_status WHEN 'started' THEN '#2196F3' ELSE '#9E9E9E' END || '; color: white; padding: 5px 10px; border-radius: 3px;">' || CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started' END || '</span></td>
                </tr>';
            END IF;
        END LOOP;
        
        IF v_task_count > 0 THEN
            v_email_subject := '📋 ' || TRIM(v_day_name) || ' Task Digest - ' || v_task_count || ' Pending Task' || CASE WHEN v_task_count > 1 THEN 's' ELSE '' END || CASE WHEN v_urgent_count > 0 THEN ' (' || v_urgent_count || ' DUE TODAY!)' ELSE '' END;
            
            v_email_html := '<!DOCTYPE html><html><head><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;}.container{max-width:900px;margin:0 auto;padding:20px;background:#f5f5f5;}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;}.content{background:white;padding:0;border-radius:0 0 8px 8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}table{width:100%;border-collapse:collapse;}th{background:#667eea;color:white;padding:15px;text-align:left;}.footer{text-align:center;margin-top:30px;padding:20px;border-top:2px solid #ddd;color:#777;}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;">📋 ' || TRIM(v_day_name) || ' Task Digest</h1><p style="margin:10px 0 0;opacity:0.9;">Hello ' || v_ar.ar_name || '! Here are your pending tasks for ' || TO_CHAR(v_today, 'Month DD, YYYY') || '</p></div><div style="background:white;padding:20px;border-left:5px solid #667eea;margin:20px 0;border-radius:5px;"><h3 style="margin:0 0 10px;color:#667eea;">📊 Summary</h3><p><strong>Total Pending:</strong> ' || v_task_count || ' | <strong>In Queue:</strong> ' || (SELECT COUNT(*) FROM project_tasks WHERE assigned_ar_id = v_ar.user_id AND task_status = 'in_queue') || ' | <strong>Started:</strong> ' || (SELECT COUNT(*) FROM project_tasks WHERE assigned_ar_id = v_ar.user_id AND task_status = 'started') || '</p>' || CASE WHEN v_urgent_count > 0 THEN '<p style="color:#d32f2f;font-weight:bold;">⚠️ ' || v_urgent_count || ' task(s) due TODAY!</p>' ELSE '' END || '</div>' || CASE WHEN v_urgent_count > 0 THEN '<div style="background:#d32f2f;color:white;padding:15px;text-align:center;font-weight:bold;border-radius:5px;margin:20px 0;">🚨 ATTENTION: ' || v_urgent_count || ' task(s) with deadline TODAY! 🚨</div>' ELSE '' END || '<div class="content"><table><thead><tr><th style="width:35%;">Task Name</th><th style="width:30%;">Project</th><th style="width:20%;text-align:center;">Deadline</th><th style="width:15%;text-align:center;">Status</th></tr></thead><tbody>' || v_task_rows_html || '</tbody></table></div><div class="footer"><p>📌 Legend: 🔴 Red = Due TODAY | 🟡 Orange = Due Soon</p><p style="margin-top:15px;">zHeight AI Project Management | ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '</p></div></div></body></html>';
            
            INSERT INTO public.email_notifications (recipient_email, email_type, subject, body_html, body_text, metadata)
            VALUES (v_ar.ar_email, 'daily_task_digest', v_email_subject, v_email_html, '', jsonb_build_object('ar_id', v_ar.user_id, 'ar_name', v_ar.ar_name, 'total_tasks', v_task_count, 'urgent_tasks', v_urgent_count, 'digest_date', v_today));
        END IF;
    END LOOP;
    
    -- =====================================================
    -- PART 2: Generate PM Consolidated Weekly Digest
    -- =====================================================
    FOR v_pm IN
        SELECT DISTINCT p.user_id, p.name as pm_name, u.email as pm_email
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE ur.role IN ('pm', 'admin')
        AND u.email IS NOT NULL
    LOOP
        v_task_rows_html := '';
        v_project_summary_html := '';
        v_ar_summary_html := '';
        v_pm_projects_count := 0;
        v_pm_total_tasks := 0;
        v_pm_urgent_tasks := 0;
        v_pm_overdue_tasks := 0;
        v_pm_completed_week := 0;
        
        -- Count projects and stats
        SELECT COUNT(DISTINCT id) INTO v_pm_projects_count FROM projects WHERE project_manager_name = v_pm.pm_name AND deleted_at IS NULL;
        
        IF v_pm_projects_count = 0 THEN
            CONTINUE;
        END IF;
        
        -- Get overdue tasks count
        SELECT COUNT(*) INTO v_pm_overdue_tasks
        FROM project_tasks pt
        JOIN projects p ON p.id = pt.project_id
        WHERE p.project_manager_name = v_pm.pm_name
        AND pt.task_status IN ('in_queue', 'started')
        AND pt.due_date IS NOT NULL
        AND pt.due_date::date < v_today;
        
        -- Get completed this week
        SELECT COUNT(*) INTO v_pm_completed_week
        FROM project_tasks pt
        JOIN projects p ON p.id = pt.project_id
        WHERE p.project_manager_name = v_pm.pm_name
        AND pt.task_status = 'completed'
        AND pt.completion_date >= v_today - INTERVAL '7 days';
        
        -- Build AR workload summary
        FOR v_ar_workload IN
            SELECT 
                COALESCE(pr.name, 'Unassigned') as ar_name,
                COUNT(*) as task_count,
                SUM(CASE WHEN pt.due_date::date = v_today THEN 1 ELSE 0 END) as urgent,
                SUM(CASE WHEN pt.due_date::date < v_today THEN 1 ELSE 0 END) as overdue
            FROM project_tasks pt
            JOIN projects p ON p.id = pt.project_id
            LEFT JOIN profiles pr ON pr.user_id = pt.assigned_ar_id
            WHERE p.project_manager_name = v_pm.pm_name
            AND pt.task_status IN ('in_queue', 'started')
            AND p.deleted_at IS NULL
            GROUP BY pr.name
            ORDER BY task_count DESC
        LOOP
            v_ar_summary_html := v_ar_summary_html || '
            <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;font-weight:500;">' || v_ar_workload.ar_name || '</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">' || v_ar_workload.task_count || '</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;"><span style="background:' || CASE WHEN v_ar_workload.urgent > 0 THEN '#ff5252' ELSE '#4caf50' END || ';color:white;padding:4px 10px;border-radius:12px;">' || v_ar_workload.urgent || '</span></td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;"><span style="background:' || CASE WHEN v_ar_workload.overdue > 0 THEN '#ff9800' ELSE '#4caf50' END || ';color:white;padding:4px 10px;border-radius:12px;">' || v_ar_workload.overdue || '</span></td>
            </tr>';
        END LOOP;
        
        -- Build project-wise breakdown
        FOR v_project IN
            SELECT 
                proj.id as project_id,
                proj.project_name,
                proj.expected_end_date,
                COUNT(DISTINCT pt.task_id) FILTER (WHERE pt.task_status IN ('in_queue', 'started')) as pending_tasks,
                COUNT(DISTINCT pt.task_id) FILTER (WHERE pt.task_status = 'completed') as completed_tasks,
                SUM(CASE WHEN pt.due_date::date = v_today AND pt.task_status IN ('in_queue', 'started') THEN 1 ELSE 0 END) as urgent_tasks
            FROM projects proj
            LEFT JOIN project_tasks pt ON pt.project_id = proj.id
            WHERE proj.project_manager_name = v_pm.pm_name
            AND proj.deleted_at IS NULL
            GROUP BY proj.id, proj.project_name, proj.expected_end_date
            HAVING COUNT(DISTINCT pt.task_id) FILTER (WHERE pt.task_status IN ('in_queue', 'started')) > 0
            ORDER BY urgent_tasks DESC, pending_tasks DESC
        LOOP
            v_pm_total_tasks := v_pm_total_tasks + COALESCE(v_project.pending_tasks, 0);
            v_pm_urgent_tasks := v_pm_urgent_tasks + COALESCE(v_project.urgent_tasks, 0);
            
            v_project_summary_html := v_project_summary_html || '
            <tr style="' || CASE WHEN v_project.urgent_tasks > 0 THEN 'background:#fff3e0;' ELSE '' END || '">
                <td style="padding:14px;border-bottom:1px solid #eee;">
                    <strong>' || v_project.project_name || '</strong>
                    ' || CASE WHEN v_project.expected_end_date IS NOT NULL THEN '<br><span style="font-size:12px;color:#888;">Due: ' || v_project.expected_end_date || '</span>' ELSE '' END || '
                </td>
                <td style="padding:14px;border-bottom:1px solid #eee;text-align:center;">' || v_project.pending_tasks || '</td>
                <td style="padding:14px;border-bottom:1px solid #eee;text-align:center;">' || v_project.completed_tasks || '</td>
                <td style="padding:14px;border-bottom:1px solid #eee;text-align:center;">
                    ' || CASE WHEN v_project.urgent_tasks > 0 THEN '<span style="background:#ff5252;color:white;padding:6px 12px;border-radius:4px;font-weight:bold;">⚠️ ' || v_project.urgent_tasks || '</span>' ELSE '<span style="color:#4caf50;">✓ None</span>' END || '
                </td>
            </tr>';
        END LOOP;
        
        IF v_pm_total_tasks > 0 THEN
            v_email_subject := '📊 PM Weekly Report - ' || TRIM(v_day_name) || ' | ' || v_pm_projects_count || ' Projects, ' || v_pm_total_tasks || ' Pending Tasks' || CASE WHEN v_pm_urgent_tasks > 0 THEN ' ⚠️' ELSE '' END;
            
            v_email_html := '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f0f2f5; }
        .container { max-width: 900px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .header p { margin: 10px 0 0; opacity: 0.9; font-size: 15px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; padding: 25px; background: white; border-bottom: 1px solid #eee; }
        .stat-card { text-align: center; padding: 20px 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; }
        .stat-number { font-size: 36px; font-weight: 700; margin: 0; }
        .stat-label { font-size: 13px; color: #64748b; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .section { background: white; padding: 25px; margin-bottom: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .section-title { font-size: 18px; font-weight: 600; color: #1a365d; margin: 0 0 20px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; color: #475569; padding: 14px; text-align: left; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
        .alert-banner { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 20px; text-align: center; font-weight: 600; margin: 0 25px 20px; border-radius: 8px; }
        .footer { text-align: center; padding: 30px; color: #64748b; font-size: 13px; }
        .progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Project Manager Weekly Report</h1>
            <p>Hello ' || v_pm.pm_name || '! Here is your consolidated report for ' || TRIM(v_day_name) || ', ' || TO_CHAR(v_today, 'Month DD, YYYY') || '</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <p class="stat-number" style="color: #2563eb;">' || v_pm_projects_count || '</p>
                <p class="stat-label">Active Projects</p>
            </div>
            <div class="stat-card">
                <p class="stat-number" style="color: #7c3aed;">' || v_pm_total_tasks || '</p>
                <p class="stat-label">Pending Tasks</p>
            </div>
            <div class="stat-card">
                <p class="stat-number" style="color: ' || CASE WHEN v_pm_urgent_tasks > 0 THEN '#dc2626' ELSE '#10b981' END || ';">' || v_pm_urgent_tasks || '</p>
                <p class="stat-label">Due Today</p>
            </div>
            <div class="stat-card">
                <p class="stat-number" style="color: #10b981;">' || v_pm_completed_week || '</p>
                <p class="stat-label">Completed (7 days)</p>
            </div>
        </div>
        
        ' || CASE WHEN v_pm_urgent_tasks > 0 THEN '<div class="alert-banner">🚨 ATTENTION: ' || v_pm_urgent_tasks || ' task(s) with deadline TODAY require immediate attention!</div>' ELSE '' END || '
        
        ' || CASE WHEN v_pm_overdue_tasks > 0 THEN '<div style="background:#fff7ed;border-left:4px solid #f97316;padding:15px 20px;margin:0 25px 20px;border-radius:4px;"><strong style="color:#c2410c;">⏰ Overdue Alert:</strong> ' || v_pm_overdue_tasks || ' task(s) are past their deadline and need follow-up.</div>' ELSE '' END || '
        
        <div class="section">
            <h3 class="section-title">👥 Team Workload Summary</h3>
            <table>
                <thead>
                    <tr>
                        <th>Team Member</th>
                        <th style="text-align:center;">Pending Tasks</th>
                        <th style="text-align:center;">Due Today</th>
                        <th style="text-align:center;">Overdue</th>
                    </tr>
                </thead>
                <tbody>
                    ' || v_ar_summary_html || '
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h3 class="section-title">📁 Project Status Overview</h3>
            <table>
                <thead>
                    <tr>
                        <th>Project</th>
                        <th style="text-align:center;">Pending</th>
                        <th style="text-align:center;">Completed</th>
                        <th style="text-align:center;">Urgent</th>
                    </tr>
                </thead>
                <tbody>
                    ' || v_project_summary_html || '
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p style="margin:0 0 10px;"><strong>📌 Quick Reference:</strong> 🔴 Urgent = Due Today | 🟠 Overdue = Past Deadline | 🟢 On Track</p>
            <p style="margin:0;">This report is sent every Monday and Wednesday at 9:00 AM IST</p>
            <p style="margin:15px 0 0;color:#94a3b8;">zHeight AI Project Management System | Generated: ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || ' UTC</p>
        </div>
    </div>
</body>
</html>';
            
            INSERT INTO public.email_notifications (recipient_email, email_type, subject, body_html, body_text, metadata)
            VALUES (
                v_pm.pm_email,
                'pm_weekly_digest',
                v_email_subject,
                v_email_html,
                '',
                jsonb_build_object(
                    'pm_id', v_pm.user_id,
                    'pm_name', v_pm.pm_name,
                    'projects_count', v_pm_projects_count,
                    'total_tasks', v_pm_total_tasks,
                    'urgent_tasks', v_pm_urgent_tasks,
                    'overdue_tasks', v_pm_overdue_tasks,
                    'completed_week', v_pm_completed_week,
                    'digest_date', v_today,
                    'day_of_week', TRIM(v_day_name)
                )
            );
            
            RAISE NOTICE 'PM digest queued for: % (%) - % projects, % tasks', v_pm.pm_name, v_pm.pm_email, v_pm_projects_count, v_pm_total_tasks;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Task digest generation completed at %', NOW();
END;
$function$
