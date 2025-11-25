-- Fix the drag and drop zone IDs by ensuring proper droppable setup
-- First, let's check if there are any issues with the constraint by temporarily seeing what values are being sent

-- Let's also make sure we have proper droppable zones set up
-- The issue might be that the drag and drop zones aren't properly configured

-- For now, let's make sure the constraint allows the exact values we need
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_milestones_status_check;

-- Recreate the constraint with the correct status values
ALTER TABLE project_tasks ADD CONSTRAINT project_milestones_status_check 
CHECK (task_status IN ('in_queue', 'started', 'completed', 'blocked'));