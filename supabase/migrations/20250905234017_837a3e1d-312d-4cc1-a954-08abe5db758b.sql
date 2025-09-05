-- Step 1: Add split notes fields to project_tasks table
ALTER TABLE public.project_tasks 
ADD COLUMN notes_tasks_ar text,
ADD COLUMN notes_tasks_pm text;

-- Step 2: Add completion_date column if it doesn't exist
ALTER TABLE public.project_tasks 
ADD COLUMN IF NOT EXISTS completion_date timestamp with time zone;

-- Step 3: Create function to update completion_date when task status changes to completed
CREATE OR REPLACE FUNCTION public.update_task_completion_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set completion_date when task is marked as completed
  IF NEW.task_status = 'completed' AND OLD.task_status != 'completed' THEN
    NEW.completion_date = now();
  END IF;
  
  -- Clear completion_date if task is moved away from completed
  IF NEW.task_status != 'completed' AND OLD.task_status = 'completed' THEN
    NEW.completion_date = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Create trigger for automatic completion_date updates
DROP TRIGGER IF EXISTS trigger_update_task_completion_date ON public.project_tasks;
CREATE TRIGGER trigger_update_task_completion_date
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_completion_date();

-- Step 5: Enable realtime for project_tasks table
ALTER TABLE public.project_tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_tasks;

-- Step 6: Enable realtime for projects table  
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;