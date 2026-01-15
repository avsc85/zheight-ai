-- Cleanup script to remove unwanted tasks from project_tasks table
-- This keeps only the 5 default tasks and any task with meaningful data

-- Define the 5 default task names
-- 1. Floor Plan + Site Map
-- 2. Elevations
-- 3. Finalization PF w/t Customer
-- 4. Final Submission Set
-- 5. Revision

-- Step 1: Delete tasks that are NOT one of the 5 default tasks
-- AND have no meaningful data (no AR assigned, no due date, no hours, no notes)
DELETE FROM project_tasks
WHERE task_name NOT IN (
  'Floor Plan + Site Map',
  'Elevations', 
  'Finalization PF w/t Customer',
  'Final Submission Set',
  'Revision'
)
AND (assigned_ar_id IS NULL)
AND (due_date IS NULL OR due_date = '')
AND (hours IS NULL OR hours = 0)
AND (notes_tasks IS NULL OR notes_tasks = '')
AND (notes_tasks_ar IS NULL OR notes_tasks_ar = '')
AND (notes_tasks_pm IS NULL OR notes_tasks_pm = '')
AND task_status = 'in_queue';

-- Step 2: For tasks that are duplicates of the 5 default tasks within the same project,
-- keep only the one with meaningful data or the first one if none have data
-- First, identify and delete duplicate default tasks (keeping the one with most data or lowest milestone_number)
WITH ranked_tasks AS (
  SELECT 
    task_id,
    project_id,
    task_name,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, task_name 
      ORDER BY 
        -- Prioritize tasks with meaningful data
        CASE WHEN assigned_ar_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN due_date IS NOT NULL AND due_date != '' THEN 0 ELSE 1 END,
        CASE WHEN hours > 0 THEN 0 ELSE 1 END,
        CASE WHEN notes_tasks IS NOT NULL AND notes_tasks != '' THEN 0 ELSE 1 END,
        milestone_number ASC
    ) as rn
  FROM project_tasks
  WHERE task_name IN (
    'Floor Plan + Site Map',
    'Elevations', 
    'Finalization PF w/t Customer',
    'Final Submission Set',
    'Revision'
  )
)
DELETE FROM project_tasks
WHERE task_id IN (
  SELECT task_id FROM ranked_tasks WHERE rn > 1
);

-- Step 3: Update milestone numbers for remaining default tasks to ensure correct order
WITH ordered_tasks AS (
  SELECT 
    task_id,
    project_id,
    task_name,
    CASE task_name
      WHEN 'Floor Plan + Site Map' THEN 1
      WHEN 'Elevations' THEN 2
      WHEN 'Finalization PF w/t Customer' THEN 3
      WHEN 'Final Submission Set' THEN 4
      WHEN 'Revision' THEN 5
    END as new_milestone
  FROM project_tasks
  WHERE task_name IN (
    'Floor Plan + Site Map',
    'Elevations', 
    'Finalization PF w/t Customer',
    'Final Submission Set',
    'Revision'
  )
)
UPDATE project_tasks pt
SET milestone_number = ot.new_milestone
FROM ordered_tasks ot
WHERE pt.task_id = ot.task_id;

-- Step 4: Insert missing default tasks for projects that don't have all 5
INSERT INTO project_tasks (project_id, task_name, milestone_number, hours, notes_tasks, task_status, assigned_skip_flag)
SELECT 
  p.id as project_id,
  dt.task_name,
  dt.milestone_number,
  dt.hours,
  '' as notes_tasks,
  'in_queue' as task_status,
  dt.skip_flag as assigned_skip_flag
FROM projects p
CROSS JOIN (
  VALUES 
    ('Floor Plan + Site Map', 1, 6, 'Y'),
    ('Elevations', 2, 5, 'N'),
    ('Finalization PF w/t Customer', 3, 6, 'N'),
    ('Final Submission Set', 4, 2, 'N'),
    ('Revision', 5, 3, 'N')
) AS dt(task_name, milestone_number, hours, skip_flag)
WHERE p.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM project_tasks pt 
  WHERE pt.project_id = p.id 
  AND pt.task_name = dt.task_name
);