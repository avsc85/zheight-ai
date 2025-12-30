
-- Assign Nipunika as PM for projects where Sankar or Sahad have assigned tasks
-- Skip projects where Vidushi is already PM
UPDATE projects 
SET project_manager_name = 'Nipunika',
    updated_at = now()
WHERE id IN (
  SELECT DISTINCT p.id
  FROM projects p
  JOIN project_tasks pt ON pt.project_id = p.id
  JOIN profiles pr ON pr.user_id = pt.assigned_ar_id
  WHERE (pr.name ILIKE '%Sankar%' OR pr.name ILIKE '%Sahad%')
    AND p.deleted_at IS NULL
    AND (p.project_manager_name IS NULL OR p.project_manager_name NOT ILIKE '%Vidushi%')
)
