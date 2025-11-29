# Daily Digest Bug Fix - Summary

## Problem Identified
**PM Daily Digest emails were NOT being sent to Project Managers**

### Root Cause
The `generate_daily_task_digest()` function had an incorrect JOIN condition in the PM digest query:

```sql
-- BROKEN:
JOIN profiles p ON p.user_id = proj.project_manager_id
-- Error: projects table does NOT have project_manager_id column!
```

The `projects` table stores:
- `project_manager_name` (TEXT) - The PM's name
- NOT `project_manager_id` (UUID)

But the query was looking for `project_manager_id` which doesn't exist!

### Impact
- ✗ PMs received 0 emails (no matches found)
- ✗ PM consolidated report never generated
- ✓ ARs still got individual daily digests (different query path)

---

## Solution
Change the PM digest JOIN to use the correct column mapping:

```sql
-- FIXED:
JOIN profiles p ON p.name = proj.project_manager_name
-- Now correctly matches PM name with profile name
```

### What Changed
**File:** `supabase/migrations/20251127010000_daily_task_digest_email.sql`

**Line 369 (PM Digest Query):**
```sql
-- OLD:
FROM projects proj
  LEFT JOIN profiles p ON p.user_id = proj.project_manager_id
  ...

-- NEW:
FROM projects proj
  INNER JOIN profiles p ON p.name = proj.project_manager_name
  ...
```

### Why INNER JOIN Instead of LEFT JOIN?
- If `project_manager_name` is NULL or doesn't match any profile, we don't need a PM digest
- INNER JOIN filters out projects with invalid PM names
- Cleaner logic: only send PM emails if PM actually exists in system

---

## Testing Steps

### 1. Verify Projects Have PM Names
```sql
SELECT COUNT(*) as total_projects,
       COUNT(DISTINCT project_manager_name) as unique_pms
FROM projects
WHERE project_manager_name IS NOT NULL;
```
Expected: Both counts > 0

### 2. Verify PMs Exist in Profiles
```sql
SELECT DISTINCT project_manager_name FROM projects
WHERE project_manager_name IS NOT NULL
EXCEPT
SELECT DISTINCT name FROM profiles;
```
Expected: 0 rows (all PMs exist in profiles)

### 3. Run Digest Function
```sql
SELECT generate_daily_task_digest();
```

### 4. Check Email Queue for PM Digests
```sql
SELECT 
    recipient_email,
    email_type,
    metadata->>'pm_name' as pm_name,
    metadata->>'project_count' as projects,
    created_at
FROM email_notifications
WHERE email_type = 'pm_daily_digest'
ORDER BY created_at DESC
LIMIT 10;
```

Expected Results:
- ✓ Multiple rows (one per PM with pending tasks)
- ✓ recipient_email populated (PM's actual email)
- ✓ pm_name matches project_manager_name
- ✓ project_count > 0 (has assigned projects)
- ✓ task metadata shows pending tasks

---

## Deployment Checklist

- [ ] Verify test queries above return expected results
- [ ] Confirm PM names in projects table
- [ ] Run `SELECT generate_daily_task_digest();` successfully
- [ ] Check email_notifications table for pm_daily_digest entries
- [ ] Test at 9:30 AM IST tomorrow (should see PM digest emails)
- [ ] Commit fix to git
- [ ] Push to GitHub

---

## Timeline

**Previous Issues:**
- ✓ Task status reset bug (FIXED - now using UPDATE instead of DELETE/INSERT)
- ✓ Email trigger firing on all updates (FIXED - now UPDATE OF specific columns)
- ✓ Duplicate emails for recently assigned tasks (FIXED - 12-hour exclusion)
- ✗ PM digest not sending (JUST FOUND - BEING FIXED NOW)

**Current Fix:**
- Change line 369 from `LEFT JOIN profiles p ON p.user_id = proj.project_manager_id`
- To: `INNER JOIN profiles p ON p.name = proj.project_manager_name`

---

## After Testing Confirms Fix Works

Once you verify the test queries show PM emails being generated:
1. Apply the SQL fix to Supabase
2. Commit changes: "Fix: PM daily digest query - use project_manager_name instead of project_manager_id"
3. Push to GitHub
4. Monitor tomorrow's 9:30 AM digest to confirm PMs receive emails
