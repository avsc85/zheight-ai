# Email Notification System

Automated email notification system for task assignments and status updates.

## System Architecture

**Queue-based processing with rate limiting to prevent API throttling.**

```
Task Update → Database Trigger → Email Queue (pending)
                                       ↓
                                  Cron Job (every 2s)
                                       ↓
                              Edge Function (batch processor)
                                       ↓
                            Resend API → Email Sent ✅
```

## Components

### 1. Database Migrations
- `20251119220000_task_assignment_email_notifications.sql` - Core email queue table & RLS
- `20251119230000_task_status_email_notifications.sql` - Trigger for AR assignment & status changes
- `20251121000000_email_rate_limiter.sql` - Rate limiting functions

### 2. Edge Function
- `supabase/functions/process-email-queue/` - Processes pending emails with 1-second delay between sends
- Batch size: 2 emails per run
- Rate: ~1 email/second (safe for Resend free tier: 2 req/sec)

### 3. Cron Job
- Runs every 2 seconds
- Capacity: 60 emails/minute
- Configuration: `AUTO_EMAIL_CRON.sql`

## Email Flow

### Task Assignment
**Trigger:** AR assigned to task with due date
**Recipients:** Assigned AR user only
**Email Type:** `task_assignment`

### Status Change
**Trigger:** Task status → "Started" or "Completed"
**Recipients:** All admin users
**Email Type:** `task_status_change`

## Configuration

### Resend API
**FROM:** `onboarding@resend.dev` (verified sender)
**TO:** Any email address

### Domain Verification (Future)
To send from `@zheight.com`:
1. Go to https://resend.com/domains
2. Add domain `zheight.com`
3. Update DNS records (TXT, DKIM, SPF)
4. Update FROM address in edge function

## Deployment

### First Time Setup
1. Run migrations (auto-applied via Supabase)
2. Deploy edge function:
   ```bash
   supabase functions deploy process-email-queue
   ```
3. Set Resend API key:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxx
   ```
4. Run `AUTO_EMAIL_CRON.sql` in Supabase SQL Editor (one time only)

### Updates
When code changes:
```bash
supabase functions deploy process-email-queue
```

## Monitoring

### Check Email Status
```sql
SELECT recipient_email, status, error_message, created_at, sent_at
FROM email_notifications
ORDER BY created_at DESC
LIMIT 20;
```

### Check Cron Job
```sql
SELECT * FROM cron.job WHERE jobname = 'process-pending-emails';
```

### Check for Auto-Triggers (should be empty)
```sql
SELECT t.tgname
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'email_notifications' AND NOT t.tgisinternal;
```

## Troubleshooting

### Rate Limit Errors (429)
**Cause:** Auto-triggers firing on INSERT causing parallel processing

**Fix:**
```sql
DROP TRIGGER IF EXISTS auto_process_emails_trigger ON email_notifications;
DROP TRIGGER IF EXISTS trigger_send_email_immediately ON email_notifications;
```

### Domain Not Verified (403)
**Expected:** `@zheight.com` emails fail until domain verified
**Workaround:** Using `onboarding@resend.dev` (working for all recipients)

### Emails Not Processing
1. Check cron job: `SELECT * FROM cron.job WHERE jobname = 'process-pending-emails';`
2. Verify edge function deployed: Check Supabase dashboard
3. Check RESEND_API_KEY: `supabase secrets list`

## Testing

1. Update task status to "Started" or "Completed"
2. Wait 5-10 seconds
3. Check email_notifications table:
   ```sql
   SELECT * FROM email_notifications ORDER BY created_at DESC LIMIT 10;
   ```
4. Expected: sourabh.verman23@gmail.com → sent, @zheight.com → failed (403)

## Production Ready ✅

- ✅ Queue-based processing (no parallel calls)
- ✅ Rate limiting (1 email/sec)
- ✅ Scalable (60 emails/min capacity)
- ✅ Error handling & retry logic
- ✅ RLS policies (admin-only access)
- ⚠️ Domain verification pending (using onboarding@resend.dev)
