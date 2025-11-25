-- Create feasibility_analyses table
CREATE TABLE public.feasibility_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_address TEXT NOT NULL,
  lot_size TEXT,
  zone TEXT,
  jurisdiction TEXT,
  source_link TEXT,
  city_dept_link TEXT,
  notes TEXT,
  last_updated_by UUID,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jurisdiction_ordinances table
CREATE TABLE public.jurisdiction_ordinances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_1 TEXT,
  tag_2 TEXT,
  jurisdiction TEXT NOT NULL,
  zone TEXT NOT NULL,
  code_reference TEXT,
  definition_lot_coverage TEXT,
  lot_coverage TEXT,
  definition_floor_area TEXT,
  floor_area_ratio TEXT,
  min_setback_front_ft TEXT,
  min_setback_side_ft TEXT,
  min_setback_rear_ft TEXT,
  min_setback_corner_ft TEXT,
  max_height_ft TEXT,
  exemption_max_height TEXT,
  daylight_plan_rear TEXT,
  daylight_plan_side TEXT,
  exemption_substandard_lot TEXT,
  exemption_side_setback_encroachment TEXT,
  exemption_front_setback_encroachment TEXT,
  min_garage_length TEXT,
  min_garage_width TEXT,
  parking TEXT,
  ordinance_source_link TEXT,
  notes TEXT,
  last_updated_by UUID,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.feasibility_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurisdiction_ordinances ENABLE ROW LEVEL SECURITY;

-- RLS policies for feasibility_analyses (users can only access their own records)
CREATE POLICY "Users can view their own feasibility analyses" 
ON public.feasibility_analyses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feasibility analyses" 
ON public.feasibility_analyses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feasibility analyses" 
ON public.feasibility_analyses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feasibility analyses" 
ON public.feasibility_analyses 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for jurisdiction_ordinances (all authenticated users can read and update)
CREATE POLICY "All authenticated users can view jurisdiction ordinances" 
ON public.jurisdiction_ordinances 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can update jurisdiction ordinances" 
ON public.jurisdiction_ordinances 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Admins can insert jurisdiction ordinances" 
ON public.jurisdiction_ordinances 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete jurisdiction ordinances" 
ON public.jurisdiction_ordinances 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_feasibility_analyses_updated_at
BEFORE UPDATE ON public.feasibility_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jurisdiction_ordinances_updated_at
BEFORE UPDATE ON public.jurisdiction_ordinances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_feasibility_analyses_user_id ON public.feasibility_analyses(user_id);
CREATE INDEX idx_jurisdiction_ordinances_jurisdiction_zone ON public.jurisdiction_ordinances(jurisdiction, zone);