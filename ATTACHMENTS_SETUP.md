# File Attachments Setup Instructions

## Step 1: Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Run the migration file: `supabase/migrations/20251212130000_create_attachments_table.sql`
3. Verify the `attachments` table was created successfully

## Step 2: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create a new bucket"
3. Configure the bucket:
   - **Bucket name**: `project-attachments`
   - **Public bucket**: ❌ No (keep it private)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: 
     - `application/pdf`
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `image/webp`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
     - `application/vnd.ms-excel`
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

4. Click "Create bucket"

## Step 3: Set Storage Policies (Optional - RLS handles access)

The RLS policies on the `attachments` table already control who can upload/download files.
Storage bucket policies can be set to public SELECT for authenticated users:

```sql
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-attachments');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-attachments');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-attachments' AND auth.uid() = owner);
```

## Features Implemented

### Project-Level Attachments
- ✅ Visible to all users who can view the project
- ✅ Editable only by PM/Admin with project permissions
- ✅ Located in ProjectSetup page, next to Project Notes
- ✅ Supports PDF, images, Office documents (max 50MB)

### Task-Level Attachments
- ✅ Small paperclip icon in task tables (ProjectSetup & ProjectTracking)
- ✅ Shows attachment count badge when files exist
- ✅ Dialog opens to view/upload/download files
- ✅ AR users can upload to their assigned tasks
- ✅ PM/Admin can upload to all tasks in their projects

### Permissions
- **Admin**: Full access to all attachments
- **PM**: Can manage attachments for their projects (project-level & task-level)
- **AR1/AR2**: 
  - Can upload/delete attachments on assigned tasks
  - Can view (read-only) project-level attachments
- **User**: Read-only access based on project visibility

## Testing Checklist

- [ ] Create storage bucket `project-attachments`
- [ ] Run database migration
- [ ] Test uploading file to project (as PM)
- [ ] Test uploading file to task (as AR)
- [ ] Verify file download works
- [ ] Verify file deletion works
- [ ] Test permissions (AR can't edit project attachments)
- [ ] Verify attachment count badge shows on tasks
- [ ] Test with large file (near 50MB limit)
- [ ] Test with unsupported file type (should reject)
