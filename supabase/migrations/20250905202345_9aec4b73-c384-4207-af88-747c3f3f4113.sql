-- Fix function search path issues by updating existing functions
CREATE OR REPLACE FUNCTION update_project_edit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_edit_timestamp = now();
  NEW.last_edit_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_task_step_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_step_timestamp = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_projects_edit_timestamp ON projects;
CREATE TRIGGER update_projects_edit_timestamp
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_project_edit_timestamp();

DROP TRIGGER IF EXISTS update_project_tasks_step_timestamp ON project_tasks;
CREATE TRIGGER update_project_tasks_step_timestamp
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_step_timestamp();

-- Create trigger for notes updated_at
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();