-- Restore all soft-deleted projects by setting deleted_at back to NULL
UPDATE projects
SET deleted_at = NULL, updated_at = now()
WHERE deleted_at IS NOT NULL;

-- Verify restoration
SELECT COUNT(*) as restored_count FROM projects WHERE deleted_at IS NULL;