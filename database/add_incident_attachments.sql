-- Migration: Add attachments support to Incidents
-- 1. Add attachments column to incidents
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Add attachments column to incident_comments
ALTER TABLE public.incident_comments ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
