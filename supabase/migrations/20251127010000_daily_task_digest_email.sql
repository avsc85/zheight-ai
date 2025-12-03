-- Migration: Daily Task Digest Email - CLEANUP VERSION
-- Date: 2025-12-03
-- Purpose: Deprecated function kept for backward compatibility
-- AR digest: Moved to generate_ar_daily_digest() in migration 20251203010000_separate_ar_pm_digests.sql
-- PM digest: Moved to generate_pm_daily_digest() in migration 20251203010000_separate_ar_pm_digests.sql

-- DEPRECATED FUNCTION - Kept for backward compatibility with old cron jobs
-- This function is now replaced by separate AR and PM digest functions
CREATE OR REPLACE FUNCTION public.generate_daily_task_digest()
RETURNS void AS $$
BEGIN
    -- DEPRECATED: This function is kept for backward compatibility only
    -- The actual digest generation is now handled by:
    -- - generate_ar_daily_digest() for AR users (9:00 AM IST)
    -- - generate_pm_daily_digest() for PM users (9:30 AM IST)
    
    -- Call both functions for full digest generation
    PERFORM public.generate_ar_daily_digest();
    PERFORM public.generate_pm_daily_digest();
    
    RAISE NOTICE 'Daily task digest (DEPRECATED wrapper) completed at % - called generate_ar_daily_digest() and generate_pm_daily_digest()', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_daily_task_digest() IS 'DEPRECATED - This is a wrapper function kept for backward compatibility. Use generate_ar_daily_digest() for AR digests and generate_pm_daily_digest() for PM digests instead.';

-- Keep the existing cron job for backward compatibility
-- The actual scheduling is now in migration 20251203010000_separate_ar_pm_digests.sql
-- with separate cron jobs for AR (9:00 AM) and PM (9:30 AM)

-- Note: To disable this deprecated function, uncomment the line below:
-- SELECT cron.unschedule('daily_task_digest');
