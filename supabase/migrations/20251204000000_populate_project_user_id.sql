-- Populate missing user_id values in projects table
-- Match projects to users based on project_manager_name

UPDATE projects p
SET user_id = prof.user_id
FROM profiles prof
WHERE p.user_id IS NULL
  AND prof.name = p.project_manager_name
  AND prof.user_id IS NOT NULL;

-- Log the result
-- SELECT COUNT(*) as updated_projects FROM projects WHERE user_id IS NOT NULL;
