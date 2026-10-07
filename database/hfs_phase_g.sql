-- ============================================================================
-- GMAO HFS — Fase G: privacidad de email, motor de planes y vistas de reporting
-- ============================================================================
--   G9 · profiles.email se mueve a una tabla aparte con RLS sólo-Admin, para
--        que ningún join ni realtime pueda filtrarlo.
--   G5 · launch_due_preventive_plans() + cron diario que lanza los planes
--        vencidos (solo la última ejecución perdida, no todas).
--   G6 · Vistas de reporting para las pestañas actuales de Informes.
-- ============================================================================

-- 1. G9: email de perfil fuera de profiles -------------------------------------
-- Los joins que hace el cliente piden sólo `name`, así que el email no se
-- colaba por ahí. Se colaba por select('*') y por el realtime de profiles.

CREATE TABLE IF NOT EXISTS public.profile_emails (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profile_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read Own Profile Email" ON public.profile_emails;
DROP POLICY IF EXISTS "Manage Profile Emails" ON public.profile_emails;
CREATE POLICY "Read Own Profile Email" ON public.profile_emails
  FOR SELECT USING (auth.uid() = profile_id OR public.is_admin());
CREATE POLICY "Manage Profile Emails" ON public.profile_emails
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Migrar los emails existentes. Sólo si la columna aún existe: en una
-- re-ejecución profiles.email ya se borró y este INSERT fallaría. Por eso va
-- en un DO con EXECUTE (SQL dinámico, no se analiza si la rama no se ejecuta).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    EXECUTE $q$
      INSERT INTO public.profile_emails (profile_id, email)
      SELECT id, lower(trim(email))
      FROM public.profiles
      WHERE email IS NOT NULL AND trim(email) <> ''
      ON CONFLICT (profile_id) DO NOTHING
    $q$;
    RAISE NOTICE 'Emails migrados de profiles a profile_emails';
  ELSE
    RAISE NOTICE 'profiles.email ya no existe: migración omitida';
  END IF;
END $$;

-- Y profiles deja de tener la columna
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- create_user_with_role / delete_user_with_role: gestionar también profile_emails.
-- Mismo cuerpo que hfs_phase_b.sql, sólo se quita `email` del INSERT de profiles
-- y se añade la fila en profile_emails.
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  new_email TEXT,
  new_password TEXT,
  new_role TEXT,
  new_name TEXT,
  new_sections TEXT[]
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    new_email,
    crypt(new_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', new_name),
    now(), now(), '', '', '', ''
  )
  RETURNING id INTO new_user_id;

  INSERT INTO public.profiles (id, name, role, sections, active)
  VALUES (new_user_id, new_name, new_role, new_sections, true)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role, sections = EXCLUDED.sections, name = EXCLUDED.name;

  INSERT INTO public.profile_emails (profile_id, email)
  VALUES (new_user_id, lower(trim(new_email)))
  ON CONFLICT (profile_id) DO UPDATE SET email = EXCLUDED.email;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_user_with_role(p_user_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  -- profile_emails cae por ON DELETE CASCADE
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. G5: motor de planes preventivos -------------------------------------------

-- Lanza una OT por cada plan vencido. Si un plan se saltó varias ejecuciones,
-- lanza SOLO UNA OT (la más reciente) y salta next_run al futuro, para no
-- inundar de órdenes cuando la app ha estado caída.
CREATE OR REPLACE FUNCTION public.launch_due_preventive_plans()
RETURNS TABLE(plan_id UUID, wo_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan RECORD;
  v_wo TEXT;
  v_fired INT := 0;
BEGIN
  IF NOT (public.is_admin() OR public.role_in_profile('Responsable Sección') OR public.is_wildcard_staff()) THEN
    RAISE EXCEPTION 'No puedes lanzar planes preventivos';
  END IF;

  FOR v_plan IN
    SELECT p.* FROM public.preventive_plans p
    WHERE p.next_run <= now()
    ORDER BY p.next_run
  LOOP
    v_wo := public.launch_plan_next_wo(v_plan.id);
    v_fired := v_fired + 1;

    -- Salta next_run al futuro: si se perdieron 3 semanas, no lanzamos 3 OTs.
    UPDATE public.preventive_plans
    SET next_run = now() + make_interval(days => coalesce(frequency_days, 30))
    WHERE id = v_plan.id AND next_run <= now();

    IF v_wo IS NOT NULL THEN
      plan_id := v_plan.id;
      wo_id := v_wo;
      RETURN NEXT;
    END IF;
  END LOOP;

  RAISE NOTICE 'Planes preventivos lanzados: %', v_fired;
END;
$$;

-- Cron diario (pg_cron). Si no está instalado, se avisa y se puede llamar a mano.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('gmao-launch-preventive-plans');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'gmao-launch-preventive-plans',
      '30 6 * * *',
      'SELECT public.launch_due_preventive_plans()'
    );
    RAISE NOTICE 'Cron diario instalado (06:30).';
  ELSE
    RAISE WARNING 'pg_cron no está instalado: llama a public.launch_due_preventive_plans() a mano o desde un job externo.';
  END IF;
END $$;

-- 3. G6: vistas de reporting para las pestañas actuales -------------------------

-- 3.1 Personal: OTs, horas, coste material y % de tiempo a mano
DROP VIEW IF EXISTS public.report_worker_stats CASCADE;
CREATE VIEW public.report_worker_stats AS
SELECT
  p.id AS worker_id,
  p.name AS worker_name,
  p.role AS worker_role,
  count(w.id) FILTER (WHERE w.status = 'Completada') AS completed_count,
  coalesce(sum(w.time_spent_minutes) FILTER (WHERE w.status = 'Completada'), 0) AS total_minutes,
  coalesce(round((avg(w.time_spent_minutes) FILTER (WHERE w.status = 'Completada'))::numeric, 0), 0) AS avg_minutes,
  coalesce(sum(w.time_spent_minutes) FILTER (
    WHERE w.status = 'Completada' AND w.time_source = 'manual'), 0) AS manual_minutes
FROM public.profiles p
LEFT JOIN public.work_orders w
  ON w.assigned_user_id = p.id
WHERE public.can_read_catalog()
GROUP BY p.id, p.name, p.role;

GRANT SELECT ON public.report_worker_stats TO authenticated;
REVOKE ALL ON public.report_worker_stats FROM anon;

-- 3.2 Equipos: fallos correctivos, coste de repuestos y horas
DROP VIEW IF EXISTS public.report_equipment_stats CASCADE;
CREATE VIEW public.report_equipment_stats AS
WITH part_usage AS (
  SELECT
    w.equipment_id AS equipment_id,
    nullif(part->>'partId', '')::uuid AS item_id,
    (part->>'quantity')::numeric AS qty
  FROM public.work_orders w
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.used_parts, '[]')) AS part
)
SELECT
  e.id AS equipment_id,
  e.name AS equipment_name,
  count(w.id) FILTER (WHERE w.type = 'Correctivo') AS corrective_count,
  coalesce(sum(w.time_spent_minutes), 0) AS total_minutes,
  coalesce(sum(pu.qty * coalesce(i.price, 0)), 0) AS parts_cost
