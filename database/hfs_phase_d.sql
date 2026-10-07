-- ============================================================================
-- GMAO HFS — Fase D: ámbito por sección en incidencias, secciones comodín,
--                    visibilidad por defecto y blindaje de identidad
-- ============================================================================
-- Modelo de visibilidad de incidencias (4 capas):
--   0. profile.active = false          -> nada
--   1. Admin                           -> ve y gestiona todo
--   2. Comodín (sections.is_wildcard)  -> ve y gestiona todo (NUNCA observadores)
--   3. Capa SECCIÓN  (incidents.section):
--        '' / NULL / 'Global'          -> visible para todos
--        si no                         -> solo usuarios de esa sección
--   4. Capa CATEGORÍA (incident_categories.visible_sections / visible_roles)
--        (Y lógico con la capa 3)
-- ============================================================================

-- 1. Secciones comodín --------------------------------------------------------

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS is_wildcard BOOLEAN NOT NULL DEFAULT false;

-- Marcado idempotente de las secciones comodín conocidas. No falla si no existen.
UPDATE public.sections
SET is_wildcard = true
WHERE name IN ('Mantenimiento', 'Ingeniería');

-- 2. Categoría por defecto ----------------------------------------------------

ALTER TABLE public.incident_categories
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

UPDATE public.incident_categories
SET is_default = (name = 'Avería');

-- Solo una categoría puede ser la por defecto
CREATE UNIQUE INDEX IF NOT EXISTS uq_incident_categories_single_default
  ON public.incident_categories (is_default)
  WHERE is_default;

-- Al marcar una como por defecto, las demás dejan de serlo (atómico, sin carreras)
CREATE OR REPLACE FUNCTION public.ensure_single_default_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default AND (TG_OP = 'INSERT' OR NOT OLD.is_default) THEN
    UPDATE public.incident_categories
    SET is_default = false
    WHERE is_default AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incident_categories_single_default ON public.incident_categories;
CREATE TRIGGER trg_incident_categories_single_default
  BEFORE INSERT OR UPDATE ON public.incident_categories
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_category();

-- 3. Incidencias: created_by por defecto = quien crea (no falsificable) --------

ALTER TABLE public.incidents
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 4. Helpers de identidad y ámbito --------------------------------------------

-- Secciones del usuario actual (nombres)
CREATE OR REPLACE FUNCTION public.my_sections()
RETURNS TEXT[] AS $$
  SELECT coalesce(sections, '{}')
  FROM public.profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ¿Es el usuario actual un observador? (los más limitados: nunca comodín)
CREATE OR REPLACE FUNCTION public.is_observer()
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT role LIKE 'Observador%' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ¿Tiene el usuario actual el perfil desactivado?
CREATE OR REPLACE FUNCTION public.is_profile_inactive()
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT NOT active FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ¿Está el usuario actual en una sección comodín (Mantenimiento/Ingeniería)?
-- Un observador NUNCA es comodín, aunque esté en una sección comodín.
CREATE OR REPLACE FUNCTION public.is_wildcard_staff()
RETURNS boolean AS $$
  SELECT CASE WHEN public.is_observer() THEN false ELSE coalesce(
    (
      SELECT EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.is_wildcard
          AND s.name = ANY(public.my_sections())
      )
    ),
    false
  ) END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Regla de visibilidad de incidencias --------------------------------------

-- Las políticas de la Fase C referencian la firma antigua
-- incident_visible_to_me(uuid). Hay que soltarlas ANTES que la función, si no
-- Postgres rechaza el DROP con 2BP01 (other objects depend on it). Se recrean
-- con la firma nueva en las secciones 6 y 7.
DROP POLICY IF EXISTS "Incidents require login" ON public.incidents;
DROP POLICY IF EXISTS "Read Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Create Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Manage Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Delete Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Acceso total incidencias" ON public.incidents;
DROP POLICY IF EXISTS "Incident Comments require login" ON public.incident_comments;
DROP POLICY IF EXISTS "Read Incident Comments" ON public.incident_comments;
DROP POLICY IF EXISTS "Comment Incidents" ON public.incident_comments;
DROP POLICY IF EXISTS "Acceso total comentarios" ON public.incident_comments;

DROP FUNCTION IF EXISTS public.incident_visible_to_me(UUID);

