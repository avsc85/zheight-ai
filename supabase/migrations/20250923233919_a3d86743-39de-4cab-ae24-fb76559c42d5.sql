-- Fix security issues by updating functions with proper search_path settings

-- Update the function to calculate and update hours_allocated with proper security settings
CREATE OR REPLACE FUNCTION update_project_hours_allocated()
RETURNS TRIGGER AS $$
BEGIN
    -- Update hours_allocated in projects table to sum of all task hours
    UPDATE projects 
    SET hours_allocated = (
        SELECT COALESCE(SUM(hours), 0) 
        FROM project_tasks 
        WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
    )
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Update the function to calculate time_percentage with proper security settings
CREATE OR REPLACE FUNCTION calculate_time_percentage(task_hours integer, total_project_hours integer)
RETURNS numeric AS $$
BEGIN
    IF total_project_hours = 0 OR total_project_hours IS NULL THEN
        RETURN 0;
    END IF;
    RETURN ROUND((task_hours::numeric / total_project_hours::numeric) * 100, 2);
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;