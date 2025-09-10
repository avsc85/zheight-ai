-- Create a function to get project tasks with next unassigned task per project
CREATE OR REPLACE FUNCTION get_project_tasks_with_next_unassigned()
RETURNS TABLE (
  task_id uuid,
  project_id uuid,
  milestone_number integer,
  assigned_ar_id uuid,
  time_percentage integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  allocated_due_date date,
  completion_date date,
  last_step_timestamp timestamp with time zone,
  notes_tasks text,
  task_status text,
  notes_tasks_ar text,
  notes_tasks_pm text,
  task_name text,
  assigned_skip_flag text,
  due_date text,
  priority_exception text,
  hours text,
  task_type text,
  project_name text,
  user_id uuid,
  ar_planning_id uuid,
  ar_field_id uuid
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH assigned_tasks AS (
    SELECT 
      pt.*,
      'assigned' as task_type,
      p.project_name,
      p.user_id,
      p.ar_planning_id,
      p.ar_field_id
    FROM project_tasks pt
    JOIN projects p ON pt.project_id = p.id
    WHERE pt.assigned_skip_flag = 'Y'
      AND pt.task_status IN ('in_queue', 'started', 'blocked')
  ),
  next_unassigned_tasks AS (
    SELECT DISTINCT ON (pt.project_id)
      pt.*,
      'next_unassigned' as task_type,
      p.project_name,
      p.user_id,
      p.ar_planning_id,
      p.ar_field_id
    FROM project_tasks pt
    JOIN projects p ON pt.project_id = p.id
    WHERE pt.assigned_skip_flag = 'N'
    ORDER BY pt.project_id, pt.milestone_number ASC
  )
  SELECT * FROM assigned_tasks
  UNION ALL
  SELECT * FROM next_unassigned_tasks
  ORDER BY project_name, milestone_number;
$$;