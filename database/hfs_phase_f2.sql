-- ============================================================================
-- GMAO HFS — Fase F2: corrección de transition_work_order
-- ============================================================================
-- Sustituye a la versión de hfs_phase_f.sql §5. Es idempotente (CREATE OR
-- REPLACE) y basta con ejecutar este fichero sobre una BD que ya tiene la F.
--
-- Dos arreglos:
--  1. BLINDAJE DE TIEMPO: si no hay sesiones de trabajo en el historial (una OT
--     que se finaliza sin darle a "Iniciar"), el cálculo daba 0 minutos y
--     pisaba el tiempo que el usuario había indicado a mano. Ahora, si el
--     cálculo da 0 y ya había un time_spent_minutes > 0 guardado, se conserva.
--  2. IDEMPOTENCIA de 'complete': dos clics seguidos (o una carrera residual)
--     lanzaban 'La orden ya está completada'. Ahora el segundo llamado devuelve
--     sin tocar nada.
-- ============================================================================

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
