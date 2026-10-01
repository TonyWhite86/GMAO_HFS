-- 1. Crear tabla de permisos por usuario y módulo
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'sin_acceso' CHECK (level IN ('sin_acceso', 'consulta', 'parcial', 'total')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, module)
);

-- 2. RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read Permissions" ON public.user_permissions FOR SELECT USING (true);
CREATE POLICY "Manage Permissions" ON public.user_permissions FOR ALL USING (public.is_admin());

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_permissions;

ALTER TABLE public.user_permissions REPLICA IDENTITY FULL;
