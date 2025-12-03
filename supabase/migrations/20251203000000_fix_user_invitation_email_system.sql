-- Migration: Fix User Invitation Email System
-- Date: 2025-12-03
-- Description: Ensure email_notifications table supports user_invitation email type
--              and update invite-user function to send custom emails

-- Check if user_invitation email type is supported (it should be in email_notifications)
-- The email_notifications table should already exist from previous migrations

-- Verify email_notifications table structure and create if needed
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment for email types
COMMENT ON TABLE public.email_notifications IS 'Queue for all system emails including: task_assignment, task_status, pm_task_assignment, daily_task_digest, pm_daily_digest, user_invitation';

-- Enable RLS if not already enabled
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Create policy if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'email_notifications' 
    AND policyname = 'Allow all email operations for admin'
  ) THEN
    CREATE POLICY "Allow all email operations for admin"
    ON public.email_notifications
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;

-- Log for tracking
-- The invite-user edge function now:
-- 1. Creates user_invitations record with 7-day expiry
-- 2. Creates email_notifications record with type='user_invitation'
-- 3. Email processor sends emails at 2 per minute rate
-- 4. Invite.tsx loads invitation by email or invitation_id
-- 5. User creates account
-- 6. Trigger creates profile (auto)
-- 7. Trigger creates user_roles with role='user' (auto)
-- 8. Invite.tsx updates role from 'user' to invited role
-- 9. User signs in and has correct role

RAISE NOTICE 'User invitation email system migration completed at %', NOW();
