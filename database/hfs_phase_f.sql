-- ============================================================================
-- GMAO HFS — Fase F: RPCs atómicas y máquinas de estados
-- ============================================================================
-- Todo lo que antes era un read-modify-write en el cliente pasa a una única
-- operación transaccional en Postgres. Además, triggers de blindaje impiden
-- saltarse las reglas pegando contra PostgREST directamente.
--
-- Reglas por entidad (espejo de la UI):
--   Incidencia : Abierta -> En Revisión -> Resuelta | Cancelada | Convertida a OT
--                Resuelta / Cancelada = terminales
--                En Revisión exige motivo; Resuelta exige motivo Y solución
--   OT         : Pendiente | Programada -> En Progreso -> Completada
--                Pausar = cierra la sesión pero el status sigue 'En Progreso'
--                Completada = terminal
--   Parada     : Programada -> En curso -> Completada | Cancelada
--   Pedido     : Solicitado | Borrador -> Pedido -> Recibido Parcial -> Recibido
--                -> Pedido exige proveedor
-- ============================================================================

-- 0. Secuencia para el número de pedido ----------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.purchase_order_number_seq;

-- 1. Máquina de estados de INCIDENCIAS (trigger de blindaje) -------------------

CREATE OR REPLACE FUNCTION public.enforce_incident_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_new_reason TEXT;
  v_new_solution TEXT;
  v_sealing BOOLEAN := false;  -- esta UPDATE es la que resuelve/cancela
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Terminales
    IF OLD.status IN ('Resuelta', 'Cancelada') THEN
      RAISE EXCEPTION 'Una incidencia % no puede cambiar de estado', OLD.status;
    END IF;

    -- Transiciones legales
    IF OLD.status = 'Abierta' AND NEW.status NOT IN
       ('En Revisión', 'Resuelta', 'Cancelada', 'Convertida a OT') THEN
      RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.status, NEW.status;
    END IF;
    IF OLD.status = 'En Revisión' AND NEW.status NOT IN
       ('Resuelta', 'Cancelada', 'Convertida a OT') THEN
      RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.status, NEW.status;
    END IF;
    IF OLD.status = 'Convertida a OT' AND NEW.status NOT IN ('Resuelta', 'Cancelada') THEN
      RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.status, NEW.status;
    END IF;

    v_new_reason   := coalesce(nullif(trim(NEW.reason), ''), nullif(trim(OLD.reason), ''));
    v_new_solution := coalesce(nullif(trim(NEW.solution), ''), nullif(trim(OLD.solution), ''));

    IF NEW.status = 'En Revisión' AND v_new_reason IS NULL THEN
      RAISE EXCEPTION 'Indica el motivo para pasar a En Revisión';
    END IF;
    IF NEW.status = 'Resuelta' THEN
      IF v_new_reason IS NULL THEN
        RAISE EXCEPTION 'Indica el motivo antes de resolver la incidencia';
      END IF;
      IF v_new_solution IS NULL THEN
        RAISE EXCEPTION 'Indica la solución para resolver la incidencia';
      END IF;
      NEW.resolved_at := coalesce(NEW.resolved_at, now());
      NEW.resolved_by := coalesce(NEW.resolved_by, auth.uid());
      v_sealing := true;
    END IF;
    IF NEW.status = 'Cancelada' THEN
      NEW.resolved_at := NULL;
      NEW.resolved_by := NULL;
      v_sealing := true;
    END IF;
    IF NEW.status = 'Convertida a OT' AND NEW.work_order_id IS NULL THEN
      RAISE EXCEPTION 'La conversión a OT debe indicar work_order_id';
    END IF;
  END IF;

  -- Fuera de la transición que resuelve/cancela, resolved_at/resolved_by no se
  -- tocan (salvo Admin).
  IF TG_OP = 'UPDATE' AND NOT v_sealing THEN
    IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
       OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by THEN
      SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
      IF v_role IS DISTINCT FROM 'Admin' THEN
        RAISE EXCEPTION 'Solo un Admin puede editar la resolución de una incidencia';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_incidents_transition ON public.incidents;
CREATE TRIGGER trg_incidents_transition
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_incident_transition();

-- 2. RPC: transición de incidencia (actualiza + comentario de sistema) ---------

