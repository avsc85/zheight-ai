-- Create checklist_items table for storing extracted compliance data
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sheet_name TEXT,
  issue_to_check TEXT NOT NULL,
  location TEXT,
  type_of_issue TEXT,
  code_source TEXT,
  code_identifier TEXT,
  short_code_requirement TEXT,
  long_code_requirement TEXT,
  source_link TEXT,
  project_type TEXT,
  city TEXT,
  zip_code TEXT,
  reviewer_name TEXT,
  type_of_correction TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user access
CREATE POLICY "Users can view their own checklist items" 
ON public.checklist_items 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checklist items" 
ON public.checklist_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklist items" 
ON public.checklist_items 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklist items" 
ON public.checklist_items 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_checklist_items_updated_at
BEFORE UPDATE ON public.checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_checklist_items_user_id ON public.checklist_items(user_id);
CREATE INDEX idx_checklist_items_project_type ON public.checklist_items(project_type);
CREATE INDEX idx_checklist_items_city ON public.checklist_items(city);
CREATE INDEX idx_checklist_items_created_at ON public.checklist_items(created_at DESC);