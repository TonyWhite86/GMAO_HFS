-- ============================================================================
-- GMAO HFS — Incidencia con parada de equipo
-- ============================================================================
-- Una avería suele parar una máquina. Hoy había que crear la incidencia y luego
-- ir al calendario de Paradas a apuntarla, y además no se podía registrar una
-- parada sin saber cuándo termina (end_at era NOT NULL).
--
-- Modelo:
--   · equipment_stoppages.end_at   -> NULL = parada ABIERTA (duración desconocida)
--   · equipment_stoppages.incident_id -> vincula parada <-> incidencia (1:1)
--   · RPC create_incident_with_stoppage(): crea las DOS filas en una transacción
--   · RPC complete_stoppage(id, end_at): fija el fin y cierra
--   · Al resolver/cancelar la incidencia se cierra sola su parada abierta
--   · Al convertir la incidencia a OT, la parada queda vinculada a esa OT
-- ============================================================================

-- 0. Limpieza de sobrecargas ---------------------------------------------------
-- CREATE OR REPLACE sólo sustituye a una función con los MISMOS tipos de
-- argumento. Si una versión anterior tenía otra firma (p.ej. con
-- p_stoppage_reason_type), al re-ejecutar se crea una sobrecarga y PostgREST
-- deja de saber cuál llamar (error PGRST203). Borramos todas antes de crear.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_incident_with_stoppage', 'complete_stoppage')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
    RAISE NOTICE 'Eliminada sobrecarga: %', r.sig;
  END LOOP;
END $$;

-- 1. Esquema ------------------------------------------------------------------

-- El motivo de una parada nacida de una incidencia YA lo dice la categoría de
-- esa incidencia: no se duplica. reason_type queda solo para paradas planificadas.
ALTER TABLE public.equipment_stoppages
  ALTER COLUMN reason_type DROP NOT NULL;

ALTER TABLE public.equipment_stoppages
  ALTER COLUMN end_at DROP NOT NULL;

ALTER TABLE public.equipment_stoppages
  DROP CONSTRAINT IF EXISTS stoppages_time_range;

ALTER TABLE public.equipment_stoppages
  ADD CONSTRAINT stoppages_time_range
    CHECK (end_at IS NULL OR end_at > start_at);

ALTER TABLE public.equipment_stoppages
  ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL;

-- 1 incidencia = 1 parada
CREATE UNIQUE INDEX IF NOT EXISTS uq_stoppages_incident
  ON public.equipment_stoppages (incident_id)
  WHERE incident_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stoppages_incident
  ON public.equipment_stoppages (incident_id)
  WHERE incident_id IS NOT NULL;

-- 2. El equipo es obligatorio en toda incidencia --------------------------------
-- ON DELETE RESTRICT: no se puede borrar un equipo que tenga incidencias.
-- (Antes era SET NULL, incompatible con NOT NULL.)

DO $$
DECLARE
  v_fk TEXT;
BEGIN
  SELECT con.conname INTO v_fk
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
  WHERE con.conrelid = 'public.incidents'::regclass
    AND con.contype = 'f'
    AND att.attname = 'equipment_id';
  IF v_fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.incidents DROP CONSTRAINT %I', v_fk);
  END IF;
END $$;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_equipment_id_fkey
    FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE RESTRICT;

ALTER TABLE public.incidents
  ALTER COLUMN equipment_id SET NOT NULL;

-- 3. RPC: crear incidencia + parada en la misma transacción --------------------
-- Devuelve {"incident_id": "...", "stoppage_id": "..."} (stoppage_id es NULL si
-- no se pidió parada o si la incidencia no tiene equipo).

