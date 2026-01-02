-- Final Email System Migration
-- Combines all email functionality with rate limiting
-- Run this AFTER the core email migrations

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to process pending emails in batches with rate limiting
CREATE OR REPLACE FUNCTION process_pending_emails_batch()
RETURNS json AS $$
DECLARE
    processed_count INTEGER := 0;
    result json;
BEGIN
    -- Try to trigger email processing via HTTP
    BEGIN
        PERFORM net.http_post(
            url := 'https://tiiuowhbntuoepxpnobs.supabase.co/functions/v1/process-email-queue',
            headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaXVvd2hibnR1b2VweHBub2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQzNzYwODYsImV4cCI6MjAzOTk1MjA4Nn0.fS2rLFutTmy47wZHDjp7F_o8tN0iZ3HGOZoTuPJHDaQ", "Content-Type": "application/json"}'::jsonb,
            body := '{}'::jsonb
        );
        
        processed_count := 1;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Email processing error: %', SQLERRM;
    END;
    
    result := json_build_object(
        'processed', processed_count,
        'timestamp', NOW(),
        'pending_count', (SELECT COUNT(*) FROM email_notifications WHERE status = 'pending')
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-trigger function for new emails (rate limited)
CREATE OR REPLACE FUNCTION trigger_rate_limited_processing()
RETURNS trigger AS $$
BEGIN
    -- Process with 3 second delay to stay under Resend's 2 emails/second limit
    PERFORM pg_sleep(3);
    PERFORM process_pending_emails_batch();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic email processing
DROP TRIGGER IF EXISTS auto_process_new_emails ON email_notifications;
CREATE TRIGGER auto_process_new_emails
    AFTER INSERT ON email_notifications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_rate_limited_processing();

-- Scheduler function for bulk processing
CREATE OR REPLACE FUNCTION email_scheduler_with_delay()
RETURNS TABLE(batch_number INTEGER, processed INTEGER, pending INTEGER, run_time TIMESTAMP) AS $$
DECLARE
    batch_num INTEGER := 1;
    batch_result json;
    pending_count INTEGER;
BEGIN
    LOOP
        SELECT process_pending_emails_batch() INTO batch_result;
        
        SELECT COUNT(*) INTO pending_count 
        FROM email_notifications 
        WHERE status = 'pending';
        
        RETURN QUERY SELECT 
            batch_num, 
            (batch_result->>'processed')::INTEGER, 
            pending_count,
            NOW();
        
        EXIT WHEN pending_count = 0;
        PERFORM pg_sleep(5);
        batch_num := batch_num + 1;
        EXIT WHEN batch_num > 50;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;