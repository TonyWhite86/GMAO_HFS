-- Migration: Add section column to preventive_plans
ALTER TABLE public.preventive_plans ADD COLUMN section TEXT;
