-- Add new data fields to checklist_items table
ALTER TABLE public.checklist_items 
ADD COLUMN zone_primary text,
ADD COLUMN occupancy_group text,
ADD COLUMN natural_hazard_zone text;