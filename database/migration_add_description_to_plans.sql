-- Add description column to preventive_plans table
ALTER TABLE public.preventive_plans 
ADD COLUMN IF NOT EXISTS description TEXT;
