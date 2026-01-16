-- Add approval_status and previous_status columns to project_tasks
ALTER TABLE public.project_tasks 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS previous_status text;

-- Add check constraint for valid approval statuses
ALTER TABLE public.project_tasks 
DROP CONSTRAINT IF EXISTS valid_approval_status;

ALTER TABLE public.project_tasks 
ADD CONSTRAINT valid_approval_status 
CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'));

-- Add comment describing the columns
COMMENT ON COLUMN public.project_tasks.approval_status IS 'Status of PM approval: pending, approved, rejected';
COMMENT ON COLUMN public.project_tasks.previous_status IS 'Previous task status stored for rejection rollback';