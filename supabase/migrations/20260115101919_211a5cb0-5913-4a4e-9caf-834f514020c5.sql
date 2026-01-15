-- Create function to auto-generate default tasks for a project
CREATE OR REPLACE FUNCTION public.create_default_tasks_for_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create tasks if none exist for this project
  IF NOT EXISTS (SELECT 1 FROM project_tasks WHERE project_id = NEW.id) THEN
    -- Insert 5 default tasks with proper milestone numbers
    INSERT INTO project_tasks (project_id, milestone_number, task_name, assigned_ar_id, assigned_skip_flag, task_status, hours)
    VALUES 
      (NEW.id, 1, 'Floor Plan + Site Map', NULL, 'N', 'in_queue', 6),
      (NEW.id, 2, 'Elevations', NULL, 'N', 'in_queue', 5),
      (NEW.id, 3, 'Finalization PF w/t Customer', NULL, 'N', 'in_queue', 6),
      (NEW.id, 4, 'Final Submission Set', NULL, 'N', 'in_queue', 2),
      (NEW.id, 5, 'Revision', NULL, 'N', 'in_queue', 3);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create default tasks when a project is inserted
DROP TRIGGER IF EXISTS trigger_create_default_tasks ON projects;
CREATE TRIGGER trigger_create_default_tasks
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_default_tasks_for_project();

-- Also create a trigger for when projects are restored (deleted_at set to NULL)
CREATE OR REPLACE FUNCTION public.create_default_tasks_on_restore()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when a project is being restored (deleted_at changes from NOT NULL to NULL)
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    -- Only create tasks if none exist for this project
    IF NOT EXISTS (SELECT 1 FROM project_tasks WHERE project_id = NEW.id) THEN
      INSERT INTO project_tasks (project_id, milestone_number, task_name, assigned_ar_id, assigned_skip_flag, task_status, hours)
      VALUES 
        (NEW.id, 1, 'Floor Plan + Site Map', NULL, 'N', 'in_queue', 6),
        (NEW.id, 2, 'Elevations', NULL, 'N', 'in_queue', 5),
        (NEW.id, 3, 'Finalization PF w/t Customer', NULL, 'N', 'in_queue', 6),
        (NEW.id, 4, 'Final Submission Set', NULL, 'N', 'in_queue', 2),
        (NEW.id, 5, 'Revision', NULL, 'N', 'in_queue', 3);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_default_tasks_on_restore ON projects;
CREATE TRIGGER trigger_create_default_tasks_on_restore
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_default_tasks_on_restore();

-- Backfill: Create default tasks for all existing projects that have no tasks
INSERT INTO project_tasks (project_id, milestone_number, task_name, assigned_ar_id, assigned_skip_flag, task_status, hours)
SELECT 
  p.id,
  task_info.milestone_number,
  task_info.task_name,
  NULL,
  'N',
  'in_queue',
  task_info.hours
FROM projects p
CROSS JOIN (
  VALUES 
    (1, 'Floor Plan + Site Map', 6),
    (2, 'Elevations', 5),
    (3, 'Finalization PF w/t Customer', 6),
    (4, 'Final Submission Set', 2),
    (5, 'Revision', 3)
) AS task_info(milestone_number, task_name, hours)
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM project_tasks pt WHERE pt.project_id = p.id);