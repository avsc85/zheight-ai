-- Insert default tasks for all projects created today that don't have any tasks yet
INSERT INTO public.project_tasks (project_id, task_name, milestone_number, hours)
SELECT 
  p.id as project_id,
  task_data.task_name,
  task_data.milestone_number,
  task_data.hours
FROM public.projects p
CROSS JOIN (
  VALUES 
    ('Floor Plan + Site Map', 1, 6),
    ('Elevations', 2, 5),
    ('Finalization PF w/t Customer', 3, 6),
    ('Final Submission Set', 4, 2),
    ('Revision', 5, 3)
) AS task_data(task_name, milestone_number, hours)
WHERE p.deleted_at IS NULL
  AND p.created_at >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM public.project_tasks pt WHERE pt.project_id = p.id
  );