-- Migration: Create Incidents System

-- 1. Add link to Work Orders
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS related_incident_id UUID;

-- 2. Create Incidents Table
CREATE TABLE public.incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'Media',
  status TEXT NOT NULL DEFAULT 'Abierta',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  section TEXT NOT NULL,
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  work_order_id TEXT REFERENCES public.work_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Incident Comments Table
CREATE TABLE public.incident_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  text TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_comments;

-- 5. Set Replica Identity for Realtime
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.incident_comments REPLICA IDENTITY FULL;

-- 6. Basic RLS (Initial policies)
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Incidencias visibles para interesados" ON public.incidents
  FOR ALL USING (true); -- Simplified for now, will refine based on role

CREATE POLICY "Comentarios visibles para interesados" ON public.incident_comments
  FOR ALL USING (true);
