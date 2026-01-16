-- Fix search_path for the urgent project function
CREATE OR REPLACE FUNCTION public.set_urgent_project_active()
RETURNS TRIGGER AS $$
BEGIN
  -- For new projects marked as urgent, set status to active
  IF NEW.status = 'urgent' THEN
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;