CREATE OR REPLACE FUNCTION public.transition_incident(
  p_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_solution TEXT DEFAULT NULL,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inc RECORD;
  v_final_reason TEXT;
  v_final_solution TEXT;
BEGIN
  SELECT * INTO v_inc FROM public.incidents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incidencia no encontrada';
  END IF;
  IF NOT public.can_manage_incident(v_inc.section, v_inc.category_id) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar esta incidencia';
  END IF;

  v_final_reason   := coalesce(nullif(trim(coalesce(p_reason, '')), ''), v_inc.reason);
  v_final_solution := coalesce(nullif(trim(coalesce(p_solution, '')), ''), v_inc.solution);

  UPDATE public.incidents
  SET status   = p_status,
      reason   = v_final_reason,
      solution = v_final_solution
  WHERE id = p_id;

  INSERT INTO public.incident_comments (incident_id, user_id, user_name, text, is_system)
  VALUES (
    p_id, auth.uid(), 'Sistema',
    coalesce(p_comment, 'Incidencia marcada como ' || lower(p_status)),
    true
  );

  RETURN p_id;
END;
$$;

-- 3. RPC: conversión de incidencia a OT (atómica e idempotente) ---------------

CREATE OR REPLACE FUNCTION public.convert_incident_to_wo(
  p_incident_id UUID,
  p_title TEXT,
  p_section TEXT,
  p_description TEXT DEFAULT NULL,
  p_wo_type TEXT DEFAULT 'Correctivo',
  p_priority TEXT DEFAULT 'Media',
  p_equipment_id UUID DEFAULT NULL,
  p_assigned_user_id UUID DEFAULT NULL,
  p_scheduled_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_subtasks JSONB DEFAULT '[]'::jsonb,
  p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inc RECORD;
  v_wo_id TEXT;
  v_existing TEXT;
  v_hist JSONB;
  v_elem JSONB;
  v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
  -- Idempotente: si ya existe una OT para esta incidencia, la devolvemos
  SELECT id INTO v_existing FROM public.work_orders WHERE related_incident_id = p_incident_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_inc FROM public.incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incidencia no encontrada';
  END IF;
  IF NOT public.can_manage_incident(v_inc.section, v_inc.category_id) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar esta incidencia';
  END IF;
  IF v_inc.status IN ('Resuelta', 'Cancelada', 'Convertida a OT') THEN
    RAISE EXCEPTION 'La incidencia está en estado % y no se puede convertir', v_inc.status;
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' OR p_section IS NULL OR trim(p_section) = '' THEN
    RAISE EXCEPTION 'La OT necesita título y sección';
  END IF;

  v_hist := jsonb_build_array(jsonb_build_object(
    'status', coalesce(nullif(p_wo_type, 'Correctivo'), 'Pendiente')::text,
    'timestamp', v_now
  ));
  -- Estado inicial coherente con la asignación
  IF p_assigned_user_id IS NOT NULL THEN
    v_hist := jsonb_build_array(jsonb_build_object('status', 'Programada', 'timestamp', v_now));
  END IF;

  INSERT INTO public.work_orders (
    title, description, type, status, priority, equipment_id, assigned_user_id,
    collaborators, section, created_by, created_at, scheduled_date,
    status_history, collaborating_sections, used_parts, related_incident_id
  ) VALUES (
    p_title,
    p_description,
    coalesce(nullif(p_wo_type, ''), 'Correctivo'),
    CASE WHEN p_assigned_user_id IS NOT NULL THEN 'Programada' ELSE 'Pendiente' END,
    coalesce(nullif(p_priority, ''), 'Media'),
    p_equipment_id,
    p_assigned_user_id,
    '{}'::uuid[],
    p_section,
    auth.uid(),
    v_now,
    p_scheduled_date,
    v_hist,
    '{}'::text[],
    '[]'::jsonb,
    p_incident_id
  )
  RETURNING id INTO v_wo_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(coalesce(p_subtasks, '[]'::jsonb))
  LOOP
    INSERT INTO public.subtasks (work_order_id, description, completed, assigned_user_ids)
    VALUES (
      v_wo_id,
      coalesce(v_elem->>'description', ''),
      coalesce((v_elem->>'completed')::boolean, false),
      coalesce(
        (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(v_elem->'assignedUserIds', '[]'::jsonb)) AS x),
        '{}'
      )
    );
  END LOOP;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb))
  LOOP
    INSERT INTO public.attachments (parent_id, parent_type, name, url, type)
    VALUES (v_wo_id, 'work_order', coalesce(v_elem->>'name', ''), coalesce(v_elem->>'url', ''), coalesce(v_elem->>'type', 'file'));
  END LOOP;

  UPDATE public.incidents
  SET status = 'Convertida a OT',
      work_order_id = v_wo_id,
      section = p_section
  WHERE id = p_incident_id;

  INSERT INTO public.incident_comments (incident_id, user_id, user_name, text, is_system)
  VALUES (p_incident_id, auth.uid(), 'Sistema',
          'Incidencia convertida a Orden de Trabajo: ' || v_wo_id, true);

  RETURN v_wo_id;
