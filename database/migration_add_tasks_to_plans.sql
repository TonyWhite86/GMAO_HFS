-- Add tasks column to preventive_plans to store template subtasks
ALTER TABLE public.preventive_plans 
ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT '[]'::jsonb;
