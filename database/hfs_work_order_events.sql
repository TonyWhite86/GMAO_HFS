-- ============================================================================
-- GMAO HFS — Actividad de la OT: log de eventos como fuente única
-- ============================================================================
-- work_order_events es el registro append-only de TODO lo que le pasa a una OT.
-- status_history deja de escribirse a mano: pasa a ser una PROYECCIÓN derivada
-- mantenida por trigger a partir de los eventos de tipo ciclo de vida. Así no
-- puede haber dos fuentes divergentes para el mismo hecho.
--
-- Tipos de evento:
--   create    · creación de la OT
--   status    · cambio de estado (Pendiente / Programada / En Progreso)
--   pause     · pausa (status = Pendiente en la proyección, el WO sigue En Progreso)
--   resume    · reanudación
--   complete  · finalización
--   assign    · asignación de responsable / subtareas
--   unassign  · desasignación
--   priority  · cambio de prioridad
--   parts     · repuestos usados
--   convert   · creada desde una incidencia
-- ============================================================================

-- 1. Tabla -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.work_order_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id TEXT NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  status        TEXT,
  note          TEXT,
  actor_id      UUID,
  actor_name    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_events_wo_created
  ON public.work_order_events (work_order_id, created_at);

ALTER TABLE public.work_order_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'work_order_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE work_order_events;
  END IF;
END $$;

-- 2. RLS ---------------------------------------------------------------------
-- Sólo lectura para quien pueda ver la OT. Las escrituras las hacen las RPCs
-- (SECURITY DEFINER), así que un cliente no puede inventarse su historial.

DROP POLICY IF EXISTS "Read WO Events" ON public.work_order_events;
DROP POLICY IF EXISTS "Write WO Events" ON public.work_order_events;
CREATE POLICY "Read WO Events" ON public.work_order_events
  FOR SELECT USING (public.work_order_visible_by_id(work_order_id));
CREATE POLICY "Write WO Events" ON public.work_order_events
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Proyección: status_history desde los eventos -----------------------------
-- Este trigger es el ÚNICO que escribe work_orders.status_history. Se ejecuta
-- desde las RPCs (SECURITY DEFINER), que son quienes insertan eventos.

CREATE OR REPLACE FUNCTION public.project_wo_status_history()
RETURNS TRIGGER AS $$
DECLARE
  v_hist JSONB;
  v_proj TEXT;
BEGIN
  IF NEW.kind NOT IN ('create', 'status', 'pause', 'resume', 'complete')
     OR NEW.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- 'pause' cierra la sesión: en la proyección aparece como 'Pendiente'
  v_proj := CASE WHEN NEW.kind = 'pause' THEN 'Pendiente' ELSE NEW.status END;

  SELECT status_history INTO v_hist
  FROM public.work_orders WHERE id = NEW.work_order_id FOR UPDATE;

  UPDATE public.work_orders
  SET status_history = coalesce(v_hist, '[]'::jsonb)
      || jsonb_build_object('status', v_proj, 'timestamp', NEW.created_at)
  WHERE id = NEW.work_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_wo_events_project_history ON public.work_order_events;
CREATE TRIGGER trg_wo_events_project_history
  AFTER INSERT ON public.work_order_events
  FOR EACH ROW EXECUTE FUNCTION public.project_wo_status_history();

-- 4. Eventos automáticos: creación y cambio de prioridad / repuestos ----------