CREATE OR REPLACE FUNCTION public.create_incident_with_stoppage(
  p_title TEXT,
  p_description TEXT,
  p_priority TEXT,
  p_category_id UUID,
  p_section TEXT DEFAULT NULL,
  -- Obligatorio en la práctica (la función lanza si es NULL); se le pone DEFAULT
  -- sólo para cumplir la regla de Postgres de que, tras un parámetro con default,
  -- todos los siguientes también lo tengan.
  p_equipment_id UUID DEFAULT NULL,
  p_attachments JSONB DEFAULT '[]'::jsonb,
  p_with_stoppage BOOLEAN DEFAULT false,
  p_stoppage_title TEXT DEFAULT NULL,
  p_stoppage_start_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_stoppage_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_incident_id UUID;
  v_stoppage_id UUID;
  v_start TIMESTAMP WITH TIME ZONE;
  v_elem JSONB;
BEGIN
  IF NOT public.can_read_ops_data() THEN
    RAISE EXCEPTION 'No puedes crear incidencias';
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'El título de la incidencia es obligatorio';
  END IF;
  IF p_equipment_id IS NULL THEN
    RAISE EXCEPTION 'Toda incidencia debe estar ligada a un equipo';
  END IF;

  INSERT INTO public.incidents (
    title, description, priority, status, category_id, section,
    equipment_id, created_by, attachments
  ) VALUES (
    trim(p_title),
    p_description,
    coalesce(nullif(p_priority, ''), 'Media'),
    'Abierta',
    p_category_id,
    nullif(trim(coalesce(p_section, '')), ''),
    p_equipment_id,
    auth.uid(),
    coalesce(p_attachments, '[]'::jsonb)
  )
  RETURNING id INTO v_incident_id;

  -- Parada opcional: exige equipo (equipment_stoppages.equipment_id NOT NULL)
  IF p_with_stoppage THEN
    IF EXISTS (SELECT 1 FROM public.equipment_stoppages WHERE incident_id = v_incident_id) THEN
      RAISE EXCEPTION 'Esta incidencia ya tiene una parada registrada';
    END IF;

    v_start := coalesce(p_stoppage_start_at, now());

    INSERT INTO public.equipment_stoppages (
      equipment_id, incident_id, title, description, reason_type,
      start_at, end_at, status, requested_by, created_by
    ) VALUES (
      p_equipment_id,
      v_incident_id,
      coalesce(nullif(trim(coalesce(p_stoppage_title, '')), ''), trim(p_title)),
      p_stoppage_description,
      NULL,                   -- el motivo lo aporta la categoría de la incidencia
      v_start,
      NULL,                 -- duración desconocida: parada abierta
      'En curso',
      auth.uid(),
      auth.uid()
    )
    RETURNING id INTO v_stoppage_id;
  END IF;

  RETURN jsonb_build_object(
    'incident_id', v_incident_id,
    'stoppage_id', v_stoppage_id
  );
END;
$$;

-- 4. RPC: cerrar una parada abierta -------------------------------------------

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
  IF NOT (public.can_read_ops_data() AND public.can_manage_stoppages()) THEN
    RAISE EXCEPTION 'No puedes gestionar paradas';
  END IF;

  SELECT * INTO v_stop FROM public.equipment_stoppages WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parada no encontrada';
  END IF;
  IF v_stop.status IN ('Completada', 'Cancelada') THEN
    RETURN p_id;  -- idempotente
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

-- 5. Auto-cierre al resolver/cancelar la incidencia ----------------------------

CREATE OR REPLACE FUNCTION public.close_stoppages_for_incident()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('Resuelta', 'Cancelada') THEN
    UPDATE public.equipment_stoppages
    SET end_at = now(),
        status = CASE WHEN NEW.status = 'Resuelta' THEN 'Completada' ELSE 'Cancelada' END
    WHERE incident_id = NEW.id
      AND status NOT IN ('Completada', 'Cancelada');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_incidents_close_stoppages ON public.incidents;
CREATE TRIGGER trg_incidents_close_stoppages
  AFTER UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.close_stoppages_for_incident();

-- 6. Al convertir a OT, la parada queda vinculada a esa OT --------------------

CREATE OR REPLACE FUNCTION public.link_stoppages_on_convert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.related_incident_id IS NOT NULL
     AND (OLD IS NULL OR OLD.related_incident_id IS DISTINCT FROM NEW.related_incident_id) THEN
    UPDATE public.equipment_stoppages
    SET work_order_id = NEW.id
    WHERE incident_id = NEW.related_incident_id
      AND work_order_id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_work_orders_link_stoppages ON public.work_orders;
CREATE TRIGGER trg_work_orders_link_stoppages
  AFTER INSERT OR UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.link_stoppages_on_convert();

-- 7. La máquina de estados permite abrir una parada ya 'En curso' --------------
-- (las paradas nacidas de una incidencia se crean directamente en curso; el
-- trigger es BEFORE UPDATE, así que el INSERT no lo valida — sólo se refuerza
-- que una parada cerrada no se reabra).

DROP TRIGGER IF EXISTS trg_equipment_stoppages_transition ON public.equipment_stoppages;
CREATE TRIGGER trg_equipment_stoppages_transition
  BEFORE UPDATE ON public.equipment_stoppages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stoppage_transition();
