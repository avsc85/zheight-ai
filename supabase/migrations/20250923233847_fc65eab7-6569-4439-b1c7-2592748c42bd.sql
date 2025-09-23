-- Change hours field from text to integer in project_tasks table
-- First, update any non-numeric values to 0
UPDATE project_tasks 
SET hours = '0' 
WHERE hours !~ '^[0-9]+$' OR hours IS NULL;

-- Now convert the column to integer
ALTER TABLE project_tasks 
  ALTER COLUMN hours TYPE integer USING hours::integer;

-- Set default value for hours
ALTER TABLE project_tasks 
  ALTER COLUMN hours SET DEFAULT 0;

-- Function to calculate and update hours_allocated in projects table
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
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update hours_allocated when project tasks change
CREATE TRIGGER trigger_update_project_hours_allocated
    AFTER INSERT OR UPDATE OR DELETE ON project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_project_hours_allocated();

-- Function to calculate time_percentage dynamically
CREATE OR REPLACE FUNCTION calculate_time_percentage(task_hours integer, total_project_hours integer)
RETURNS numeric AS $$
BEGIN
    IF total_project_hours = 0 OR total_project_hours IS NULL THEN
        RETURN 0;
    END IF;
    RETURN ROUND((task_hours::numeric / total_project_hours::numeric) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Update existing hours_allocated values for all projects
UPDATE projects 
SET hours_allocated = (
    SELECT COALESCE(SUM(hours), 0) 
    FROM project_tasks 
    WHERE project_tasks.project_id = projects.id
);