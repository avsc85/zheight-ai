# 📧 Email Notification System - Complete Overview

This document lists **ALL email triggers** currently configured in the PMS system.

---

## 📋 Email Triggers Summary

| # | Trigger Name | When It Fires | Who Gets Email | Email Type |
|---|-------------|---------------|----------------|------------|
| 1 | **Task Assignment** | AR assigned to new task OR AR changed | Assigned AR | Task assignment details |
| 2 | **Task Status Update** | Task status changes to "completed" OR "pending_approval" | Project Manager | Task completion notification |
| 3 | **PM Assignment** | PM assigned to project OR PM changed | Assigned PM | Project assignment details |
| 4 | **Daily Task Digest (AR)** | Daily at 9:00 AM IST (3:30 AM UTC) | All ARs with pending tasks | List of all pending tasks |
| 5 | **Daily Task Digest (PM)** | Daily at 9:00 AM IST (3:30 AM UTC) | All PMs with active projects | Consolidated project report |

---

## 🔍 Detailed Email Trigger Information

### 1️⃣ Task Assignment Email (AR)

**File:** `20251119220000_task_assignment_email_notifications.sql`

**Trigger Function:** `log_task_assignment_email()`

**Trigger Name:** `trigger_task_assignment_email`

**Fires On:** `project_tasks` table
- **INSERT**: When a new task is created with AR assigned + due date
- **UPDATE**: When AR is changed (old AR ≠ new AR)

**Conditions:**
- AR must be assigned (`assigned_ar_id IS NOT NULL`)
- For INSERT: Due date must be set
- For UPDATE: AR ID must actually change (uses `IS DISTINCT FROM`)

**Email Contents:**
- Task name
- Project name
- Due date (formatted)
- Task description
- Task status
- Link to AR dashboard

**Sent To:** Newly assigned AR email

**Subject:** `New Task Assigned: [Task Name]`

---

### 2️⃣ Task Status Update Email (PM)

**File:** `20251119230000_task_status_email_notifications.sql`

**Trigger Function:** `log_task_status_update_email()`

**Trigger Name:** `trigger_task_status_update_email`

**Fires On:** `project_tasks` table (UPDATE only)

**Conditions:**
- Task status must change
- New status must be either:
  - `completed` - AR finished the task
  - `pending_approval` - AR submitted for PM review

**Email Contents:**
- Task name
- Project name
- Old status → New status
- AR name who completed it
- Completion date
- Link to Team Activity Dashboard (for approval)

**Sent To:** Project Manager email

**Subject:** `Task Status Update: [Task Name]`

---

### 3️⃣ PM Assignment Email

**File:** `20251125120000_project_manager_email_notifications.sql`

**Trigger Function:** `log_pm_assignment_email()`

**Trigger Name:** `trigger_log_pm_assignment_email`

**Fires On:** `projects` table
- **INSERT**: New project with PM assigned
- **UPDATE**: PM name changed

**Conditions:**
- PM name must be set (`project_manager_name IS NOT NULL`)
- For UPDATE: PM name must actually change

**Email Contents:**
- Project name
- Start date
- Expected end date
- Difficulty level
- Project description
- Link to project board

**Sent To:** Assigned PM email (matched by name in profiles table)

**Subject:** `New Project Assignment: [Project Name]`

---

### 4️⃣ Daily Task Digest - AR Version

**File:** `20251127010000_daily_task_digest_email.sql`

**Function:** `generate_daily_task_digest()`

**Triggered By:** Cron job/scheduled function (runs daily at 9:00 AM IST / 3:30 AM UTC)

**Conditions:**
- AR must have role `ar1_planning` OR `ar2_field`
- AR must have pending tasks with status `in_queue` OR `started`
- Tasks must have a due date
- **Excludes** tasks assigned in last 12 hours (to avoid duplicate with assignment email)

**Email Contents:**
- **Summary:** Total tasks count, urgent tasks (due today)
- **Task Table:** Sorted by deadline (earliest first)
  - Task name (RED BOLD if due today ⚠️)
  - Project name
  - Deadline (highlighted if today)
  - Status badge (Started/In Queue)
  - Days remaining
- **Priority Section:** Shows "DUE TODAY" in red for urgent tasks

**Sent To:** Each AR with pending tasks

**Subject:** `📋 Daily Task Digest - [Count] Pending Tasks`

**Special Features:**
- Same-day deadlines highlighted in **RED BOLD**
- Visual urgency indicators (⚠️ emojis)
- Sorted by deadline priority

---

### 5️⃣ Daily Task Digest - PM Version

**File:** `20251127010000_daily_task_digest_email.sql` (same file as AR version)

**Function:** `generate_daily_task_digest()` (same function)

