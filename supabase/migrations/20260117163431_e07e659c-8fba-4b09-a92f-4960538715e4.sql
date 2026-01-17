-- Remove the task status email trigger (now handled by Teams notifications)
DROP TRIGGER IF EXISTS trigger_task_status_update_email ON public.project_tasks;

-- Remove the associated function
DROP FUNCTION IF EXISTS log_task_status_update_email();