CREATE OR REPLACE FUNCTION public.incident_visible_to_me(
  p_section TEXT,
  p_category_id UUID
)
RETURNS boolean AS $$
DECLARE
  v_role TEXT;
  v_sections TEXT[];
  v_visible_sections TEXT[];
  v_visible_roles TEXT[];
BEGIN
  -- 0. Perfil desactivado: nada
  IF public.is_profile_inactive() THEN
    RETURN false;
  END IF;

  -- 1. Admin ve todo
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  -- 2. Comodín ve y gestiona todas (los observadores no llegan aquí)
  IF public.is_wildcard_staff() THEN
    RETURN true;
  END IF;

  v_sections := public.my_sections();

  -- 3. Capa sección: vacía / 'Global' = visible para todos
  IF p_section IS NOT NULL AND p_section <> '' AND p_section <> 'Global' THEN
    IF NOT (p_section = ANY(v_sections)) THEN
      RETURN false;
    END IF;
  END IF;

  -- 4. Capa categoría (Y lógico con la sección)
  IF p_category_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT visible_sections, visible_roles
  INTO v_visible_sections, v_visible_roles
  FROM public.incident_categories
  WHERE id = p_category_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF coalesce(array_length(v_visible_sections, 1), 0) = 0
     AND coalesce(array_length(v_visible_roles, 1), 0) = 0 THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_visible_roles IS NOT NULL AND v_role = ANY(v_visible_roles) THEN
    RETURN true;
  END IF;

  IF v_visible_sections IS NOT NULL AND v_sections && v_visible_sections THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ¿Puede el usuario actual gestionar (editar / transicionar) la incidencia?
-- Admin | (Responsable Sección y la ve) | (comodín y la ve)
CREATE OR REPLACE FUNCTION public.can_manage_incident(
  p_section TEXT,
  p_category_id UUID
)
RETURNS boolean AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF public.is_profile_inactive() THEN
    RETURN false;
  END IF;

  IF public.is_admin() OR public.is_wildcard_staff() THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'Responsable Sección'
     AND public.incident_visible_to_me(p_section, p_category_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Versión por id, para que incident_comments herede la visibilidad de la madre
CREATE OR REPLACE FUNCTION public.can_see_incident(p_incident_id UUID)
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT public.incident_visible_to_me(i.section, i.category_id)
     FROM public.incidents i WHERE i.id = p_incident_id),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_manage_incident_by_id(p_incident_id UUID)
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT public.can_manage_incident(i.section, i.category_id)
     FROM public.incidents i WHERE i.id = p_incident_id),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. RLS: incidencias ---------------------------------------------------------

DROP POLICY IF EXISTS "Incidents require login" ON public.incidents;
DROP POLICY IF EXISTS "Read Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Create Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Manage Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Delete Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Acceso total incidencias" ON public.incidents;

CREATE POLICY "Read Incidents" ON public.incidents
  FOR SELECT USING (public.incident_visible_to_me(section, category_id));

CREATE POLICY "Create Incidents" ON public.incidents
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
    AND public.incident_visible_to_me(section, category_id)
  );

CREATE POLICY "Manage Incidents" ON public.incidents
  FOR UPDATE
  USING (public.can_manage_incident(section, category_id))
  WITH CHECK (public.can_manage_incident(section, category_id));

CREATE POLICY "Delete Incidents" ON public.incidents
  FOR DELETE USING (public.is_admin());

-- 7. RLS: comentarios de incidencia (heredan de la madre) ---------------------

DROP POLICY IF EXISTS "Incident Comments require login" ON public.incident_comments;
DROP POLICY IF EXISTS "Read Incident Comments" ON public.incident_comments;
DROP POLICY IF EXISTS "Comment Incidents" ON public.incident_comments;
DROP POLICY IF EXISTS "Acceso total comentarios" ON public.incident_comments;

CREATE POLICY "Read Incident Comments" ON public.incident_comments
  FOR SELECT USING (public.can_see_incident(incident_id));

CREATE POLICY "Comment Incidents" ON public.incident_comments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND public.can_see_incident(incident_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Manage Incident Comments" ON public.incident_comments
  FOR UPDATE
  USING (user_id = auth.uid() OR public.can_manage_incident_by_id(incident_id))
  WITH CHECK (user_id = auth.uid() OR public.can_manage_incident_by_id(incident_id));

CREATE POLICY "Delete Incident Comments" ON public.incident_comments
  FOR DELETE USING (public.is_admin());

-- 8. Realtime: replica identity ya estaba en la Fase C -------------------------
