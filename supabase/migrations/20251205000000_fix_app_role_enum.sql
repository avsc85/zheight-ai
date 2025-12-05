-- Fix app_role enum to include all roles used in the system
-- The original enum only had 'user' and 'admin' but the system uses 5 roles

-- Add missing role values to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pm';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ar1_planning';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ar2_field';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Verify the enum now has all values
-- Expected values: user, admin, pm, ar1_planning, ar2_field, moderator
COMMENT ON TYPE public.app_role IS 'Application roles: user (default), admin (full access), pm (project manager), ar1_planning (AR planning), ar2_field (AR field), moderator';
