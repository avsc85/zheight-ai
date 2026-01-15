-- Update all projects created today to Active status
UPDATE public.projects 
SET status = 'Active', updated_at = now() 
WHERE deleted_at IS NULL 
  AND created_at >= CURRENT_DATE;