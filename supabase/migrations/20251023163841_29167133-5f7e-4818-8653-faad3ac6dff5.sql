-- Create table to cache analysis results by filename
CREATE TABLE IF NOT EXISTS public.analysis_cache (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename_seed TEXT NOT NULL,
  analysis_session_id TEXT NOT NULL,
  city_detected TEXT,
  checklist_items_analyzed INTEGER,
  issues_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: same file for same user
  UNIQUE(user_id, filename_seed)
);

-- Index for fast lookups
CREATE INDEX idx_analysis_cache_user_filename ON public.analysis_cache(user_id, filename_seed);

-- Enable RLS
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own cached analyses
CREATE POLICY "Users can view own analysis cache"
  ON public.analysis_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis cache"
  ON public.analysis_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);