FROM public.equipment e
LEFT JOIN public.work_orders w ON w.equipment_id = e.id
LEFT JOIN part_usage pu ON pu.equipment_id = e.id
LEFT JOIN public.inventory i ON i.id = pu.item_id
WHERE public.can_read_catalog()
GROUP BY e.id, e.name;

GRANT SELECT ON public.report_equipment_stats TO authenticated;
REVOKE ALL ON public.report_equipment_stats FROM anon;

-- 3.3 Repuestos: rotación (cuántas veces se usó cada artículo en OTs)
DROP VIEW IF EXISTS public.report_part_rotation CASCADE;
CREATE VIEW public.report_part_rotation AS
WITH part_usage AS (
  SELECT
    nullif(part->>'partId', '')::uuid AS item_id,
    (part->>'quantity')::numeric AS qty,
    w.id AS wo_id
  FROM public.work_orders w
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.used_parts, '[]')) AS part
)
SELECT
  i.id AS item_id,
  i.name AS item_name,
  i.sku,
  coalesce(sum(pu.qty), 0) AS total_used,
  count(DISTINCT pu.wo_id) AS work_orders_count
FROM public.inventory i
LEFT JOIN part_usage pu ON pu.item_id = i.id
WHERE public.can_read_catalog()
GROUP BY i.id, i.name, i.sku;

GRANT SELECT ON public.report_part_rotation TO authenticated;
REVOKE ALL ON public.report_part_rotation FROM anon;

-- 3.4 Incidencias: estadísticas del módulo de Informes
DROP VIEW IF EXISTS public.report_incident_stats CASCADE;
CREATE VIEW public.report_incident_stats AS
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE status = 'Abierta') AS open_count,
  count(*) FILTER (WHERE status = 'En Revisión') AS in_review_count,
  count(*) FILTER (WHERE status = 'Resuelta') AS resolved_count,
  count(*) FILTER (WHERE status = 'Cancelada') AS cancelled_count,
  count(*) FILTER (WHERE status = 'Convertida a OT') AS converted_count,
  count(*) FILTER (WHERE reason IS NOT NULL AND trim(reason) <> '') AS reasons_filled,
  count(*) FILTER (WHERE solution IS NOT NULL AND trim(solution) <> '') AS solutions_filled,
  -- Postgres no tiene round(double precision, integer): hay que castear a numeric
  round(
    ((count(*) FILTER (WHERE status = 'Resuelta'))::numeric
     / greatest(count(*), 1)) * 100, 1
  ) AS resolution_rate,
  round(
    (avg(date_part('epoch', resolved_at - created_at) / 86400.0)
      FILTER (WHERE status = 'Resuelta' AND resolved_at > created_at))::numeric,
    2
  ) AS avg_resolution_days
FROM public.incidents
WHERE public.incident_visible_to_me(section, category_id);

GRANT SELECT ON public.report_incident_stats TO authenticated;
REVOKE ALL ON public.report_incident_stats FROM anon;