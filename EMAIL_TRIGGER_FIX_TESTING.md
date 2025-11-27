# Email Trigger Fix - Testing Guide

## Date: November 27, 2025

---

## 🐛 Issue Fixed

**Problem:** When updating a task to assign a NEW AR, both OLD and NEW AR were receiving "new assignment" emails.

**Root Cause:** Trigger condition wasn't explicit enough about AR changes.

**Solution:** 
1. More explicit AR change detection with IF/ELSE
2. Added safety check for valid email
3. Enhanced logging to track old_ar_id, new_ar_id, and email sent
4. Better RAISE NOTICE messages for debugging

---

## 📝 Changes Made

### File: `supabase/migrations/20251127000000_fix_task_assignment_email_trigger.sql`

**Key Improvements:**

1. **Explicit AR Change Check (Lines 14-24):**
```sql
IF (OLD.assigned_ar_id IS DISTINCT FROM NEW.assigned_ar_id) AND NEW.assigned_ar_id IS NOT NULL THEN
    v_should_send := TRUE;
    RAISE NOTICE 'AR changed from % to % for task %', OLD.assigned_ar_id, NEW.assigned_ar_id, NEW.task_id;
ELSE
    v_should_send := FALSE;
    RAISE NOTICE 'AR not changed - skipping email';
END IF;
```

2. **Email Safety Check (Lines 40-44):**
```sql
IF v_ar_email IS NULL THEN
    RAISE WARNING 'Could not find email for AR ID: %', NEW.assigned_ar_id;
    RETURN NEW;
END IF;
```

3. **Enhanced Metadata for Debugging (Lines 159-170):**
```sql
jsonb_build_object(
    'task_id', NEW.task_id,
    'assigned_ar_id', NEW.assigned_ar_id,
    'old_ar_id', OLD.assigned_ar_id,      -- NEW: Track old AR
    'ar_email', v_ar_email,               -- NEW: Track email sent to
    'trigger_operation', TG_OP            -- NEW: Track INSERT vs UPDATE
)
```

---

## 🧪 How to Test

### Step 1: Apply the Migration

Run this migration in Supabase SQL Editor:

```sql
-- Copy contents of: supabase/migrations/20251127000000_fix_task_assignment_email_trigger.sql
-- Paste in Supabase SQL Editor and run
```

### Step 2: Test Scenario 1 - UPDATE AR (Main Fix)

**Before:** Both old and new AR got email ❌  
**After:** Only new AR gets email ✅

```sql
-- Scenario: Change AR from User A to User B
-- Expected: Only User B gets email

-- 1. Update task to assign new AR
UPDATE public.project_tasks
SET assigned_ar_id = 'USER_B_UUID'
WHERE task_id = 'TEST_TASK_ID';

-- 2. Check email_notifications table
SELECT 
    recipient_email,
    email_type,
    metadata->>'assigned_ar_id' as new_ar,
    metadata->>'old_ar_id' as old_ar,
    metadata->>'ar_email' as email_sent_to,
    metadata->>'trigger_operation' as operation,
    created_at
FROM public.email_notifications
WHERE email_type = 'task_assignment'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Expected Result:
-- - recipient_email = User B's email
-- - new_ar = USER_B_UUID
-- - old_ar = USER_A_UUID
-- - email_sent_to = User B's email
-- - operation = UPDATE
-- - Only ONE email created (not two)
```

### Step 3: Test Scenario 2 - INSERT New Task

**Expected:** Email sent when task created with AR + due_date ✅

```sql
-- 1. Insert new task with AR and due date
INSERT INTO public.project_tasks (
    project_id,
    task_name,
    assigned_ar_id,
    due_date
) VALUES (
    'PROJECT_UUID',
    'Test Task',
    'USER_UUID',
    '2025-12-01'
);

-- 2. Check email created
SELECT 
    recipient_email,
    metadata->>'assigned_ar_id' as ar_id,
    metadata->>'trigger_operation' as operation
FROM public.email_notifications
WHERE email_type = 'task_assignment'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- - recipient_email = User's email
-- - ar_id = USER_UUID
-- - operation = INSERT
```

