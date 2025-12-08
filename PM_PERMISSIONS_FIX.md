# Project Manager Permissions & Email Links Fix

## Issues Fixed

### 1. ✅ Project Manager Permissions Issue
**Problem**: Project Managers assigned to projects couldn't see or edit those projects in Project Setup AND Project Tracking pages, and couldn't assign AR users.

**Solution**: 
- Added comprehensive RLS (Row Level Security) policies for database-level access
- Updated Project Tracking page to check both `user_id` AND `project_manager_name`
- Added helper function `is_project_manager()` for easy PM verification

**What PMs Can Now Do:**
- ✅ **View** projects they're assigned to (via `project_manager_name`)
- ✅ **Edit** their assigned projects in Project Setup
- ✅ **View** their assigned projects in Project Tracking
- ✅ **View** all tasks for their projects
- ✅ **Update** tasks (including assigning ARs)
- ✅ **Insert** new tasks for their projects

**Files Modified**:
- `supabase/migrations/20251208000000_fix_pm_permissions_and_email_links.sql` - RLS policies
- `src/pages/ProjectTracking.tsx` - Frontend filtering logic

---

### 2. ✅ Email Links Issue
**Problem**: Email links were using `app.zheight.tech` instead of `zheight.tech`

**Solution**: Updated all email-related links to use correct domain `zheight.tech`:
- ✅ Project Manager assignment emails
- ✅ User invitation emails  
- ✅ Password reset emails

**Link Format**:
```
❌ Before: https://app.zheight.tech/project-mgmt/setup/{id}
✅ After:  https://zheight.tech/project-mgmt/setup/{id}
```

**Files Updated**:
- `supabase/migrations/20251208000000_fix_pm_permissions_and_email_links.sql` - PM email links
- `supabase/functions/invite-user/index.ts` - Invitation links
- `src/pages/ForgotPassword.tsx` - Password reset links

---

## Database Changes

### New RLS Policies Created:

#### Projects Table:
1. **"Project managers can view their assigned projects"**
   ```sql
   -- PM can see if their name matches project_manager_name OR they own it
   project_manager_name IN (SELECT name FROM profiles WHERE user_id = auth.uid())
   OR auth.uid() = user_id
   ```
   
2. **"Project managers can update their assigned projects"**
   ```sql
   -- PM can edit if their name matches OR they own it
   project_manager_name IN (SELECT name FROM profiles WHERE user_id = auth.uid())
   OR auth.uid() = user_id
   ```

#### Project Tasks Table:
1. **"Project managers can view tasks for their projects"**
2. **"Project managers can update tasks for their projects"**  
3. **"Project managers can insert tasks for their projects"**

### New Helper Function:
```sql
is_project_manager(project_id UUID) RETURNS BOOLEAN
-- Checks if current user is PM for given project
```

---

## Frontend Changes

### Project Tracking Page Updates:

**Before:**
```typescript
// Only checked user_id (project owner)
if (isPM && !isAdmin) {
  projectsQuery = projectsQuery.eq('user_id', user?.id);
}
```

**After:**
```typescript
// Now checks BOTH user_id AND project_manager_name
if (isPM && !isAdmin && currentUserName) {
  projectsQuery = projectsQuery.or(
    `user_id.eq.${user?.id},project_manager_name.eq.${currentUserName}`
  );
}
```

This allows PMs to see:
- ✅ Projects they created (user_id match)
- ✅ Projects they're assigned to as PM (project_manager_name match)

---

## To Apply the Fix

1. **Run the migration** in Supabase SQL Editor:
   ```bash
   Run: supabase/migrations/20251208000000_fix_pm_permissions_and_email_links.sql
   ```

2. **Deploy updated Edge Function**:
   ```bash
   supabase functions deploy invite-user
   ```

3. **Deploy updated frontend** (for password reset):
   ```bash
   npm run build
   # Deploy to production
   ```

---

## Testing Steps

### Test PM Permissions:
1. Assign a PM to a project
2. Login as that PM user
3. Verify PM can:
   - See the project in their project list
   - Click "Edit" on the project
   - Assign AR users to tasks
   - Update task details

### Test Email Links:
1. Assign a PM to a new project
2. Check PM email - verify link uses `zheight.com`
3. Invite a new user - verify invitation link uses `zheight.com`  
4. Request password reset - verify reset link uses `zheight.com`

---

## Impact

### Who Benefits:
- ✅ **Project Managers**: Can now fully manage their assigned projects
- ✅ **Admins**: Can delegate project management to PMs
- ✅ **AR Users**: PMs can assign them to tasks
- ✅ **All Users**: Email links work correctly with zheight.com

### No Breaking Changes:
- ✅ Original owner access preserved
- ✅ Admin access unchanged
- ✅ All existing policies maintained
- ✅ Only additive changes (new policies)

---

*Generated: December 8, 2025*  
*Migration: 20251208000000_fix_pm_permissions_and_email_links.sql*