CREATE OR REPLACE FUNCTION public.log_wo_event_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.work_order_events (work_order_id, kind, status, actor_id, actor_name)
  VALUES (
    NEW.id, 'create', NEW.status,
    NEW.created_by,
    coalesce((SELECT name FROM public.profiles WHERE id = NEW.created_by), 'Sistema')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_work_orders_log_create ON public.work_orders;
CREATE TRIGGER trg_work_orders_log_create
  AFTER INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_wo_event_on_insert();

CREATE OR REPLACE FUNCTION public.log_wo_event_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  v_actor_name := coalesce((SELECT name FROM public.profiles WHERE id = auth.uid()), 'Sistema');

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.work_order_events (work_order_id, kind, note, actor_id, actor_name)
    VALUES (NEW.id, 'priority', OLD.priority || ' -> ' || NEW.priority, auth.uid(), v_actor_name);
  END IF;

  IF coalesce(NEW.used_parts, '[]'::jsonb) IS DISTINCT FROM coalesce(OLD.used_parts, '[]'::jsonb) THEN
    INSERT INTO public.work_order_events (work_order_id, kind, note, actor_id, actor_name)
    VALUES (NEW.id, 'parts', 'Repuestos actualizados', auth.uid(), v_actor_name);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_work_orders_log_update ON public.work_orders;
CREATE TRIGGER trg_work_orders_log_update
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_wo_event_on_update();

-- 5. Helper para insertar eventos desde las RPCs ------------------------------

CREATE OR REPLACE FUNCTION public.log_wo_event(
  p_wo_id TEXT,
  p_kind TEXT,
  p_status TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_name TEXT;
BEGIN
  SELECT coalesce(name, 'Sistema') INTO v_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.work_order_events (work_order_id, kind, status, note, actor_id, actor_name)
  VALUES (p_wo_id, p_kind, p_status, p_note, auth.uid(), coalesce(v_name, 'Sistema'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 6. transition_work_order: escribe EVENTOS, no status_history ----------------
-- Misma firma y misma semántica que hfs_phase_f2.sql, pero el historial lo
-- proyecta el trigger. Además registra el origen del tiempo.

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
  v_kind TEXT;
  v_status TEXT;
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
    v_kind := 'status';
    v_status := 'En Progreso';
    v_msg := coalesce(p_note, 'Trabajo iniciado.');

  ELSIF p_action = 'pause' THEN
    IF v_wo.status <> 'En Progreso' OR NOT v_has_open THEN
      RAISE EXCEPTION 'Solo se puede pausar una orden En Progreso con sesión abierta';
    END IF;
    v_kind := 'pause';
    v_status := 'En Progreso';  -- el WO sigue En Progreso; la proyección usa 'Pendiente'
    v_msg := 'Trabajo pausado. Motivo: ' || coalesce(nullif(trim(coalesce(p_note, '')), ''), 'No indicado');

  ELSIF p_action = 'resume' THEN
    IF v_wo.status <> 'En Progreso' OR v_has_open THEN
      RAISE EXCEPTION 'Solo se puede reanudar una orden En Progreso pausada';
    END IF;
    v_kind := 'resume';
    v_status := 'En Progreso';
    v_msg := coalesce(p_note, 'Trabajo reanudado.');

  ELSIF p_action = 'complete' THEN
    v_kind := 'complete';
    v_status := 'Completada';

    IF p_manual_minutes IS NOT NULL THEN
      v_minutes := greatest(p_manual_minutes, 0);
      v_time_source := 'manual';
    ELSE
      v_seconds := public.wo_active_seconds_from_history(
        v_hist || jsonb_build_array(jsonb_build_object('status', 'Completada', 'timestamp', v_now))
      );
      v_minutes := greatest(round(v_seconds / 60.0)::integer, 0);
      IF v_minutes = 0 AND coalesce(v_wo.time_spent_minutes, 0) > 0 THEN
        v_minutes := v_wo.time_spent_minutes;
      END IF;
      v_time_source := 'sesion';
    END IF;

    v_msg := coalesce(p_note, 'Orden completada. Tiempo: ' || (v_minutes / 60) || 'h ' || (v_minutes % 60) || 'm.');
    IF v_time_source = 'manual' THEN
      v_msg := v_msg || ' (tiempo registrado a mano)';
    END IF;

  ELSE
    RAISE EXCEPTION 'Acción desconocida: %', p_action;
  END IF;

  -- 1) El evento. El trigger trg_wo_events_project_history añade la entrada a
  --    work_orders.status_history, que deja de escribirse a mano.
  PERFORM public.log_wo_event(p_id, v_kind, v_status, coalesce(p_note, v_msg));

  -- 2) Estado / tiempo / cierre. NO tocamos status_history.
  IF p_action = 'complete' THEN
    UPDATE public.work_orders
    SET status = 'Completada',
        closed_at = v_now,
        time_spent_minutes = v_minutes,
        time_source = v_time_source,
        time_recorded_by = auth.uid(),
        time_recorded_at = v_now,
        pending_reason = NULL
    WHERE id = p_id;
  ELSIF p_action = 'pause' THEN
    UPDATE public.work_orders
    SET pending_reason = coalesce(nullif(trim(coalesce(p_note, '')), ''), v_wo.pending_reason)
    WHERE id = p_id;
  ELSIF p_action = 'resume' THEN
    UPDATE public.work_orders SET pending_reason = NULL WHERE id = p_id;
  ELSE
    UPDATE public.work_orders SET status = 'En Progreso' WHERE id = p_id;
  END IF;

  -- Plan preventivo: al completar, relanzar la siguiente OT del plan
  IF p_action = 'complete' AND v_wo.related_plan_id IS NOT NULL THEN
    PERFORM public.launch_plan_next_wo(v_wo.related_plan_id);
  END IF;

  RETURN p_id;
END;
$$;

-- 7. assign / unassign: registran el evento -----------------------------------

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
  IF v_target.role <> 'Admin'
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
      array_remove(coalesce(assigned_user_ids, '{}'), p_user_id), p_user_id)
    WHERE work_order_id = p_wo_id AND id = ANY(p_subtask_ids);
  END IF;

  PERFORM public.log_wo_event(
    p_wo_id, 'assign', NULL,
    'Asignada a ' || v_target.name ||
    CASE WHEN p_scheduled_date IS NOT NULL
         THEN ' para el ' || to_char(p_scheduled_date, 'DD/MM/YYYY') ELSE '' END
  );

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
  v_name TEXT;
  v_remain BOOLEAN;
BEGIN
  SELECT * INTO v_wo FROM public.work_orders WHERE id = p_wo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada';
  END IF;
  IF NOT public.work_order_visible_to_me(v_wo.section, v_wo.collaborating_sections, v_wo.assigned_user_id, v_wo.collaborators) THEN
    RAISE EXCEPTION 'No tienes permiso sobre esta orden de trabajo';
  END IF;

  SELECT coalesce(name, '—') INTO v_name FROM public.profiles WHERE id = p_user_id;

  IF p_user_id IS NULL THEN
    UPDATE public.work_orders
    SET assigned_user_id = NULL, status = 'Pendiente', scheduled_date = NULL, collaborators = '{}'
    WHERE id = p_wo_id;
    UPDATE public.subtasks SET assigned_user_ids = '{}' WHERE work_order_id = p_wo_id;
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
      UPDATE public.work_orders SET status = 'Pendiente', scheduled_date = NULL WHERE id = p_wo_id;
    END IF;
  END IF;

  PERFORM public.log_wo_event(
    p_wo_id, 'unassign', NULL,
    'Desasignada' || CASE WHEN v_name IS NOT NULL THEN ' ' || v_name ELSE '' END
  );

  RETURN p_wo_id;
END;
$$;

-- 8. convert_incident_to_wo registra el evento 'convert' ----------------------
-- Se añade al final del flujo existente vía trigger sobre related_incident_id.

CREATE OR REPLACE FUNCTION public.log_wo_event_on_convert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.related_incident_id IS NOT NULL
     AND (OLD IS NULL OR OLD.related_incident_id IS DISTINCT FROM NEW.related_incident_id) THEN
    INSERT INTO public.work_order_events (work_order_id, kind, note, actor_id, actor_name)
    VALUES (
      NEW.id, 'convert',
      'Creada desde la incidencia ' || coalesce(
        (SELECT display_id FROM public.incidents WHERE id = NEW.related_incident_id),
        NEW.related_incident_id::text),
      auth.uid(),
      coalesce((SELECT name FROM public.profiles WHERE id = auth.uid()), 'Sistema')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_work_orders_log_convert ON public.work_orders;
CREATE TRIGGER trg_work_orders_log_convert
  AFTER INSERT OR UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_wo_event_on_convert();