END;
$$;

-- 4. Máquina de estados de ÓRDENES DE TRABAJO ---------------------------------
-- Además de validar, sella status_history / time_spent_minutes / closed_at.

CREATE OR REPLACE FUNCTION public.enforce_work_order_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- closed_at solo se fija al completar y no se toca después
    IF NEW.status = 'Completada' AND OLD.status IS DISTINCT FROM 'Completada' THEN
      NEW.closed_at := coalesce(NEW.closed_at, now());
    ELSIF NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
      NEW.closed_at := OLD.closed_at;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'Completada' THEN
        RAISE EXCEPTION 'Una orden completada no puede cambiar de estado';
      END IF;
      IF NEW.status NOT IN ('Pendiente', 'Programada', 'En Progreso', 'Completada') THEN
        RAISE EXCEPTION 'Estado de orden desconocido: %', NEW.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_work_orders_transition ON public.work_orders;
CREATE TRIGGER trg_work_orders_transition
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_work_order_transition();

-- 3. Trazabilidad del origen del tiempo ---------------------------------------
-- 'sesion' = derivado del historial de sesiones   |  'manual' = escrito a mano
-- Se usa para poder detectar a quien SIEMPRE rellena el tiempo a mano.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS time_source TEXT,
  ADD COLUMN IF NOT EXISTS time_recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_recorded_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_time_source_chk;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_time_source_chk
    CHECK (time_source IS NULL OR time_source IN ('sesion', 'manual'));

-- 5. RPC: transiciones de OT (start / pause / resume / complete) ---------------

