-- Verify and Fix User Roles
-- This ensures all role enum values exist and user_roles table has correct data

-- ============================================
-- STEP 1: Verify app_role enum values
-- ============================================

-- Check current enum values
DO $$
BEGIN
    RAISE NOTICE 'Current app_role enum values:';
    RAISE NOTICE '%', (
        SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'app_role'
    );
END $$;

-- Add missing values if they don't exist
DO $$
BEGIN
    -- Add 'pm' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'app_role' AND e.enumlabel = 'pm'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'pm';
        RAISE NOTICE 'Added role: pm';
    END IF;

    -- Add 'ar1_planning' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'app_role' AND e.enumlabel = 'ar1_planning'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'ar1_planning';
        RAISE NOTICE 'Added role: ar1_planning';
    END IF;

    -- Add 'ar2_field' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'app_role' AND e.enumlabel = 'ar2_field'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'ar2_field';
        RAISE NOTICE 'Added role: ar2_field';
    END IF;
END $$;

-- ============================================
-- STEP 2: Check user_roles table data
-- ============================================

-- Show current user roles
SELECT 
    ur.user_id,
    p.name as user_name,
    p.email,
    ur.role,
    ur.created_at
FROM public.user_roles ur
LEFT JOIN public.profiles p ON ur.user_id = p.user_id
ORDER BY ur.created_at DESC;

-- Count roles
SELECT 
    role,
    COUNT(*) as count
FROM public.user_roles
GROUP BY role
ORDER BY count DESC;

-- ============================================
-- STEP 3: Identify users without proper roles
-- ============================================

-- Find profiles without role assignments
SELECT 
    p.user_id,
    p.name,
    p.email,
    'NO ROLE ASSIGNED' as status
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.user_id IS NULL;

-- ============================================
-- NOTES FOR MANUAL FIXES:
-- ============================================
-- If you need to assign roles to users, use:
-- 
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('user-uuid-here', 'pm');
--
-- Or update existing roles:
--
-- UPDATE public.user_roles 
-- SET role = 'ar1_planning'
-- WHERE user_id = 'user-uuid-here';
--
-- Available roles: user, admin, pm, ar1_planning, ar2_field
