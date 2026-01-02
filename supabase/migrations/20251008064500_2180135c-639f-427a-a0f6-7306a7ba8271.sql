-- Create a private bucket for plan files and policies to allow per-user folder access
-- Bucket: plan-files
INSERT INTO storage.buckets (id, name, public)
VALUES ('plan-files', 'plan-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow users to upload to their own folder: <user_id>/filename
CREATE POLICY "Users can upload their own plan files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'plan-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own plan files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'plan-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own plan files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'plan-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own files (note: signed URLs will bypass RLS for external access)
CREATE POLICY "Users can view their own plan files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'plan-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
