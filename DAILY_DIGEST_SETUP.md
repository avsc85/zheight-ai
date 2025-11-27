# Daily Task Digest Email - Setup Guide

## Feature Overview

**What it does:**
- ✅ Sends email to all ARs every morning at 9:30 AM
- ✅ Lists all pending tasks (status: `in_queue` or `started`)
- ✅ Sorted by deadline (earliest first)
- ✅ **Highlights same-day deadlines in BIG RED BOLD** 🔴
- ✅ Shows task count summary
- ✅ Only sends if AR has pending tasks

---

## 🚀 Setup Instructions

### Step 1: Apply Database Migration

Run this in **Supabase SQL Editor:**

```sql
-- Copy entire contents of:
-- supabase/migrations/20251127010000_daily_task_digest_email.sql
-- Paste and run in Supabase SQL Editor
```

This creates the `generate_daily_task_digest()` function.

### Step 2: Deploy Edge Function

```powershell
# Navigate to project root
cd d:\zheight\zheight-ai-main

# Deploy the function
supabase functions deploy daily-task-digest

# Verify deployment
supabase functions list
```

### Step 3: Set Up Cron Job in Supabase

1. Go to **Supabase Dashboard → Database → Cron Jobs**
2. Click **"Create a new cron job"**
3. Fill in:
   - **Name:** `daily-task-digest-9-30am`
   - **Schedule:** `30 9 * * *` (Every day at 9:30 AM)
   - **SQL Command:**
     ```sql
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-task-digest',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
       ),
       body := '{}'::jsonb
     );
     ```
   - Replace `YOUR_PROJECT_REF` with your actual Supabase project reference

4. Click **Create**

**Alternative: Using pg_cron extension**

```sql
-- Enable pg_cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily digest at 9:30 AM (India timezone: UTC+5:30 = 4:00 AM UTC)
SELECT cron.schedule(
    'daily-task-digest-9-30am',
    '0 4 * * *',  -- 4:00 AM UTC = 9:30 AM IST
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-task-digest',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) AS request_id;
    $$
);
```

### Step 4: Test the Function Manually

```sql
-- Test: Generate digest immediately
SELECT generate_daily_task_digest();

-- Check: Verify emails queued
SELECT 
    recipient_email,
    subject,
    metadata->>'total_tasks' as tasks,
    metadata->>'urgent_tasks' as urgent,
    created_at
FROM email_notifications
WHERE email_type = 'daily_task_digest'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📧 Email Features

### Summary Section
- Total pending tasks
- Tasks in queue count
- Tasks started count
- **Red warning if any tasks due TODAY**

### Task Table (Sorted by Deadline)
| Task Name | Project | Deadline | Status |
|-----------|---------|----------|--------|
| Task 1 | Project A | **DUE TODAY** 🔴 | Started |
| Task 2 | Project B | Tomorrow (orange) | In Queue |
| Task 3 | Project C | Dec 5, 2025 | Started |

### Visual Indicators:
- 🔴 **Red background + RED BOLD text** for tasks due TODAY
- 🟡 **Orange text** for tasks due in 1-3 days (Tomorrow, In 2 days, etc.)
- 📅 **"DUE TODAY"** badge in big red bold
- 🚨 **Urgent banner** at top if any tasks due today

---

## 🧪 Testing Scenarios

### Test 1: AR with Tasks Due Today

```sql
-- Create test task due today
INSERT INTO project_tasks (project_id, task_name, assigned_ar_id, due_date, task_status)
VALUES (
    'YOUR_PROJECT_ID',
    'Urgent Task - Submit Plans',
    'AR_USER_ID',
    CURRENT_DATE::text,
    'started'
);

-- Generate digest
SELECT generate_daily_task_digest();

-- Check email
SELECT subject, body_html FROM email_notifications
WHERE email_type = 'daily_task_digest'
ORDER BY created_at DESC LIMIT 1;
```

**Expected Result:**
- Email has **RED URGENT BANNER** at top
- Task row has **red background**
- Deadline shows **"DUE TODAY"** in red bold
- Subject line includes **(1 DUE TODAY!)**

### Test 2: AR with No Pending Tasks

```sql
-- Mark all tasks as completed
UPDATE project_tasks
SET task_status = 'completed'
WHERE assigned_ar_id = 'AR_USER_ID';

-- Generate digest
SELECT generate_daily_task_digest();

