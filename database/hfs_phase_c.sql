-- ============================================================================
-- GMAO HFS — Fase C: categorías de incidencias, motivos/soluciones,
--                    visibilidad por categoría y paradas programadas
-- ============================================================================

-- 1. Catálogo de categorías de incidencia -------------------------------------

CREATE TABLE IF NOT EXISTS public.incident_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Visibilidad: listas vacías = visible para todos los usuarios.
  -- Con valores: solo lo ven usuarios con alguna de esas secciones o alguno
  -- de esos roles. El Admin siempre ve todo.
  visible_sections TEXT[] NOT NULL DEFAULT '{}',
  visible_roles TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.incident_categories (name, sort_order)
VALUES
  ('Avería', 1), ('Material', 2), ('Calidad', 3),
  ('Personal', 4), ('Mejora', 5), ('Terceros', 6)
ON CONFLICT (name) DO NOTHING;

-- 2. Incidencias: categoría, motivo y solución --------------------------------

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.incident_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS solution TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.incidents
SET category_id = (SELECT id FROM public.incident_categories WHERE name = 'Avería' LIMIT 1)
WHERE category_id IS NULL;

-- 3. Paradas programadas de máquina -------------------------------------------

CREATE TABLE IF NOT EXISTS public.equipment_stoppages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reason_type TEXT NOT NULL DEFAULT 'Mantenimiento',
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Programada',
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  work_order_id TEXT REFERENCES public.work_orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT stoppages_time_range CHECK (end_at > start_at)
);

-- 4. Funciones de apoyo -------------------------------------------------------

-- ¿Puede el usuario actual ver esta categoría de incidencia?
CREATE OR REPLACE FUNCTION public.incident_visible_to_me(p_category_id UUID)
RETURNS boolean AS $$
DECLARE
  v_role TEXT;
  v_sections TEXT[];
  v_visible_sections TEXT[];
  v_visible_roles TEXT[];
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  IF p_category_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT visible_sections, visible_roles
  INTO v_visible_sections, v_visible_roles
  FROM public.incident_categories WHERE id = p_category_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF coalesce(array_length(v_visible_sections, 1), 0) = 0
     AND coalesce(array_length(v_visible_roles, 1), 0) = 0 THEN
    RETURN true;
  END IF;

  SELECT role, sections INTO v_role, v_sections
  FROM public.profiles WHERE id = auth.uid();

  IF v_visible_roles IS NOT NULL AND v_role = ANY(v_visible_roles) THEN
    RETURN true;
  END IF;

  IF v_visible_sections IS NOT NULL AND v_sections && v_visible_sections THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ¿Puede el usuario actual gestionar paradas programadas?
-- (permiso por usuario 'paradas' = 'total', o Admin)
CREATE OR REPLACE FUNCTION public.can_manage_stoppages()
RETURNS boolean AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND module = 'paradas' AND level = 'total'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. RLS ----------------------------------------------------------------------

ALTER TABLE public.incident_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_stoppages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read Categories" ON public.incident_categories;
DROP POLICY IF EXISTS "Manage Categories" ON public.incident_categories;
CREATE POLICY "Read Categories" ON public.incident_categories
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Manage Categories" ON public.incident_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Read Stoppages" ON public.equipment_stoppages;
DROP POLICY IF EXISTS "Manage Stoppages" ON public.equipment_stoppages;
CREATE POLICY "Read Stoppages" ON public.equipment_stoppages
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Manage Stoppages" ON public.equipment_stoppages
  FOR ALL USING (public.can_manage_stoppages()) WITH CHECK (public.can_manage_stoppages());

-- Incidencias: la sectorización por categoría se aplica también en RLS
DROP POLICY IF EXISTS "Incidents require login" ON public.incidents;
DROP POLICY IF EXISTS "Read Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Create Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Manage Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Delete Incidents" ON public.incidents;
CREATE POLICY "Read Incidents" ON public.incidents
  FOR SELECT USING (public.incident_visible_to_me(category_id));
CREATE POLICY "Create Incidents" ON public.incidents
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND public.incident_visible_to_me(category_id)
  );
CREATE POLICY "Manage Incidents" ON public.incidents
  FOR UPDATE
  USING (
    public.incident_visible_to_me(category_id)
    AND (public.is_admin() OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Responsable Sección'
    ))
  )
  WITH CHECK (
    public.incident_visible_to_me(category_id)
    AND (public.is_admin() OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Responsable Sección'
    ))
  );
CREATE POLICY "Delete Incidents" ON public.incidents
  FOR DELETE USING (public.is_admin());

-- Comentarios de incidencia: visibles/editables según la visibilidad de la madre
DROP POLICY IF EXISTS "Incident Comments require login" ON public.incident_comments;
DROP POLICY IF EXISTS "Read Incident Comments" ON public.incident_comments;
DROP POLICY IF EXISTS "Comment Incidents" ON public.incident_comments;
CREATE POLICY "Read Incident Comments" ON public.incident_comments
  FOR SELECT USING (public.incident_visible_to_me(
    (SELECT category_id FROM public.incidents WHERE id = incident_id)
  ));
CREATE POLICY "Comment Incidents" ON public.incident_comments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND public.incident_visible_to_me(
      (SELECT category_id FROM public.incidents WHERE id = incident_id)
    )
  );

-- 6. Réplica y realtime -------------------------------------------------------

ALTER TABLE public.incident_categories REPLICA IDENTITY FULL;
ALTER TABLE public.equipment_stoppages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'incident_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE incident_categories;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'equipment_stoppages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE equipment_stoppages;
  END IF;
END $$;

-- 7. Trigger: al eliminar una categoría, reasignar sus incidencias a "Avería" --

CREATE OR REPLACE FUNCTION public.reassign_incidents_on_category_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fallback_id UUID;
BEGIN
  SELECT id INTO fallback_id
  FROM public.incident_categories
  WHERE name = 'Avería'
  LIMIT 1;

  IF fallback_id IS NOT NULL AND fallback_id <> OLD.id THEN
    UPDATE public.incidents
    SET category_id = fallback_id
    WHERE category_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_categories_reassign ON public.incident_categories;
CREATE TRIGGER trg_incident_categories_reassign
  BEFORE DELETE ON public.incident_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.reassign_incidents_on_category_delete();
