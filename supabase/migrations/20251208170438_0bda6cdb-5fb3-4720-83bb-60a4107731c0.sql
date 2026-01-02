
-- Update Test User (admin@zheight.com) role to admin
UPDATE public.user_roles 
SET role = 'admin', updated_at = now()
WHERE user_id = '419c7a43-071e-4b7f-9014-93cc4caeb74d';