CREATE OR REPLACE FUNCTION public.transition_work_order(
  p_id TEXT,
  p_action TEXT,
  p_note TEXT DEFAULT NULL,
  p_manual_minutes INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wo RECORD;
  v_hist JSONB;
  v_last JSONB;
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_has_open BOOLEAN;
  v_seconds BIGINT;
  v_minutes INTEGER;
  v_entry_status TEXT;
  v_msg TEXT;
  v_time_source TEXT := NULL;
BEGIN
  SELECT * INTO v_wo FROM public.work_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada';
  END IF;
  IF NOT public.work_order_visible_to_me(v_wo.section, v_wo.collaborating_sections, v_wo.assigned_user_id, v_wo.collaborators) THEN
    RAISE EXCEPTION 'No tienes permiso sobre esta orden de trabajo';
  END IF;

  -- Completar dos veces es un no-op (doble clic), no un error.
  IF p_action = 'complete' AND v_wo.status = 'Completada' THEN
    RETURN p_id;
  END IF;

  v_hist := coalesce(v_wo.status_history, '[]'::jsonb);
  v_last := v_hist -> (jsonb_array_length(v_hist) - 1);
  v_has_open := (v_last IS NOT NULL AND v_last->>'status' = 'En Progreso');

  IF p_action = 'start' THEN
    IF v_wo.status NOT IN ('Pendiente', 'Programada') THEN
      RAISE EXCEPTION 'Solo se puede iniciar una orden Pendiente o Programada';
    END IF;
    -- Descarta un 'En Progreso' huérfano colgando (sesión abandonada)
    IF v_last IS NOT NULL AND v_last->>'status' = 'En Progreso' THEN
      v_hist := v_hist - (jsonb_array_length(v_hist) - 1);
    END IF;
    v_hist := v_hist || jsonb_build_array(jsonb_build_object('status', 'En Progreso', 'timestamp', v_now));
    UPDATE public.work_orders SET status = 'En Progreso', status_history = v_hist WHERE id = p_id;
    v_msg := coalesce(p_note, 'Trabajo iniciado.');
    v_entry_status := 'En Progreso';

  ELSIF p_action = 'pause' THEN
    IF v_wo.status <> 'En Progreso' OR NOT v_has_open THEN
      RAISE EXCEPTION 'Solo se puede pausar una orden En Progreso con sesión abierta';
    END IF;
    -- Pausar = cerrar la sesión (entrada 'Pendiente') pero el status sigue 'En Progreso'
    v_hist := v_hist || jsonb_build_array(jsonb_build_object('status', 'Pendiente', 'timestamp', v_now));
    UPDATE public.work_orders
    SET status = 'En Progreso',
        status_history = v_hist,
        pending_reason = coalesce(nullif(trim(coalesce(p_note, '')), ''), v_wo.pending_reason)
    WHERE id = p_id;
    v_msg := 'Trabajo pausado. Motivo: ' || coalesce(nullif(trim(coalesce(p_note, '')), ''), 'No indicado');
    v_entry_status := 'Pendiente';

  ELSIF p_action = 'resume' THEN
    IF v_wo.status <> 'En Progreso' OR v_has_open THEN
      RAISE EXCEPTION 'Solo se puede reanudar una orden En Progreso pausada';
    END IF;
    v_hist := v_hist || jsonb_build_array(jsonb_build_object('status', 'En Progreso', 'timestamp', v_now));
    UPDATE public.work_orders
    SET status = 'En Progreso', status_history = v_hist, pending_reason = NULL
    WHERE id = p_id;
    v_msg := coalesce(p_note, 'Trabajo reanudado.');
    v_entry_status := 'En Progreso';

  ELSIF p_action = 'complete' THEN
    v_hist := v_hist || jsonb_build_array(jsonb_build_object('status', 'Completada', 'timestamp', v_now));

    IF p_manual_minutes IS NOT NULL THEN
      -- Tiempo indicado a mano: manda lo que diga el usuario.
      v_minutes := greatest(p_manual_minutes, 0);
      v_time_source := 'manual';
    ELSE
      v_seconds := public.wo_active_seconds_from_history(
        v_hist || jsonb_build_array(jsonb_build_object('status', 'Pendiente', 'timestamp', v_now))
      );
      v_minutes := greatest(round(v_seconds / 60.0)::integer, 0);

      -- BLINDAJE: si el cálculo da 0 (OT finalizada sin iniciar, o sin
      -- historial utilizable) pero ya había un tiempo registrado > 0, NO lo
      -- pisamos con 0. Así ninguna ruta puede perder un tiempo ya guardado.
      IF v_minutes = 0 AND coalesce(v_wo.time_spent_minutes, 0) > 0 THEN
        v_minutes := v_wo.time_spent_minutes;
      END IF;
      v_time_source := 'sesion';
    END IF;

    UPDATE public.work_orders
    SET status = 'Completada',
        status_history = v_hist,
        closed_at = v_now,
        time_spent_minutes = v_minutes,
        time_source = v_time_source,
        time_recorded_by = auth.uid(),
        time_recorded_at = v_now
    WHERE id = p_id;
    v_msg := coalesce(p_note, 'Orden completada. Tiempo: ' || (v_minutes / 60) || 'h ' || (v_minutes % 60) || 'm.');
    IF v_time_source = 'manual' THEN
      v_msg := v_msg || ' (tiempo registrado a mano)';
    END IF;
    v_entry_status := 'Completada';

  ELSE
    RAISE EXCEPTION 'Acción desconocida: %', p_action;
  END IF;

  INSERT INTO public.comments (work_order_id, user_id, user_name, text, is_system, status)
  VALUES (p_id, auth.uid(), 'Sistema', v_msg, true, v_entry_status);

  -- Plan preventivo: al completar, relanzar la siguiente OT del plan
  IF p_action = 'complete' AND v_wo.related_plan_id IS NOT NULL THEN
    PERFORM public.launch_plan_next_wo(v_wo.related_plan_id);
  END IF;

  RETURN p_id;
END;
$$;

-- 6. Sesiones de trabajo desde status_history ---------------------------------
-- Fuente única del tiempo: solo status_history (ver AGENTS.md).

CREATE OR REPLACE FUNCTION public.wo_active_seconds_from_history(p_hist JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total BIGINT := 0;
  v_elem JSONB;
  v_open TIMESTAMP WITH TIME ZONE;
  v_ts TIMESTAMP WITH TIME ZONE;
  v_prev_ts TIMESTAMP WITH TIME ZONE;
  v_status TEXT;
  v_was_open BOOLEAN := false;
BEGIN
  FOR v_elem IN SELECT * FROM jsonb_array_elements(coalesce(p_hist, '[]'::jsonb))
  LOOP
    v_status := v_elem->>'status';
    v_ts := (v_elem->>'timestamp')::timestamptz;
    IF v_ts IS NULL THEN CONTINUE; END IF;

    IF v_status = 'En Progreso' THEN
      IF NOT v_was_open THEN
        v_open := v_ts;
        v_was_open := true;
      END IF;
    ELSE
      IF v_was_open AND v_open IS NOT NULL THEN
        v_total := v_total + greatest(extract(epoch FROM (v_ts - v_open)), 0);
        v_was_open := false;
      END IF;
    END IF;
    v_prev_ts := v_ts;
  END LOOP;

  -- Sesión aún abierta: no cuenta (solo las cerradas)
  RETURN v_total;
END;
$$;

-- 7. Lanzamiento del siguiente OT de un plan preventivo ------------------------

CREATE OR REPLACE FUNCTION public.launch_plan_next_wo(p_plan_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan RECORD;
  v_task JSONB;
  v_wo_id TEXT;
  v_hist JSONB;
BEGIN
  SELECT * INTO v_plan FROM public.preventive_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF NOT (public.is_admin() OR public.role_in_profile('Responsable Sección') OR public.is_wildcard_staff()) THEN
    RAISE EXCEPTION 'No puedes lanzar planes preventivos';
  END IF;

  v_hist := jsonb_build_array(jsonb_build_object('status', 'Programada', 'timestamp', now()));

  INSERT INTO public.work_orders (
    title, description, type, status, priority, section, created_by,
    created_at, scheduled_date, status_history, related_plan_id, equipment_id
  ) VALUES (
    v_plan.name,
    coalesce(v_plan.description, ''),
    'Preventivo',
    'Programada',
    'Media',
    coalesce(nullif(v_plan.section, ''), 'Global'),
    auth.uid(),
    now(),
    v_plan.next_run,
    v_hist,
    v_plan.id,
    v_plan.equipment_id
  )
  RETURNING id INTO v_wo_id;

  FOR v_task IN SELECT * FROM jsonb_array_elements(coalesce(v_plan.tasks, '[]'::jsonb))
  LOOP
    INSERT INTO public.subtasks (work_order_id, description, completed, assigned_user_ids)
    VALUES (v_wo_id, coalesce(v_task->>'description', v_task->>'name', ''), false, '{}');
  END LOOP;

  UPDATE public.preventive_plans
  SET last_run = v_plan.next_run,
      next_run = v_plan.next_run + make_interval(days => coalesce(v_plan.frequency_days, 30))
  WHERE id = p_plan_id;

  RETURN v_wo_id;
END;
$$;

-- 8. RPC: asignación / desasignación de OT ------------------------------------

CREATE OR REPLACE FUNCTION public.assign_work_order(
  p_wo_id TEXT,
  p_user_id UUID,
  p_scheduled_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_subtask_ids UUID[] DEFAULT NULL,
  p_assign_main BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wo RECORD;
  v_target RECORD;
  v_allowed TEXT[];
  v_is_target_admin BOOLEAN;
BEGIN
  SELECT * INTO v_wo FROM public.work_orders WHERE id = p_wo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada';
  END IF;
  IF NOT public.work_order_visible_to_me(v_wo.section, v_wo.collaborating_sections, v_wo.assigned_user_id, v_wo.collaborators) THEN
    RAISE EXCEPTION 'No tienes permiso sobre esta orden de trabajo';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario destino no existe o está desactivado';
  END IF;
  IF v_target.role LIKE 'Observador%' THEN
    RAISE EXCEPTION 'Un observador no puede recibir asignaciones';
  END IF;

  v_allowed := array_remove(ARRAY[v_wo.section] || coalesce(v_wo.collaborating_sections, '{}'), 'Global');
  v_is_target_admin := (v_target.role = 'Admin');
  IF NOT v_is_target_admin
     AND NOT (coalesce(v_target.sections, '{}') && array_remove(v_allowed, NULL))
     AND NOT ('Global' = ANY(coalesce(v_wo.collaborating_sections, '{}')) OR v_wo.section = 'Global') THEN
    RAISE EXCEPTION 'El técnico debe pertenecer a la sección ''%'' o a sus secciones colaboradoras', v_wo.section;
  END IF;

  UPDATE public.work_orders
  SET assigned_user_id = CASE WHEN p_assign_main THEN p_user_id ELSE assigned_user_id END,
      status = CASE WHEN status IN ('Pendiente', 'Programada') THEN 'Programada' ELSE status END,
      scheduled_date = coalesce(p_scheduled_date, scheduled_date)
  WHERE id = p_wo_id;

  IF p_subtask_ids IS NOT NULL AND array_length(p_subtask_ids, 1) > 0 THEN
    UPDATE public.subtasks
    SET assigned_user_ids = array_append(
      array_remove(coalesce(assigned_user_ids, '{}'), p_user_id),
      p_user_id
    )
    WHERE work_order_id = p_wo_id AND id = ANY(p_subtask_ids);
  END IF;

  INSERT INTO public.comments (work_order_id, user_id, user_name, text, is_system)
  VALUES (p_wo_id, auth.uid(), 'Sistema',
          'Asignada a ' || v_target.name ||
          CASE WHEN p_scheduled_date IS NOT NULL
               THEN ' para el ' || to_char(p_scheduled_date, 'DD/MM/YYYY') ELSE '' END,
          true);

  RETURN p_wo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unassign_work_order(
  p_wo_id TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wo RECORD;
  v_remain BOOLEAN;
BEGIN
  SELECT * INTO v_wo FROM public.work_orders WHERE id = p_wo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada';
  END IF;
  IF NOT public.work_order_visible_to_me(v_wo.section, v_wo.collaborating_sections, v_wo.assigned_user_id, v_wo.collaborators) THEN
    RAISE EXCEPTION 'No tienes permiso sobre esta orden de trabajo';
  END IF;

  IF p_user_id IS NULL THEN
    UPDATE public.work_orders
    SET assigned_user_id = NULL, status = 'Pendiente', scheduled_date = NULL
    WHERE id = p_wo_id;
    UPDATE public.subtasks SET assigned_user_ids = '{}' WHERE work_order_id = p_wo_id;
    UPDATE public.work_orders SET collaborators = '{}' WHERE id = p_wo_id;
  ELSE
    UPDATE public.work_orders
    SET assigned_user_id = CASE WHEN assigned_user_id = p_user_id THEN NULL ELSE assigned_user_id END,
        collaborators = array_remove(coalesce(collaborators, '{}'), p_user_id)
    WHERE id = p_wo_id;
    UPDATE public.subtasks
    SET assigned_user_ids = array_remove(coalesce(assigned_user_ids, '{}'), p_user_id)
    WHERE work_order_id = p_wo_id;

    SELECT (assigned_user_id IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.subtasks WHERE work_order_id = p_wo_id AND cardinality(coalesce(assigned_user_ids, '{}')) > 0)
        OR cardinality(coalesce(collaborators, '{}')) > 0
    INTO v_remain
    FROM public.work_orders WHERE id = p_wo_id;

    IF NOT v_remain THEN
      UPDATE public.work_orders
      SET status = 'Pendiente', scheduled_date = NULL
      WHERE id = p_wo_id;
    END IF;
  END IF;

  RETURN p_wo_id;
END;
$$;

-- 9. RPC: recepción de material de un pedido (atómica) ------------------------
-- p_items: [{"item_id": "uuid", "quantity": 3}]
-- Acumula received_quantity, decide Recibido Parcial / Recibido, sella
-- received_date y descuenta stock vía register_inventory_movement.

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_order_id UUID,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_elem JSONB;
  v_all_received BOOLEAN := true;
  v_total_pending BIGINT := 0;
  v_item RECORD;
BEGIN
  IF NOT (public.can_read_ops_data() AND public.has_inventory_access('parcial')) THEN
    RAISE EXCEPTION 'No puedes recibir material';
  END IF;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  IF v_order.status NOT IN ('Pedido', 'Recibido Parcial') THEN
    RAISE EXCEPTION 'Solo se puede recibir material de un Pedido o Recibido Parcial (estado actual: %)', v_order.status;
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  LOOP
    IF coalesce((v_elem->>'quantity')::integer, 0) <= 0 THEN
      CONTINUE;
    END IF;
    SELECT * INTO v_item FROM public.purchase_order_items
    WHERE id = (v_elem->>'item_id')::uuid AND order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Línea de pedido no encontrada: %', v_elem->>'item_id';
    END IF;
    IF (v_elem->>'quantity')::integer > (v_item.quantity - coalesce(v_item.received_quantity, 0)) THEN
      RAISE EXCEPTION 'Cantidad recibida mayor que la pendiente para %', v_item.part_id;
    END IF;

    UPDATE public.purchase_order_items
    SET received_quantity = coalesce(received_quantity, 0) + (v_elem->>'quantity')::integer
    WHERE id = v_item.id;

    PERFORM public.register_inventory_movement(
      v_item.part_id, 'IN', (v_elem->>'quantity')::integer,
      'Recepción pedido ' || v_order.number, auth.uid()
    );
  END LOOP;

  FOR v_item IN SELECT * FROM public.purchase_order_items WHERE order_id = p_order_id
  LOOP
    v_total_pending := v_total_pending + (v_item.quantity - coalesce(v_item.received_quantity, 0));
  END LOOP;
  v_all_received := (v_total_pending <= 0);

  UPDATE public.purchase_orders
  SET status = CASE WHEN v_all_received THEN 'Recibido' ELSE 'Recibido Parcial' END,
      received_date = CASE WHEN v_all_received THEN now() ELSE received_date END
  WHERE id = p_order_id;

  RETURN p_order_id;
END;
$$;

-- 10. RPC: creación de pedido con número por secuencia y total calculado ------
-- p_items: [{"part_id":"uuid","quantity":2,"unit_price":1.5,"equipment_id":"uuid"}]

CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'Solicitado',
  p_expected_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_number TEXT;
  v_elem JSONB;
  v_total NUMERIC(12,2) := 0;
BEGIN
  IF NOT (public.can_read_ops_data() AND public.has_inventory_access('parcial')) THEN
    RAISE EXCEPTION 'No puedes crear pedidos';
  END IF;
  IF jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Añade al menos un artículo a la solicitud';
  END IF;

  v_number := 'REQ-' || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.purchase_order_number_seq')::text, 6, '0');

  INSERT INTO public.purchase_orders (number, status, requested_by, requested_date, notes, expected_date, total_amount)
  VALUES (v_number, coalesce(nullif(p_status, ''), 'Solicitado'), auth.uid(), now(), p_notes, p_expected_date, 0)
  RETURNING id INTO v_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF coalesce((v_elem->>'quantity')::integer, 0) <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor que cero';
    END IF;
    INSERT INTO public.purchase_order_items (order_id, part_id, quantity, unit_price, equipment_id)
    VALUES (
      v_id,
      (v_elem->>'part_id')::uuid,
      (v_elem->>'quantity')::integer,
      coalesce((v_elem->>'unit_price')::numeric, 0),
      nullif(v_elem->>'equipment_id', '')::uuid
    );
    v_total := v_total + coalesce((v_elem->>'unit_price')::numeric, 0) * (v_elem->>'quantity')::integer;
  END LOOP;

  UPDATE public.purchase_orders SET total_amount = v_total WHERE id = v_id;
  RETURN v_id;
END;
$$;

-- 11. Máquina de estados de PEDIDOS -------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_purchase_order_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('Recibido', 'Cancelado') THEN
      RAISE EXCEPTION 'Un pedido % no puede cambiar de estado', OLD.status;
    END IF;
    IF NEW.status = 'Pedido' THEN
      IF OLD.status NOT IN ('Solicitado', 'Borrador') THEN
        RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.status, NEW.status;
      END IF;
      IF coalesce(trim(NEW.supplier), '') = '' THEN
        RAISE EXCEPTION 'Indique un proveedor para lanzar el pedido';
      END IF;
      NEW.order_date := coalesce(NEW.order_date, now());
    ELSIF NEW.status = 'Recibido Parcial' THEN
      IF OLD.status <> 'Pedido' THEN
        RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.status, NEW.status;
      END IF;
    ELSIF NEW.status = 'Recibido' THEN
      IF OLD.status NOT IN ('Pedido', 'Recibido Parcial') THEN
        RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.status, NEW.status;
      END IF;
      NEW.received_date := coalesce(NEW.received_date, now());
    ELSIF NEW.status = 'Cancelado' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Estado de pedido desconocido: %', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_purchase_orders_transition ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_transition
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_purchase_order_transition();

-- 12. Máquina de estados de PARADAS --------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_stoppage_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('Completada', 'Cancelada') THEN
      RAISE EXCEPTION 'Una parada % no puede cambiar de estado', OLD.status;
    END IF;
    IF NEW.status = 'Programada' THEN
      RAISE EXCEPTION 'Una parada no vuelve al estado Programada';
    ELSIF NEW.status = 'En curso' THEN
      IF OLD.status <> 'Programada' THEN
        RAISE EXCEPTION 'Solo se puede iniciar una parada Programada (estado actual: %)', OLD.status;
      END IF;
    ELSIF NEW.status IN ('Completada', 'Cancelada') THEN
      IF OLD.status NOT IN ('Programada', 'En curso') THEN
        RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.status, NEW.status;
      END IF;
    ELSE
      RAISE EXCEPTION 'Estado de parada desconocido: %', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_equipment_stoppages_transition ON public.equipment_stoppages;
CREATE TRIGGER trg_equipment_stoppages_transition
  BEFORE UPDATE ON public.equipment_stoppages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stoppage_transition();

-- 13. Guard: el stock solo se mueve por register_inventory_movement -----------
-- El flag de sesión lo levanta el RPC (y merge_inventory_items) para poder
-- ajustar quantity; cualquier UPDATE directo queda bloqueado.

CREATE OR REPLACE FUNCTION public.protect_inventory_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    IF coalesce(current_setting('gmao.allow_qty', true), '0') <> '1' THEN
      RAISE EXCEPTION 'El stock solo se modifica mediante register_inventory_movement';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_inventory_protect_quantity ON public.inventory;
CREATE TRIGGER trg_inventory_protect_quantity
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.protect_inventory_quantity();

-- Los dos RPCs que legítimamente tocan quantity levantan el flag
CREATE OR REPLACE FUNCTION public.register_inventory_movement(
    p_item_id UUID,
    p_type TEXT,
    p_quantity INTEGER,
    p_reason TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT (public.can_read_ops_data() AND public.has_inventory_access('parcial')) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_type NOT IN ('IN', 'OUT') THEN
        RAISE EXCEPTION 'Invalid movement type: %. Must be IN or OUT.', p_type;
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive, got %.', p_quantity;
    END IF;

    INSERT INTO public.inventory_movements (item_id, type, quantity, reason, user_id)
    VALUES (p_item_id, p_type, p_quantity, p_reason, coalesce(p_user_id, auth.uid()));

    PERFORM set_config('gmao.allow_qty', '1', true);
    UPDATE public.inventory
    SET quantity = quantity + CASE WHEN p_type = 'IN' THEN p_quantity ELSE -p_quantity END
    WHERE id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_inventory_items(keep_id UUID, delete_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    keep_record RECORD;
    delete_record RECORD;
    combined_equipment_ids UUID[];
    wo_record RECORD;
    updated_parts JSONB;
BEGIN
    IF NOT (public.can_read_ops_data() AND public.has_inventory_access('total')) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    SELECT * INTO keep_record FROM public.inventory WHERE id = keep_id;
    SELECT * INTO delete_record FROM public.inventory WHERE id = delete_id;
    IF NOT FOUND OR keep_record.id IS NULL THEN
        RAISE EXCEPTION 'Item to keep not found: %', keep_id;
    END IF;
    IF delete_record.id IS NULL THEN
        RAISE EXCEPTION 'Item to delete not found: %', delete_id;
    END IF;
    UPDATE public.inventory_movements SET item_id = keep_id WHERE item_id = delete_id;
    UPDATE public.purchase_order_items SET part_id = keep_id WHERE part_id = delete_id;
    FOR wo_record IN
        SELECT id, used_parts FROM public.work_orders
        WHERE used_parts @> jsonb_build_array(jsonb_build_object('partId', delete_id))
    LOOP
        updated_parts := (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'partId' = delete_id::text
                    THEN jsonb_set(item, '{partId}', to_jsonb(keep_id::text))
                    ELSE item
                END
            )
            FROM jsonb_array_elements(wo_record.used_parts) AS item
        );
        UPDATE public.work_orders SET used_parts = updated_parts WHERE id = wo_record.id;
    END LOOP;
    combined_equipment_ids := ARRAY(
        SELECT DISTINCT unnest(
            COALESCE(keep_record.linked_equipment_ids, '{}') ||
            COALESCE(delete_record.linked_equipment_ids, '{}')
        )
    );
    PERFORM set_config('gmao.allow_qty', '1', true);
    UPDATE public.inventory
    SET
        quantity = COALESCE(keep_record.quantity, 0) + COALESCE(delete_record.quantity, 0),
        linked_equipment_ids = combined_equipment_ids,
        image = COALESCE(keep_record.image, delete_record.image),
        manufacturer = COALESCE(keep_record.manufacturer, delete_record.manufacturer),
        supplier = COALESCE(keep_record.supplier, delete_record.supplier),
        location = COALESCE(keep_record.location, delete_record.location)
    WHERE id = keep_id;
    PERFORM set_config('gmao.allow_qty', '1', true);
    DELETE FROM public.inventory WHERE id = delete_id;
    RETURN keep_id;
END;
$$;
