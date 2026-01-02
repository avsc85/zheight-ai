-- Auto-set assigned_skip_flag based on AR assignment
-- Business rule: If assigned_ar_id is not null, then assigned_skip_flag = 'Y', else 'N'

-- Update tasks with AR assigned to 'Y'
UPDATE project_tasks
SET assigned_skip_flag = 'Y'
WHERE assigned_ar_id IS NOT NULL
  AND assigned_skip_flag != 'Y';

-- Update tasks without AR assigned to 'N'
UPDATE project_tasks
SET assigned_skip_flag = 'N'
WHERE assigned_ar_id IS NULL
  AND assigned_skip_flag != 'N';

-- Log the updates
DO $$
DECLARE
  assigned_count INTEGER;
  unassigned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO assigned_count FROM project_tasks WHERE assigned_ar_id IS NOT NULL;
  SELECT COUNT(*) INTO unassigned_count FROM project_tasks WHERE assigned_ar_id IS NULL;
  
  RAISE NOTICE 'Updated tasks: % with AR assigned (Y), % without AR (N)', assigned_count, unassigned_count;
END $$;
