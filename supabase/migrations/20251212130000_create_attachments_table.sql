-- File Attachments System
-- Support for project-level and task-level file attachments

-- ============================================
-- STEP 1: Create attachments table
-- ============================================

CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign keys
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.project_tasks(task_id) ON DELETE CASCADE,
  
  -- File info
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase storage path
  file_type TEXT NOT NULL, -- pdf, image, document, etc.
  file_size INTEGER, -- in bytes
  mime_type TEXT, -- application/pdf, image/png, etc.
  
  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT, -- Optional description/notes about the file
  
  -- Ensure either project_id OR task_id is set (not both)
  CONSTRAINT attachment_type_check CHECK (
    (project_id IS NOT NULL AND task_id IS NULL) OR
    (project_id IS NULL AND task_id IS NOT NULL)
  ),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- STEP 2: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_attachments_project_id ON public.attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON public.attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON public.attachments(uploaded_by);

-- ============================================
-- STEP 3: Enable RLS
-- ============================================

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: RLS Policies for attachments
-- ============================================

-- Admin can do everything
CREATE POLICY "Admin full access to attachments"
ON public.attachments
FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- PM can view/upload/delete attachments for their projects
CREATE POLICY "PM can manage attachments for their projects"
ON public.attachments
FOR ALL
TO public
USING (
  has_role(auth.uid(), 'pm'::app_role) AND
  (
    -- Project-level attachment
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = attachments.project_id
      AND (
        p.user_id = auth.uid() OR
        p.project_manager_name IN (
          SELECT name FROM public.profiles WHERE user_id = auth.uid()
        )
      )
    ))
    OR
    -- Task-level attachment
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.project_tasks pt
      JOIN public.projects p ON p.id = pt.project_id
      WHERE pt.task_id = attachments.task_id
      AND (
        p.user_id = auth.uid() OR
        p.project_manager_name IN (
          SELECT name FROM public.profiles WHERE user_id = auth.uid()
        )
      )
    ))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'pm'::app_role) AND
  (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = attachments.project_id
      AND (
        p.user_id = auth.uid() OR
        p.project_manager_name IN (
          SELECT name FROM public.profiles WHERE user_id = auth.uid()
        )
      )
    ))
    OR
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.project_tasks pt
      JOIN public.projects p ON p.id = pt.project_id
      WHERE pt.task_id = attachments.task_id
      AND (
        p.user_id = auth.uid() OR
        p.project_manager_name IN (
          SELECT name FROM public.profiles WHERE user_id = auth.uid()
        )
      )
    ))
  )
);

-- AR users can view and upload attachments for their assigned tasks
CREATE POLICY "AR can manage attachments for assigned tasks"
ON public.attachments
FOR ALL
TO public
USING (
  task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_tasks pt
    WHERE pt.task_id = attachments.task_id
    AND pt.assigned_ar_id = auth.uid()
  )
)
WITH CHECK (
  task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_tasks pt
    WHERE pt.task_id = attachments.task_id
    AND pt.assigned_ar_id = auth.uid()
  )
);

-- AR users can view project-level attachments for projects they work on
CREATE POLICY "AR can view project attachments for their projects"
ON public.attachments
FOR SELECT
TO public
USING (
  project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_tasks pt
    WHERE pt.project_id = attachments.project_id
    AND pt.assigned_ar_id = auth.uid()
  )
);

-- ============================================
-- STEP 5: Create Supabase Storage bucket
-- ============================================

-- Note: This needs to be run in Supabase Dashboard -> Storage
-- Bucket name: 'project-attachments'
-- Public: false (private bucket, access via RLS)
-- File size limit: 50MB
-- Allowed MIME types: 
--   - application/pdf
--   - image/jpeg, image/png, image/gif, image/webp
--   - application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
--   - application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

-- ============================================
-- STEP 6: Add updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.update_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_updated_at
  BEFORE UPDATE ON public.attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attachments_updated_at();

-- ============================================
-- NOTES:
-- ============================================
-- 1. Each attachment belongs to either a project OR a task (not both)
-- 2. PM can upload/delete files for their projects
-- 3. AR can upload/delete files for their assigned tasks
-- 4. AR can view project-level files (read-only)
-- 5. Files stored in Supabase Storage bucket 'project-attachments'
-- 6. Max file size: 50MB (configurable in Storage settings)