-- Check: No email should be created
SELECT COUNT(*) FROM email_notifications
WHERE email_type = 'daily_task_digest'
AND created_at > NOW() - INTERVAL '1 minute';
-- Expected: 0 (no email sent)
```

### Test 3: Multiple ARs with Different Tasks

```sql
-- Generate digest for all ARs
SELECT generate_daily_task_digest();

-- Check emails per AR
SELECT 
    recipient_email,
    metadata->>'ar_name' as ar_name,
    metadata->>'total_tasks' as tasks,
    metadata->>'urgent_tasks' as urgent
FROM email_notifications
WHERE email_type = 'daily_task_digest'
ORDER BY created_at DESC;
```

---

## 🎨 Email Preview

**Subject Line Examples:**
- `📋 Daily Task Digest - 5 Pending Tasks`
- `📋 Daily Task Digest - 3 Pending Tasks (1 DUE TODAY!)`
- `📋 Daily Task Digest - 8 Pending Tasks (2 DUE TODAY!)`

**Email Body (HTML):**
- Beautiful gradient header (purple/blue)
- Summary box with stats
- **RED URGENT BANNER** if tasks due today
- Clean table with color-coded rows
- Footer with timestamp and legend

---

## 🔧 Customization Options

### Change Time (from 9:30 AM to different time)

```sql
-- Example: Change to 8:00 AM (2:30 AM UTC)
SELECT cron.schedule(
    'daily-task-digest-8am',
    '30 2 * * *',  -- 2:30 AM UTC = 8:00 AM IST
    $$ SELECT generate_daily_task_digest(); $$
);
```

### Include Different Task Statuses

Edit migration file, line ~53:
```sql
-- Current: Only in_queue and started
WHERE pt.task_status IN ('in_queue', 'started')

-- Change to include 'pending' status too:
WHERE pt.task_status IN ('in_queue', 'started', 'pending')
```

### Change "Due Soon" Threshold

Edit migration file, line ~110:
```sql
-- Current: Highlights tasks due in 1-3 days
WHEN v_task.days_until_due <= 3 THEN ...

-- Change to 5 days:
WHEN v_task.days_until_due <= 5 THEN ...
```

---

## 📊 Monitoring

### Daily Check Query

```sql
-- Check if digest ran today
SELECT 
    DATE(created_at) as digest_date,
    COUNT(DISTINCT recipient_email) as ars_emailed,
    COUNT(*) as total_emails,
    SUM((metadata->>'total_tasks')::int) as total_tasks,
    SUM((metadata->>'urgent_tasks')::int) as urgent_tasks
FROM email_notifications
WHERE email_type = 'daily_task_digest'
AND created_at >= CURRENT_DATE
GROUP BY DATE(created_at);
```

### View Last Digest Details

```sql
SELECT 
    metadata->>'ar_name' as ar_name,
    recipient_email,
    metadata->>'total_tasks' as pending_tasks,
    metadata->>'urgent_tasks' as urgent_tasks,
    status,
    created_at
FROM email_notifications
WHERE email_type = 'daily_task_digest'
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✅ Success Checklist

- [ ] Migration applied successfully
- [ ] Edge function deployed
- [ ] Cron job scheduled for 9:30 AM
- [ ] Test email generated and sent
- [ ] Red highlighting works for same-day deadlines
- [ ] No email sent to ARs with no pending tasks
- [ ] Email processing cron (process-email-queue) is running
- [ ] Emails delivered successfully via Resend

---

## 🚨 Troubleshooting

**Digest not generating:**
- Check cron job is active: `SELECT * FROM cron.job;`
- Check function exists: `SELECT generate_daily_task_digest();`
- Check logs in Supabase → Functions → Logs

**Emails not sending:**
- Verify `process-email-queue` cron is running
- Check email_notifications table: `SELECT * FROM email_notifications WHERE status = 'pending'`
- Verify Resend API key is set in environment

**Wrong timezone:**
- Adjust cron schedule (IST = UTC + 5:30)
- 9:30 AM IST = 4:00 AM UTC
- Use: `0 4 * * *` in cron schedule

---

## 📞 Next Steps

1. ✅ Apply migration
2. ✅ Deploy edge function  
3. ✅ Set up cron job
4. ✅ Test manually
5. ✅ Wait for 9:30 AM tomorrow to verify automatic run
6. ✅ Monitor email delivery

**Feature complete!** 🎉
