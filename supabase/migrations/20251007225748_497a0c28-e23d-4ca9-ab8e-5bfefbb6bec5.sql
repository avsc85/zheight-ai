-- Drop the overly permissive policy if it still exists
DROP POLICY IF EXISTS "Users can view invitations by email" ON public.user_invitations;

-- Drop the current restrictive policy to recreate it
DROP POLICY IF EXISTS "Restricted access to view invitations" ON public.user_invitations;

-- Create a secure SELECT policy that only allows:
-- 1. Anonymous users to view invitations (needed for signup flow)
-- 2. Authenticated users to view ONLY their own invitation by email
-- 3. Admins to view all invitations
CREATE POLICY "Secure invitation access"
ON public.user_invitations
FOR SELECT
USING (
  auth.role() = 'anon'::text 
  OR (
    auth.role() = 'authenticated'::text 
    AND email = (auth.jwt() ->> 'email'::text)
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);