### Step 4: Test Scenario 3 - UPDATE Other Fields (Should NOT Send Email)

**Expected:** No email when updating fields OTHER than assigned_ar_id ✅

```sql
-- 1. Update task_status or due_date (NOT AR)
UPDATE public.project_tasks
SET task_status = 'completed'
WHERE task_id = 'TEST_TASK_ID';

-- 2. Check email_notifications
SELECT COUNT(*) as emails_created
FROM public.email_notifications
WHERE email_type = 'task_assignment'
AND created_at > NOW() - INTERVAL '1 minute';

-- Expected: 0 emails created (AR didn't change)
```

### Step 5: Check Logs in Supabase

1. Go to **Supabase Dashboard → Logs → Postgres Logs**
2. Look for NOTICE messages:
   - ✅ "AR changed from X to Y for task Z" (when AR changes)
   - ✅ "AR not changed - skipping email" (when other fields update)
   - ✅ "Email notification logged for task..." (when email created)

---

## 🔍 Verify in Production

### Query to Check Recent Email Behavior

```sql
-- Check last 10 task assignment emails
SELECT 
    en.recipient_email,
    en.created_at,
    en.status,
    en.metadata->>'task_name' as task,
    en.metadata->>'ar_name' as assigned_to,
    en.metadata->>'ar_email' as email_to,
    en.metadata->>'old_ar_id' as previous_ar,
    en.metadata->>'assigned_ar_id' as new_ar,
    en.metadata->>'trigger_operation' as operation
FROM public.email_notifications en
WHERE en.email_type = 'task_assignment'
ORDER BY en.created_at DESC
LIMIT 10;
```

### Expected Results:

**For UPDATE operations:**
- `old_ar_id` should be different from `assigned_ar_id`
- `recipient_email` should match `ar_email` (new AR's email)
- Only ONE email per AR change

**For INSERT operations:**
- `old_ar_id` will be NULL
- `assigned_ar_id` will have UUID
- `recipient_email` matches assigned AR

---

## 🚨 Rollback (If Needed)

If anything goes wrong, you can rollback to the previous version:

```sql
-- Rollback: Restore original function
CREATE OR REPLACE FUNCTION public.log_task_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
    v_project_name TEXT;
    v_ar_name TEXT;
    v_ar_email TEXT;
    v_email_subject TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_due_date_formatted TEXT;
    v_should_send BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_should_send := (NEW.assigned_ar_id IS NOT NULL AND NEW.due_date IS NOT NULL);
    ELSIF TG_OP = 'UPDATE' THEN
        v_should_send := (
            NEW.assigned_ar_id IS NOT NULL AND 
            OLD.assigned_ar_id IS DISTINCT FROM NEW.assigned_ar_id
        );
    END IF;
    
    IF v_should_send THEN
        -- ... (rest of original function)
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## ✅ Success Criteria

- [ ] Migration runs without errors
- [ ] Updating AR sends email ONLY to NEW AR
- [ ] Updating other fields does NOT trigger email
- [ ] INSERT with AR + due_date sends email
- [ ] Logs show correct "AR changed" or "AR not changed" messages
- [ ] email_notifications table has enhanced metadata

---

## 📊 Monitoring

### Daily Check Query

Run this daily to verify email behavior:

```sql
-- Check for duplicate emails (same task, multiple recipients)
SELECT 
    metadata->>'task_id' as task_id,
    metadata->>'task_name' as task_name,
    COUNT(*) as email_count,
    ARRAY_AGG(recipient_email) as recipients,
    ARRAY_AGG(metadata->>'ar_email') as ar_emails
FROM public.email_notifications
WHERE email_type = 'task_assignment'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY metadata->>'task_id', metadata->>'task_name'
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)
```

If duplicates found:
1. Check if task was updated multiple times (legitimate)
2. Check if old_ar_id and assigned_ar_id are actually different
3. Verify recipient_email matches new AR's email

---

## 📞 Next Steps

After applying this fix:
1. ✅ Run all test scenarios above
2. ✅ Verify logs in Supabase
3. ✅ Monitor for 24 hours
4. ✅ Confirm with team that emails are correct
5. 🔄 Move to new email feature implementation

