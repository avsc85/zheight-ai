-- Migration: Daily Task Digest Email for ARs and PMs
-- Date: 2025-11-27
-- Feature: Send email at 9:30 AM daily listing all pending tasks (in_queue, started)
-- AR Email: Individual pending tasks sorted by deadline
-- PM Email: Consolidated report of all projects and ARs under them
-- Sorted by deadline, with same-day deadlines highlighted in RED BOLD

-- Function to generate daily task digest for ARs and PMs
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
BEGIN
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
        
        -- Get all pending tasks for this AR (in_queue or started status)
        -- Sorted by deadline (earliest first)
        -- EXCLUDE tasks recently assigned in last 12 hours to avoid duplicate with assignment email
        FOR v_task IN
            SELECT 
                pt.task_id,
                pt.task_name,
                pt.due_date,
                pt.task_status,
                proj.project_name,
                proj.project_address,
                -- Check if deadline is today
                CASE 
                    WHEN pt.due_date::date = v_today THEN true
                    ELSE false
                END as is_due_today,
                -- Calculate days until deadline
                (pt.due_date::date - v_today) as days_until_due
            FROM public.project_tasks pt
            JOIN public.projects proj ON proj.id = pt.project_id
            WHERE pt.assigned_ar_id = v_ar.user_id
            AND pt.task_status IN ('in_queue', 'started')
            AND pt.due_date IS NOT NULL
            -- Exclude newly assigned tasks (assigned in last 12 hours)
            AND (pt.updated_at IS NULL OR pt.updated_at < NOW() - INTERVAL '12 hours')
            ORDER BY pt.due_date::date ASC, pt.task_name ASC
        LOOP
            v_task_count := v_task_count + 1;
            
            -- Count urgent tasks (due today)
            IF v_task.is_due_today THEN
                v_urgent_count := v_urgent_count + 1;
            END IF;
            
            -- Build HTML row (RED BOLD for today's deadline)
            IF v_task.is_due_today THEN
                v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: #ffebee; border-left: 5px solid #d32f2f;">
                    <td style="padding: 15px; border-bottom: 1px solid #ddd;">
                        <strong style="color: #d32f2f; font-size: 16px;">⚠️ ' || v_task.task_name || '</strong>
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: #ff5252; color: white; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; display: inline-block;">
                            📅 DUE TODAY
                        </span>
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: ' || 
                        CASE v_task.task_status 
                            WHEN 'started' THEN '#2196F3' 
                            ELSE '#9E9E9E' 
                        END || '; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px;">' ||
                        CASE v_task.task_status
                            WHEN 'in_queue' THEN 'In Queue'
                            WHEN 'started' THEN 'Started'
                        END || '</span>
                    </td>
                </tr>';
            ELSE
                v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: white;">
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.task_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || v_task.project_name || '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">' || 
                        v_task.due_date || 
                        CASE 
                            WHEN v_task.days_until_due = 1 THEN ' <span style="color: #ff9800;">(Tomorrow)</span>'
                            WHEN v_task.days_until_due <= 3 THEN ' <span style="color: #ff9800;">(In ' || v_task.days_until_due || ' days)</span>'
                            ELSE ''
                        END ||
                    '</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                        <span style="background-color: ' || 
                        CASE v_task.task_status 
                            WHEN 'started' THEN '#2196F3' 
                            ELSE '#9E9E9E' 
                        END || '; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px;">' ||
                        CASE v_task.task_status
                            WHEN 'in_queue' THEN 'In Queue'
                            WHEN 'started' THEN 'Started'
                        END || '</span>
                    </td>
                </tr>';
            END IF;
            
            -- Build text version
            IF v_task.is_due_today THEN
                v_task_rows_text := v_task_rows_text || '
⚠️ **DUE TODAY** - ' || v_task.task_name || '
   Project: ' || v_task.project_name || '
   Deadline: ' || v_task.due_date || ' (TODAY!)
   Status: ' || CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started' END || '
   ----------------------------------------';
            ELSE
                v_task_rows_text := v_task_rows_text || '
- ' || v_task.task_name || '
  Project: ' || v_task.project_name || '
  Deadline: ' || v_task.due_date || 
  CASE 
      WHEN v_task.days_until_due = 1 THEN ' (Tomorrow)'
      WHEN v_task.days_until_due <= 3 THEN ' (In ' || v_task.days_until_due || ' days)'
      ELSE ''
  END || '
  Status: ' || CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started' END || '
';
            END IF;
        END LOOP;
        
        -- Only send email if there are pending tasks
        IF v_task_count > 0 THEN
            -- Create email subject
            v_email_subject := '📋 Daily Task Digest - ' || v_task_count || ' Pending Task' || 
                CASE WHEN v_task_count > 1 THEN 's' ELSE '' END ||
                CASE WHEN v_urgent_count > 0 THEN ' (' || v_urgent_count || ' DUE TODAY!)' ELSE '' END;
            
            -- Create HTML email body
            v_email_html := '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
        .summary { background-color: white; padding: 20px; border-left: 5px solid #667eea; margin: 20px 0; border-radius: 5px; }
        .summary h2 { margin: 0 0 10px 0; color: #667eea; font-size: 18px; }
        .urgent-banner { background-color: #d32f2f; color: white; padding: 15px; text-align: center; font-size: 16px; font-weight: bold; border-radius: 5px; margin: 20px 0; }
        .content { background-color: white; padding: 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; color: #777; font-size: 13px; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Daily Task Digest</h1>
            <p>Good Morning, ' || v_ar.ar_name || '! Here are your pending tasks for ' || TO_CHAR(v_today, 'Day, Month DD, YYYY') || '</p>
        </div>
        
        <div class="summary">
            <h2>📊 Summary</h2>
            <p><strong>Total Pending Tasks:</strong> ' || v_task_count || '</p>
            <p><strong>Tasks In Queue:</strong> ' || (SELECT COUNT(*) FROM public.project_tasks WHERE assigned_ar_id = v_ar.user_id AND task_status = 'in_queue') || '</p>
            <p><strong>Tasks Started:</strong> ' || (SELECT COUNT(*) FROM public.project_tasks WHERE assigned_ar_id = v_ar.user_id AND task_status = 'started') || '</p>
            ' || CASE WHEN v_urgent_count > 0 THEN '<p style="color: #d32f2f; font-weight: bold;">⚠️ <strong>Urgent: ' || v_urgent_count || ' task(s) due TODAY!</strong></p>' ELSE '' END || '
        </div>';
        
        IF v_urgent_count > 0 THEN
            v_email_html := v_email_html || '
        <div class="urgent-banner">
            🚨 ATTENTION: You have ' || v_urgent_count || ' task(s) with deadline TODAY! 🚨
        </div>';
        END IF;
        
        v_email_html := v_email_html || '
        <div class="content">
            <table>
                <thead>
                    <tr>
                        <th style="width: 35%;">Task Name</th>
                        <th style="width: 30%;">Project</th>
                        <th style="width: 20%; text-align: center;">Deadline</th>
                        <th style="width: 15%; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ' || v_task_rows_html || '
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p><strong>📌 Legend:</strong></p>
            <p>🔴 Red Background = Due TODAY | 🟡 Orange Text = Due Soon (1-3 days)</p>
            <p style="margin-top: 15px;">This is an automated daily digest from the zHeight AI project management system.</p>
            <p>Sent at 9:30 AM | ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '</p>
            <p style="margin-top: 15px;">© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>';
            
            -- Create plain text version
            v_email_text := 'Daily Task Digest - ' || TO_CHAR(v_today, 'Day, Month DD, YYYY') || '

Good Morning ' || v_ar.ar_name || ',

Here are your pending tasks:

SUMMARY:
========
Total Pending Tasks: ' || v_task_count || '
Tasks In Queue: ' || (SELECT COUNT(*) FROM public.project_tasks WHERE assigned_ar_id = v_ar.user_id AND task_status = 'in_queue') || '
Tasks Started: ' || (SELECT COUNT(*) FROM public.project_tasks WHERE assigned_ar_id = v_ar.user_id AND task_status = 'started') || '
' || CASE WHEN v_urgent_count > 0 THEN '
⚠️ URGENT: ' || v_urgent_count || ' task(s) due TODAY!
' ELSE '' END || '

YOUR TASKS (Sorted by Deadline):
================================' || v_task_rows_text || '

---
This is an automated daily digest from zHeight AI.
Sent at 9:30 AM | ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '
';
            
            -- Insert into email notifications queue
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
                    'total_tasks', v_task_count,
                    'urgent_tasks', v_urgent_count,
                    'digest_date', v_today
                )
            );
            
            RAISE NOTICE 'Daily digest email queued for AR: % (%) - % tasks (% urgent)', 
                v_ar.ar_name, v_ar.ar_email, v_task_count, v_urgent_count;
        ELSE
            RAISE NOTICE 'No pending tasks for AR: % (%) - skipping digest', v_ar.ar_name, v_ar.ar_email;
        END IF;
        
    END LOOP;
    
    -- =====================================================
    -- PART 2: Generate PM Daily Digests (Consolidated)
    -- =====================================================
    FOR v_pm IN
        SELECT DISTINCT
            p.user_id,
            p.name as pm_name,
            u.email as pm_email
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE ur.role IN ('pm', 'admin')
        AND u.email IS NOT NULL
    LOOP
        -- Reset variables for each PM
        v_task_rows_html := '';
        v_task_rows_text := '';
        v_pm_projects_count := 0;
        v_pm_total_tasks := 0;
        v_pm_urgent_tasks := 0;
        
        -- Count projects assigned to this PM
        SELECT COUNT(DISTINCT id) INTO v_pm_projects_count
        FROM public.projects
        WHERE project_manager_id = v_pm.user_id;
        
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
                proj.project_address,
                COUNT(DISTINCT pt.task_id) as total_tasks,
                SUM(CASE WHEN pt.due_date::date = v_today THEN 1 ELSE 0 END) as urgent_tasks
            FROM public.projects proj
            LEFT JOIN public.project_tasks pt ON pt.project_id = proj.id
                AND pt.task_status IN ('in_queue', 'started')
                AND pt.due_date IS NOT NULL
            WHERE proj.project_manager_id = v_pm.user_id
            GROUP BY proj.id, proj.project_name, proj.project_address
            ORDER BY proj.project_name ASC
        LOOP
            v_pm_total_tasks := v_pm_total_tasks + COALESCE(v_project.total_tasks, 0);
            v_pm_urgent_tasks := v_pm_urgent_tasks + COALESCE(v_project.urgent_tasks, 0);
            
            -- Build project section with AR breakdown
            v_task_rows_html := v_task_rows_html || '
                <tr style="background-color: #e3f2fd; font-weight: bold;">
                    <td colspan="5" style="padding: 15px; border-bottom: 2px solid #1976d2;">
                        📁 ' || v_project.project_name || 
                        CASE WHEN v_project.project_address IS NOT NULL THEN ' - ' || v_project.project_address ELSE '' END ||
                    '</td>
                </tr>';
            
            -- Get tasks for this project grouped by AR
            -- EXCLUDE tasks recently assigned in last 12 hours to avoid duplicate with assignment email
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
                -- Exclude newly assigned tasks (assigned in last 12 hours)
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
                        <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                            <span style="background-color: ' || 
                            CASE v_task.task_status 
                                WHEN 'started' THEN '#2196F3' 
                                ELSE '#9E9E9E' 
                            END || '; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px;">' ||
                            CASE v_task.task_status
                                WHEN 'in_queue' THEN 'In Queue'
                                WHEN 'started' THEN 'Started'
                            END || '</span>
                        </td>
                    </tr>';
                    
                    v_task_rows_text := v_task_rows_text || '
    ⚠️ DUE TODAY - ' || v_task.task_name || '
       AR: ' || COALESCE(v_task.ar_name, 'Unassigned') || ' | Status: ' || 
       CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started' END;
                ELSE
                    v_task_rows_html := v_task_rows_html || '
                    <tr style="background-color: white;">
                        <td style="padding: 12px 12px 12px 30px; border-bottom: 1px solid #ddd;">' || v_task.task_name || '</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">' || COALESCE(v_task.ar_name, 'Unassigned') || '</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">' || 
                            v_task.due_date || 
                            CASE 
                                WHEN v_task.days_until_due = 1 THEN ' <span style="color: #ff9800; font-size: 11px;">(Tomorrow)</span>'
                                WHEN v_task.days_until_due <= 3 THEN ' <span style="color: #ff9800; font-size: 11px;">(In ' || v_task.days_until_due || ' days)</span>'
                                ELSE ''
                            END ||
                        '</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
                            <span style="background-color: ' || 
                            CASE v_task.task_status 
                                WHEN 'started' THEN '#2196F3' 
                                ELSE '#9E9E9E' 
                            END || '; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px;">' ||
                            CASE v_task.task_status
                                WHEN 'in_queue' THEN 'In Queue'
                                WHEN 'started' THEN 'Started'
                            END || '</span>
                        </td>
                    </tr>';
                    
                    v_task_rows_text := v_task_rows_text || '
    - ' || v_task.task_name || '
      AR: ' || COALESCE(v_task.ar_name, 'Unassigned') || ' | Due: ' || v_task.due_date || 
      CASE 
          WHEN v_task.days_until_due = 1 THEN ' (Tomorrow)'
          WHEN v_task.days_until_due <= 3 THEN ' (In ' || v_task.days_until_due || ' days)'
          ELSE ''
      END || ' | Status: ' || CASE v_task.task_status WHEN 'in_queue' THEN 'In Queue' WHEN 'started' THEN 'Started' END;
                END IF;
            END LOOP;
            
            -- Add spacing between projects
            v_task_rows_text := v_task_rows_text || '
';
        END LOOP;
        
        -- Only send email if PM has tasks in their projects
        IF v_pm_total_tasks > 0 THEN
            -- Create email subject for PM
            v_email_subject := '📊 PM Daily Digest - ' || v_pm_projects_count || ' Project' || 
                CASE WHEN v_pm_projects_count > 1 THEN 's' ELSE '' END || ', ' ||
                v_pm_total_tasks || ' Pending Task' || 
                CASE WHEN v_pm_total_tasks > 1 THEN 's' ELSE '' END ||
                CASE WHEN v_pm_urgent_tasks > 0 THEN ' (' || v_pm_urgent_tasks || ' DUE TODAY!)' ELSE '' END;
            
            -- Create HTML email body for PM
            v_email_html := '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 1000px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
        .summary { background-color: white; padding: 20px; border-left: 5px solid #1976d2; margin: 20px 0; border-radius: 5px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .summary-box { text-align: center; padding: 15px; background-color: #f5f5f5; border-radius: 5px; }
        .summary-box h3 { margin: 0 0 5px 0; font-size: 32px; color: #1976d2; }
        .summary-box p { margin: 0; font-size: 13px; color: #666; }
        .urgent-banner { background-color: #d32f2f; color: white; padding: 15px; text-align: center; font-size: 16px; font-weight: bold; border-radius: 5px; margin: 20px 0; }
        .content { background-color: white; padding: 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 800px; }
        th { background-color: #1976d2; color: white; padding: 15px; text-align: left; font-weight: 600; position: sticky; top: 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; color: #777; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Project Manager Daily Digest</h1>
            <p>Good Morning, ' || v_pm.pm_name || '! Consolidated report for ' || TO_CHAR(v_today, 'Day, Month DD, YYYY') || '</p>
        </div>
        
        <div class="summary">
            <div class="summary-box">
                <h3>' || v_pm_projects_count || '</h3>
                <p>Projects Managed</p>
            </div>
            <div class="summary-box">
                <h3>' || v_pm_total_tasks || '</h3>
                <p>Total Pending Tasks</p>
            </div>
            <div class="summary-box" style="' || CASE WHEN v_pm_urgent_tasks > 0 THEN 'background-color: #ffebee;' ELSE '' END || '">
                <h3 style="' || CASE WHEN v_pm_urgent_tasks > 0 THEN 'color: #d32f2f;' ELSE '' END || '">' || v_pm_urgent_tasks || '</h3>
                <p style="' || CASE WHEN v_pm_urgent_tasks > 0 THEN 'color: #d32f2f; font-weight: bold;' ELSE '' END || '">Tasks Due TODAY</p>
            </div>
        </div>';
            
            IF v_pm_urgent_tasks > 0 THEN
                v_email_html := v_email_html || '
        <div class="urgent-banner">
            🚨 ATTENTION: ' || v_pm_urgent_tasks || ' task(s) with deadline TODAY across your projects! 🚨
        </div>';
            END IF;
            
            v_email_html := v_email_html || '
        <div class="content">
            <table>
                <thead>
                    <tr>
                        <th style="width: 35%;">Task Name</th>
                        <th style="width: 20%;">Assigned AR</th>
                        <th style="width: 20%; text-align: center;">Deadline</th>
                        <th style="width: 15%; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ' || v_task_rows_html || '
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p><strong>📌 Legend:</strong></p>
            <p>🔴 Red Background = Due TODAY | 🟡 Orange Text = Due Soon (1-3 days) | 📁 Blue Row = Project Name</p>
            <p style="margin-top: 15px;">This is an automated daily digest from the zHeight AI project management system.</p>
            <p>Sent at 9:30 AM | ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '</p>
            <p style="margin-top: 15px;">© ' || EXTRACT(YEAR FROM NOW()) || ' zHeight AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>';
            
            -- Create plain text version for PM
            v_email_text := 'Project Manager Daily Digest - ' || TO_CHAR(v_today, 'Day, Month DD, YYYY') || '

Good Morning ' || v_pm.pm_name || ',

Consolidated Report:
===================
Projects Managed: ' || v_pm_projects_count || '
Total Pending Tasks: ' || v_pm_total_tasks || '
Tasks Due TODAY: ' || v_pm_urgent_tasks || '
' || CASE WHEN v_pm_urgent_tasks > 0 THEN '
⚠️ URGENT: ' || v_pm_urgent_tasks || ' task(s) due TODAY!
' ELSE '' END || '

YOUR PROJECTS & TASKS:
=====================' || v_task_rows_text || '

---
This is an automated daily digest from zHeight AI.
Sent at 9:30 AM | ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '
';
            
            -- Insert PM digest into email queue
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
                    'urgent_tasks', v_pm_urgent_tasks,
                    'digest_date', v_today
                )
            );
            
            RAISE NOTICE 'PM digest email queued for: % (%) - % projects, % tasks (% urgent)', 
                v_pm.pm_name, v_pm.pm_email, v_pm_projects_count, v_pm_total_tasks, v_pm_urgent_tasks;
        ELSE
            RAISE NOTICE 'No pending tasks in PM projects: % (%) - skipping digest', v_pm.pm_name, v_pm.pm_email;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Daily task digest generation completed at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_daily_task_digest() IS 'Generates daily task digest emails for ARs and PMs at 9:30 AM - ARs get individual tasks, PMs get consolidated project report - highlights same-day deadlines in RED BOLD';
