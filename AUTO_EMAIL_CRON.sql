-- ============================================
-- EMAIL AUTOMATION - PRODUCTION SETUP
-- Run in Supabase SQL Editor (ONE TIME ONLY)
-- ============================================

-- IMPORTANT: This cron job is ALREADY RUNNING in production
-- Only run this if setting up a new environment

-- Step 1: Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Disable auto-triggers (CRITICAL - prevents rate limit errors)
DROP TRIGGER IF EXISTS auto_process_emails_trigger ON email_notifications;
DROP TRIGGER IF EXISTS trigger_send_email_immediately ON email_notifications;
DROP TRIGGER IF EXISTS auto_process_new_emails ON email_notifications;

-- Step 3: Create cron job to process emails every 2 seconds
SELECT cron.schedule(
    'process-pending-emails',
    '*/2 * * * * *',  -- Every 2 seconds (30 runs/min = 60 emails/min capacity)
    $$
    SELECT net.http_post(
        url := 'https://tiiuowhbntuoepxpnobs.supabase.co/functions/v1/process-email-queue',
        headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaXVvd2hibnR1b2VweHBub2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MDY3ODAsImV4cCI6MjA3MTQ4Mjc4MH0.5CU1K-glTA2wtmZNlcNqs1wCZineMmMXUCVen77LmOA", "Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- Step 4: Verify cron job is created
SELECT * FROM cron.job WHERE jobname = 'process-pending-emails';

-- ============================================
-- SYSTEM OVERVIEW
-- ============================================
-- Flow: Task update → Emails queued as 'pending' → Cron processes every 2s
-- Edge function: Processes 2 emails per batch with 1-second delay
-- Capacity: 60 emails/minute (scalable for high volume)
-- No auto-triggers = No parallel processing = No rate limit errors ✅
-- ============================================
