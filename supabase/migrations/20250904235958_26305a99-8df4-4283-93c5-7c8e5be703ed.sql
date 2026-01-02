-- First migration: Add new enum values
ALTER TYPE public.app_role ADD VALUE 'pm';
ALTER TYPE public.app_role ADD VALUE 'ar1_planning';
ALTER TYPE public.app_role ADD VALUE 'ar2_field';