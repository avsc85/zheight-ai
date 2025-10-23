-- Create storage bucket for temporary page images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plan-page-images',
  'plan-page-images',
  false,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg']
);

-- RLS policies for plan-page-images bucket
CREATE POLICY "Authenticated users can upload page images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plan-page-images');

CREATE POLICY "Authenticated users can read their page images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'plan-page-images');

CREATE POLICY "Service role can delete page images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'plan-page-images');

CREATE POLICY "Users can delete their own page images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'plan-page-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);