**Triggered By:** Same cron job as AR digest (9:00 AM IST / 3:30 AM UTC)

**Conditions:**
- PM must have role `pm`
- PM must be assigned to active projects
- Projects must have tasks with status `in_queue` OR `started`

**Email Contents:**
- **Summary:** Total projects, total tasks, urgent tasks
- **Project Sections:** One section per project
  - Project name
  - Task count
  - Task table (same format as AR version)
  - AR assignments
  - Deadlines
- **Consolidated View:** All projects in one email

**Sent To:** Each PM with active projects

**Subject:** `📊 Daily PM Report - [Count] Projects with Pending Tasks`

**Special Features:**
- Multi-project consolidated view
- Shows which AR is working on which task
- Same RED BOLD urgency highlighting as AR version

---

## 🗂️ Email Queue System

**Table:** `email_notifications`

**Columns:**
- `id` - UUID
- `recipient_email` - Email address (validated regex)
- `email_type` - Type of email (task_assignment, task_status_update, pm_assignment, daily_digest_ar, daily_digest_pm)
- `subject` - Email subject line
- `body_html` - HTML email body
- `body_text` - Plain text fallback
- `metadata` - JSON data (task details, project info, etc.)
- `status` - pending/sent/failed
- `attempts` - Retry counter
- `error_message` - If failed
- `created_at` - When queued
- `sent_at` - When sent

**Processing:** 
- Emails are queued to this table by triggers
- Processed by `process-email-queue` Edge Function
- Rate limited to 2 emails/second (Resend free tier limit)

---

## ⚙️ Email Processing Function

**File:** `supabase/functions/process-email-queue/index.ts`

**How It Works:**
1. Fetches pending emails from `email_notifications` table
2. Processes in small batches (2 emails at a time)
3. Delays 1 second between emails (rate limiting)
4. Updates status to 'sent' or 'failed'
5. Logs errors for retry

**Rate Limiting:**
- Resend free tier: 2 requests/second max
- Current strategy: 1 email/second (guaranteed safe)
- Delays applied automatically

---

## 📅 Email Schedule

| Time (IST) | Time (UTC) | Email Type | Frequency |
|------------|------------|------------|-----------|
| **Real-time** | **Real-time** | Task Assignment | When AR assigned |
| **Real-time** | **Real-time** | Task Status Update | When task completed |
| **Real-time** | **Real-time** | PM Assignment | When PM assigned |
| **9:00 AM** | **3:30 AM** | AR Daily Digest | Daily |
| **9:00 AM** | **3:30 AM** | PM Daily Digest | Daily |

---

## 🚫 What Does NOT Trigger Emails

- AR viewing tasks
- PM viewing projects
- Task description updates (without status/AR change)
- Project details updates (without PM change)
- Task comments added
- Task priority changes
- Task hours logging
- File attachments
- Notes added to projects/tasks

---

## 🔧 Email Trigger Files Reference

| Migration File | Trigger Created | Table | Event |
|----------------|-----------------|-------|-------|
| `20251119220000_task_assignment_email_notifications.sql` | `trigger_task_assignment_email` | `project_tasks` | INSERT, UPDATE |
| `20251119230000_task_status_email_notifications.sql` | `trigger_task_status_update_email` | `project_tasks` | UPDATE |
| `20251125120000_project_manager_email_notifications.sql` | `trigger_log_pm_assignment_email` | `projects` | INSERT, UPDATE |
| `20251127010000_daily_task_digest_email.sql` | *(cron scheduled)* | N/A | Daily 3:30 AM UTC |

---

## 📊 Email Volume Estimation

**Per Day:**
- Task assignments: ~10-50 (varies by project activity)
- Task status updates: ~10-30 (when ARs complete tasks)
- PM assignments: ~1-5 (new projects or PM changes)
- AR daily digests: 1 per AR (e.g., 10 ARs = 10 emails)
- PM daily digests: 1 per PM (e.g., 5 PMs = 5 emails)

**Total:** ~40-100 emails/day (average workload)

---

## 🛠️ How to Modify Email Triggers

### To Disable a Trigger:
```sql
DROP TRIGGER IF EXISTS trigger_name ON table_name;
```

### To Enable a Disabled Trigger:
```sql
CREATE TRIGGER trigger_name
AFTER INSERT OR UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION function_name();
```

### To Test Email Content:
1. Check `email_notifications` table for queued emails
2. Review `body_html` column for HTML preview
3. Check `metadata` column for data being sent

---

## 📝 Notes

- All emails are HTML formatted with responsive design
- Plain text fallback provided for email clients that don't support HTML
- Email validation regex ensures valid email addresses
- Failed emails are retried automatically
- Email queue prevents duplicate sends
- Rate limiting prevents API quota exhaustion

---

**Last Updated:** January 16, 2026
