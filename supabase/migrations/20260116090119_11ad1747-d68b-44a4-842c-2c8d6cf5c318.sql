-- Create a trigger function that sets status to 'active' for urgent projects
CREATE OR REPLACE FUNCTION public.set_urgent_project_active()
RETURNS TRIGGER AS $$
BEGIN
  -- For new projects marked as urgent, set status to active
  IF NEW.status = 'urgent' THEN
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires on INSERT
CREATE TRIGGER trigger_urgent_project_active
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_urgent_project_active();