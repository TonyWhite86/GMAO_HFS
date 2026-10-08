-- ============================================================================
-- GMAO HFS — Permisos de paradas programadas
-- ============================================================================
-- Reglas (decididas):
--
--   VER el calendario            -> permiso 'paradas' >= 'consulta' (default)
--   CREAR desde el calendario    -> sólo Admin
--   CREAR vía incidencia         -> cualquiera que cree incidencias
--                                   (create_incident_with_stoppage es SECURITY
--                                   DEFINER, no pasa por RLS)
--
--   GESTIONAR (editar · transicionar)
--     · Admin                    -> sí, siempre
--     · Creador de la parada     -> sí, pero sólo si está ABIERTA
--     · Resto                    -> no
--
--   ELIMINAR
--     · Si viene de una incidencia -> NADIE (sólo se puede cerrar)
--     · Si ya está cerrada         -> sólo Admin
--     · Si está abierta y sin inc. -> Admin o creador
--
--   'paradas' = 'total' ya NO otorga gestión: el módulo sólo controla si ves
--   o no el calendario.
-- ============================================================================

-- 1. Funciones de gestión por parada -------------------------------------------

-- ¿Puede el usuario actual editar / transicionar ESTA parada?
CREATE OR REPLACE FUNCTION public.can_manage_stoppage(p_id UUID)
RETURNS boolean AS $$
DECLARE
  v RECORD;
BEGIN
  IF NOT public.can_read_ops_data() THEN
    RETURN false;
  END IF;
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT created_by, status INTO v FROM public.equipment_stoppages WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- El creador gestiona la suya, pero sólo mientras siga abierta.
  RETURN v.created_by = auth.uid()
     AND v.status NOT IN ('Completada', 'Cancelada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ¿Puede el usuario actual ELIMINAR esta parada?
CREATE OR REPLACE FUNCTION public.can_delete_stoppage(p_id UUID)
RETURNS boolean AS $$
DECLARE
  v RECORD;
BEGIN
  IF NOT public.can_read_ops_data() THEN
    RETURN false;
  END IF;

  SELECT created_by, status, incident_id INTO v FROM public.equipment_stoppages WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Una parada nacida de una incidencia NUNCA se borra: al cerrarla queda el
  -- registro del tiempo de parada del equipo.
  IF v.incident_id IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Lo cerrado sólo lo borra el Admin (para no alterar el histórico).
  IF v.status IN ('Completada', 'Cancelada') THEN
    RETURN public.is_admin();
  END IF;

  RETURN public.is_admin() OR v.created_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Políticas de equipment_stoppages ------------------------------------------

DROP POLICY IF EXISTS "Read Stoppages" ON public.equipment_stoppages;
DROP POLICY IF EXISTS "Create Stoppages" ON public.equipment_stoppages;
DROP POLICY IF EXISTS "Manage Stoppages" ON public.equipment_stoppages;
DROP POLICY IF EXISTS "Delete Stoppages" ON public.equipment_stoppages;

-- Ver: cualquier usuario no-observador (el módulo 'paradas' lo filtra en el UI)
CREATE POLICY "Read Stoppages" ON public.equipment_stoppages
  FOR SELECT USING (public.can_read_ops_data());

-- Crear desde el calendario: sólo Admin. Las paradas que nacen de una
-- incidencia las inserta create_incident_with_stoppage (SECURITY DEFINER).
CREATE POLICY "Create Stoppages" ON public.equipment_stoppages
  FOR INSERT WITH CHECK (
    public.can_read_ops_data()
    AND public.is_admin()
    AND (created_by IS NULL OR created_by = auth.uid())
    AND (requested_by IS NULL OR requested_by = auth.uid())
  );

-- Editar / transicionar: Admin o creador (sólo si está abierta)
CREATE POLICY "Manage Stoppages" ON public.equipment_stoppages
  FOR UPDATE
  USING (public.can_manage_stoppage(id))
  WITH CHECK (public.can_manage_stoppage(id));

-- Eliminar: ver can_delete_stoppage
CREATE POLICY "Delete Stoppages" ON public.equipment_stoppages
  FOR DELETE USING (public.can_delete_stoppage(id));

-- 3. complete_stoppage: Admin o creador ---------------------------------------
-- (antes exigía 'paradas' = 'total', que ya no otorga gestión)

CREATE OR REPLACE FUNCTION public.complete_stoppage(
  p_id UUID,
  p_end_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_status TEXT DEFAULT 'Completada'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stop RECORD;
  v_end TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT * INTO v_stop FROM public.equipment_stoppages WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parada no encontrada';
  END IF;
  -- Idempotente: cerrar algo ya cerrado no hace nada
  IF v_stop.status IN ('Completada', 'Cancelada') THEN
    RETURN p_id;
  END IF;

  IF NOT (public.is_admin() OR v_stop.created_by = auth.uid()) THEN
    RAISE EXCEPTION 'No puedes gestionar esta parada';
  END IF;

  v_end := coalesce(p_end_at, now());
  IF v_end <= v_stop.start_at THEN
    RAISE EXCEPTION 'El fin debe ser posterior al inicio de la parada';
  END IF;

  UPDATE public.equipment_stoppages
  SET end_at = v_end,
      status = coalesce(nullif(p_status, ''), 'Completada')
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

-- 4. create_incident_with_stoppage: sin cambios de permisos --------------------
-- Ya es SECURITY DEFINER, así que quien reporta una incidencia puede registrar
-- su parada aunque no sea Admin. No se toca.
