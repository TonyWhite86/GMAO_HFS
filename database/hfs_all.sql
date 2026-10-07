-- ============================================================================
-- GMAO HFS — SCRIPT ÚNICO DE SINCRONIZACIÓN
-- ============================================================================
-- Lleva la BD al estado final de la aplicación, sea cual sea lo que tengas
-- ya aplicado. Es IDEMPOTENTE: puedes ejecutarlo las veces que quieras.
--
-- ORDEN DE EJECUCIÓN: éste es el único archivo que necesitas. Sustituye a:
--   hfs_phase_b → c → d → e → f → f2 → work_order_events
--   → incident_stoppage → g → g2
--
-- NO incluye hfs_setup.sql porque ése hace DROP TABLE ... CASCADE (borra
-- todos los datos). Sólo se ejecuta al levantar una BD nueva.
--
-- Al final hay un bloque de DIAGNÓSTICO que imprime qué existe en la BD.
-- ============================================================================

-- 0. Comprobación previa -------------------------------------------------------
-- Si falla aquí es que falta el esquema base: ejecuta antes hfs_setup.sql
-- (¡ojo, borra datos!) sobre una BD nueva.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'Falta el esquema base: ejecuta antes database/hfs_setup.sql (¡borra todos los datos!)';
  END IF;
END $$;

-- 1. Limpieza de sobrecargas ---------------------------------------------------
-- CREATE OR REPLACE sólo sustituye a una función con los MISMOS tipos de
-- argumento. Si una versión anterior tenía otra firma, al re-ejecutar se crea
-- una sobrecarga y PostgREST deja de saber cuál llamar (error PGRST203).
-- Borramos TODAS las versiones de cada RPC antes de recrearlas.

-- 1a. Barrido de políticas que dependen de esas funciones ----------------------
-- DROP FUNCTION rechaza soltar una función de la que depende una política
-- (error 2BP01). Las políticas de estas tablas las recrean los scripts de las
-- fases b–e, así que se pueden soltar sin miedo. NO incluimos storage.objects:
-- esas políticas sólo las crea hfs_setup.sql y no se re-crean aquí.

DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'incidents','incident_comments','incident_categories',
        'work_orders','comments','subtasks','attachments','work_order_collaborators',
        'equipment','inventory','inventory_movements',
        'purchase_orders','purchase_order_items',
        'preventive_plans','equipment_stoppages',
        'skills','user_skills','user_permissions',
        'profiles','sections','work_order_sequences','incident_sequences'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Políticas eliminadas antes de recrear las funciones: %', n;
END $$;

DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n2 ON n2.oid = p.pronamespace
    WHERE n2.nspname = 'public'
      AND p.proname IN (
        'incident_visible_to_me', 'can_manage_incident', 'can_see_incident',
        'can_manage_incident_by_id', 'create_incident_with_stoppage',
        'complete_stoppage', 'transition_incident', 'convert_incident_to_wo',
        'transition_work_order', 'assign_work_order', 'unassign_work_order',
        'create_purchase_order', 'receive_purchase_order',
        'register_inventory_movement', 'merge_inventory_items',
        'create_user_with_role', 'delete_user_with_role',
        'launch_plan_next_wo', 'launch_due_preventive_plans',
        'log_wo_event', 'wo_active_seconds_from_history'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    n := n + 1;
    RAISE NOTICE 'Eliminada sobrecarga: %', r.sig;
  END LOOP;
  RAISE NOTICE 'Sobrecargas eliminadas: %', n;
END $$;

-- 2. Cadena completa -----------------------------------------------------------


-- ===== hfs_phase_b.sql =====

-- ============================================================================
-- GMAO HFS — Fase B: autenticación real y RLS por roles
--
-- 1. Restaura is_admin()/is_staff() reales (leen el JWT de Supabase Auth)
-- 2. Endurece las políticas abiertas a "solo usuarios autenticados"
-- 3. Protege los RPC (solo admin crea/borra usuarios; staff mueve inventario)
-- 4. Añade delete_user_with_role (baja de usuario en auth.users + profiles)
-- 5. Triggers de IDs como SECURITY DEFINER y lecturas solo autenticadas
--
-- IMPORTANTE: ejecutar DESPUÉS de crear el usuario admin con
-- create_user_with_role (este script protege esa función).
-- ============================================================================

-- 1. Funciones RLS reales por JWT ---------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'Admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('Admin', 'Responsable Sección', 'Técnico');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Políticas: todo pasa por sesión autenticada -------------------------------

DROP POLICY IF EXISTS "Open Comments" ON public.comments;
DROP POLICY IF EXISTS "Comments require login" ON public.comments;
CREATE POLICY "Comments require login" ON public.comments
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Open Attachments" ON public.attachments;
DROP POLICY IF EXISTS "Attachments require login" ON public.attachments;
CREATE POLICY "Attachments require login" ON public.attachments
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Open Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Subtasks require login" ON public.subtasks;
CREATE POLICY "Subtasks require login" ON public.subtasks
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acceso total incidencias" ON public.incidents;
DROP POLICY IF EXISTS "Incidents require login" ON public.incidents;
CREATE POLICY "Incidents require login" ON public.incidents
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acceso total comentarios" ON public.incident_comments;
DROP POLICY IF EXISTS "Incident Comments require login" ON public.incident_comments;
CREATE POLICY "Incident Comments require login" ON public.incident_comments
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Full Access Orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Orders require login" ON public.purchase_orders;
CREATE POLICY "Orders require login" ON public.purchase_orders
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Full Access Order Items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Order Items require login" ON public.purchase_order_items;
CREATE POLICY "Order Items require login" ON public.purchase_order_items
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert Movements" ON public.inventory_movements;
CREATE POLICY "Insert Movements" ON public.inventory_movements
  FOR INSERT WITH CHECK (public.is_staff());

-- 3. RPC protegidos -----------------------------------------------------------

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

  INSERT INTO public.profiles (id, name, email, role, sections, active)
  VALUES (new_user_id, new_name, new_email, new_role, new_sections, true)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role, sections = EXCLUDED.sections, name = EXCLUDED.name;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_user_with_role(p_user_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_type NOT IN ('IN', 'OUT') THEN
        RAISE EXCEPTION 'Invalid movement type: %. Must be IN or OUT.', p_type;
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive, got %.', p_quantity;
    END IF;

    INSERT INTO public.inventory_movements (item_id, type, quantity, reason, user_id)
    VALUES (p_item_id, p_type, p_quantity, p_reason, p_user_id);

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
    updated_parts JSONB;BEGIN
    IF NOT public.is_staff() THEN
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
    UPDATE public.inventory
    SET
        quantity = COALESCE(keep_record.quantity, 0) + COALESCE(delete_record.quantity, 0),
        linked_equipment_ids = combined_equipment_ids,
        image = COALESCE(keep_record.image, delete_record.image),
        manufacturer = COALESCE(keep_record.manufacturer, delete_record.manufacturer),
        supplier = COALESCE(keep_record.supplier, delete_record.supplier),
        location = COALESCE(keep_record.location, delete_record.location)
    WHERE id = keep_id;
    DELETE FROM public.inventory WHERE id = delete_id;
    RETURN keep_id;
END;
$$;

-- 4. Triggers de IDs como SECURITY DEFINER ---------------------------------
-- (el trigger de incidencias debe poder escribir incident_sequences aunque
-- quien cree la incidencia sea un Observador)

CREATE OR REPLACE FUNCTION public.generate_work_order_id()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
    next_val INTEGER;
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        current_year := date_part('year', now())::INTEGER;
        INSERT INTO public.work_order_sequences (year, last_val)
        VALUES (current_year, 0)
        ON CONFLICT (year) DO NOTHING;
        UPDATE public.work_order_sequences
        SET last_val = last_val + 1
        WHERE year = current_year
        RETURNING last_val INTO next_val;
        NEW.id := 'OT-' || current_year::TEXT || '-' || lpad(next_val::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_incident_id()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
    next_val INTEGER;
BEGIN
    IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
        current_year := date_part('year', now())::INTEGER;
        INSERT INTO public.incident_sequences (year, last_val)
        VALUES (current_year, 0)
        ON CONFLICT (year) DO NOTHING;
        UPDATE public.incident_sequences
        SET last_val = last_val + 1
        WHERE year = current_year
        RETURNING last_val INTO next_val;
        NEW.display_id := 'INC-' || current_year::TEXT || '-' || lpad(next_val::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP POLICY IF EXISTS "Read Profiles" ON public.profiles;
CREATE POLICY "Read Profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Sections" ON public.sections;
CREATE POLICY "Read Sections" ON public.sections FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Permissions" ON public.user_permissions;
CREATE POLICY "Read Permissions" ON public.user_permissions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Equipment" ON public.equipment;
CREATE POLICY "Read Equipment" ON public.equipment FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Inventory" ON public.inventory;
CREATE POLICY "Read Inventory" ON public.inventory FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Work Orders" ON public.work_orders;
CREATE POLICY "Read Work Orders" ON public.work_orders FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Plans" ON public.preventive_plans;
CREATE POLICY "Read Plans" ON public.preventive_plans FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Movements" ON public.inventory_movements;
CREATE POLICY "Read Movements" ON public.inventory_movements FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Skills" ON public.skills;
CREATE POLICY "Read Skills" ON public.skills FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read User Skills" ON public.user_skills;
CREATE POLICY "Read User Skills" ON public.user_skills FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Collaborators" ON public.work_order_collaborators;
CREATE POLICY "Read Collaborators" ON public.work_order_collaborators FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read WO Sequences" ON public.work_order_sequences;
CREATE POLICY "Read WO Sequences" ON public.work_order_sequences FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Incident Sequences" ON public.incident_sequences;
CREATE POLICY "Read Incident Sequences" ON public.incident_sequences FOR SELECT USING (auth.role() = 'authenticated');


-- ===== hfs_phase_c.sql =====

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


-- ===== hfs_phase_d.sql =====

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


-- ===== hfs_phase_e.sql =====

-- ============================================================================
-- GMAO HFS — Fase E: sectorización real, permisos por nivel, identidad
--                    no falsificable, observadores bloqueados en BD
-- ============================================================================
-- Todo lo que hasta ahora solo se filtraba en el cliente (useFilteredData,
-- usePermissions, Inventaro.tsx, WorkOrderDetailModal…) pasa a RLS + triggers.
--
-- Niveles de permiso (module = 'inventory' | 'actuaciones' | 'paradas'):
--   sin_acceso(0) < consulta(1) < parcial(2) < total(3)
--   Defaults cuando no hay fila en user_permissions (idénticos a
--   hooks/usePermissions.ts): Admin = total; Observador = sin_acceso;
--   'actuaciones' = total; 'paradas' = consulta; resto = sin_acceso.
-- ============================================================================

-- 1. Helpers de permisos ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.permission_level_rank(p_level TEXT)
RETURNS integer AS $$
  SELECT CASE p_level
    WHEN 'total'    THEN 3
    WHEN 'parcial'  THEN 2
    WHEN 'consulta' THEN 1
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.my_permission_level(p_module TEXT)
RETURNS TEXT AS $$
  SELECT coalesce(
    (
      SELECT level FROM public.user_permissions
      WHERE user_id = auth.uid() AND module = p_module
      LIMIT 1
    ),
    CASE
      WHEN public.is_admin()    THEN 'total'
      WHEN public.is_observer() THEN 'sin_acceso'
      WHEN p_module = 'actuaciones' THEN 'total'
      WHEN p_module = 'paradas'     THEN 'consulta'
      ELSE 'sin_acceso'
    END
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_inventory_access(p_min_level TEXT)
RETURNS boolean AS $$
  SELECT public.permission_level_rank(public.my_permission_level('inventory'))
      >= public.permission_level_rank(p_min_level);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Autenticado, con perfil activo y NO observador (los observadores solo
-- tocan incidents* / incident_categories / sections / su propio profiles).
CREATE OR REPLACE FUNCTION public.can_read_ops_data()
RETURNS boolean AS $$
  SELECT auth.role() = 'authenticated'
     AND NOT public.is_profile_inactive()
     AND NOT public.is_observer();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Base común para las tablas que también ven los observadores.
CREATE OR REPLACE FUNCTION public.can_read_catalog()
RETURNS boolean AS $$
  SELECT auth.role() = 'authenticated' AND NOT public.is_profile_inactive();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ¿Tiene el usuario actual este rol exacto en su perfil?
CREATE OR REPLACE FUNCTION public.role_in_profile(p_role TEXT)
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT role = p_role FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Helpers de ámbito para órdenes de trabajo y equipos ----------------------

-- Espejo de hooks/useFilteredData.ts:useRestrictedItems para work_orders:
--   Admin | comodín | asignación explícita (responsable / colaborador)
--          | (sección o collaborating_sections) ∩ mis secciones, o 'Global'
CREATE OR REPLACE FUNCTION public.work_order_visible_to_me(
  p_section TEXT,
  p_collaborating_sections TEXT[],
  p_assigned_user_id UUID,
  p_collaborators UUID[]
)
RETURNS boolean AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sections TEXT[];
BEGIN
  IF NOT public.can_read_ops_data() THEN
    RETURN false;
  END IF;
  IF public.is_admin() OR public.is_wildcard_staff() THEN
    RETURN true;
  END IF;
  IF p_assigned_user_id = v_uid THEN
    RETURN true;
  END IF;
  IF p_collaborators IS NOT NULL AND v_uid = ANY(p_collaborators) THEN
    RETURN true;
  END IF;

  v_sections := public.my_sections();

  IF p_section = 'Global'
     OR (p_collaborating_sections IS NOT NULL AND 'Global' = ANY(p_collaborating_sections)) THEN
    RETURN true;
  END IF;

  RETURN (p_section IS NOT NULL AND p_section = ANY(v_sections))
      OR (p_collaborating_sections IS NOT NULL AND v_sections && p_collaborating_sections);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.work_order_visible_by_id(p_work_order_id TEXT)
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT public.work_order_visible_to_me(w.section, w.collaborating_sections, w.assigned_user_id, w.collaborators)
     FROM public.work_orders w WHERE w.id = p_work_order_id),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Espejo de useRestrictedEquipment: Admin | comodín | inventario parcial+ |
-- equipment.sections ∩ mis secciones
CREATE OR REPLACE FUNCTION public.equipment_visible_to_me(p_sections TEXT[])
RETURNS boolean AS $$
BEGIN
  IF NOT public.can_read_ops_data() THEN
    RETURN false;
  END IF;
  IF public.is_admin() OR public.is_wildcard_staff() THEN
    RETURN true;
  END IF;
  IF public.has_inventory_access('parcial') THEN
    RETURN true;
  END IF;
  RETURN public.my_sections() && coalesce(p_sections, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Adjuntos: la tabla attachments solo tiene padres 'work_order' y 'equipment'
CREATE OR REPLACE FUNCTION public.attachment_visible_to_me(p_parent_type TEXT, p_parent_id TEXT)
RETURNS boolean AS $$
BEGIN
  IF NOT public.can_read_ops_data() THEN
    RETURN false;
  END IF;
  IF p_parent_type = 'work_order' THEN
    RETURN public.work_order_visible_by_id(p_parent_id);
  END IF;
  IF p_parent_type = 'equipment' THEN
    -- parent_id es TEXT pero equipment.id es UUID: blindamos el cast para que
    -- una fila sucia no tumbe la consulta completa.
    IF p_parent_id IS NULL OR p_parent_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN false;
    END IF;
    RETURN public.equipment_visible_to_me(
      (SELECT sections FROM public.equipment WHERE id = p_parent_id::uuid)
    );
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Identidad no falsificable ------------------------------------------------

ALTER TABLE public.work_orders    ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.comments       ALTER COLUMN user_id   SET DEFAULT auth.uid();
ALTER TABLE public.incident_comments ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.inventory_movements ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.equipment_stoppages ALTER COLUMN created_by   SET DEFAULT auth.uid();
ALTER TABLE public.equipment_stoppages ALTER COLUMN requested_by SET DEFAULT auth.uid();
ALTER TABLE public.purchase_orders     ALTER COLUMN requested_by SET DEFAULT auth.uid();

-- user_name siempre sale del perfil; solo los comentarios de sistema pueden
-- llevar un nombre libre ('Sistema').
CREATE OR REPLACE FUNCTION public.fill_user_name()
RETURNS TRIGGER AS $$
BEGIN
  IF coalesce(NEW.is_system, false) THEN
    NEW.user_name := coalesce(NEW.user_name, 'Sistema');
  ELSE
    NEW.user_name := (SELECT name FROM public.profiles WHERE id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comments_fill_user_name ON public.comments;
CREATE TRIGGER trg_comments_fill_user_name
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.fill_user_name();

DROP TRIGGER IF EXISTS trg_incident_comments_fill_user_name ON public.incident_comments;
CREATE TRIGGER trg_incident_comments_fill_user_name
  BEFORE INSERT OR UPDATE ON public.incident_comments
  FOR EACH ROW EXECUTE FUNCTION public.fill_user_name();

-- 4. Integridad: UNIQUE que se borraron y faltaban -----------------------------

-- Una incidencia -> como mucho una OT (recuperación idempotente de la conversión)
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_related_incident
  ON public.work_orders (related_incident_id)
  WHERE related_incident_id IS NOT NULL;

-- Una OT -> como mucho una incidencia origen
CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_work_order
  ON public.incidents (work_order_id)
  WHERE work_order_id IS NOT NULL;

-- Unicidades que solo se comprobaban en la UI (no rompen el script si ya hay duplicados)
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX uq_equipment_code ON public.equipment (lower(code))
      WHERE code IS NOT NULL AND code <> '';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'uq_equipment_code no creada (¿códigos de equipo duplicados?): %', SQLERRM;
  END;
  BEGIN
    CREATE UNIQUE INDEX uq_inventory_sku ON public.inventory (lower(sku));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'uq_inventory_sku no creada (¿SKUs duplicados?): %', SQLERRM;
  END;
END $$;

-- 5. RLS: tablas de catálogo (visibles también para observadores) -------------

DROP POLICY IF EXISTS "Read Sections" ON public.sections;
DROP POLICY IF EXISTS "Manage Sections" ON public.sections;
CREATE POLICY "Read Sections" ON public.sections
  FOR SELECT USING (public.can_read_catalog());
CREATE POLICY "Manage Sections" ON public.sections
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- profiles: necesario para joins (creatorName, resolvedByName…). El email queda
-- expuesto a cualquier autenticado — restringirlo exige una vista (Fase G).
DROP POLICY IF EXISTS "Read Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Manage Profiles" ON public.profiles;
CREATE POLICY "Read Profiles" ON public.profiles
  FOR SELECT USING (public.can_read_catalog());
CREATE POLICY "Manage Profiles" ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Read Categories" ON public.incident_categories;
DROP POLICY IF EXISTS "Manage Categories" ON public.incident_categories;
CREATE POLICY "Read Categories" ON public.incident_categories
  FOR SELECT USING (public.can_read_catalog());
CREATE POLICY "Manage Categories" ON public.incident_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. RLS: permisos de usuario -------------------------------------------------

DROP POLICY IF EXISTS "Read Permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Manage Permissions" ON public.user_permissions;
CREATE POLICY "Read Permissions" ON public.user_permissions
  FOR SELECT USING (public.can_read_ops_data());
CREATE POLICY "Manage Permissions" ON public.user_permissions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. RLS: equipos -------------------------------------------------------------

DROP POLICY IF EXISTS "Read Equipment" ON public.equipment;
DROP POLICY IF EXISTS "Manage Equipment" ON public.equipment;
CREATE POLICY "Read Equipment" ON public.equipment
  FOR SELECT USING (public.equipment_visible_to_me(sections));
CREATE POLICY "Manage Equipment" ON public.equipment
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8. RLS: órdenes de trabajo --------------------------------------------------
-- DELETE pasa a ser solo Admin (antes is_staff() permitía borrar a un técnico).

DROP POLICY IF EXISTS "Read Work Orders" ON public.work_orders;
DROP POLICY IF EXISTS "Manage Work Orders" ON public.work_orders;
CREATE POLICY "Read Work Orders" ON public.work_orders
  FOR SELECT USING (public.work_order_visible_to_me(section, collaborating_sections, assigned_user_id, collaborators));

CREATE POLICY "Create Work Orders" ON public.work_orders
  FOR INSERT WITH CHECK (
    public.can_read_ops_data()
    AND created_by = auth.uid()
    AND public.work_order_visible_to_me(section, collaborating_sections, assigned_user_id, collaborators)
  );

CREATE POLICY "Update Work Orders" ON public.work_orders
  FOR UPDATE
  USING (public.work_order_visible_to_me(section, collaborating_sections, assigned_user_id, collaborators))
  WITH CHECK (public.work_order_visible_to_me(section, collaborating_sections, assigned_user_id, collaborators));

CREATE POLICY "Delete Work Orders" ON public.work_orders
  FOR DELETE USING (public.is_admin());

-- 9. RLS: tablas hijas de una OT (comentarios, subtareas, adjuntos, colaboradores)

DROP POLICY IF EXISTS "Comments require login" ON public.comments;
DROP POLICY IF EXISTS "Open Comments" ON public.comments;
CREATE POLICY "Read WO Comments" ON public.comments
  FOR SELECT USING (public.work_order_visible_by_id(work_order_id));
CREATE POLICY "Create WO Comments" ON public.comments
  FOR INSERT WITH CHECK (
    public.can_read_ops_data()
    AND public.work_order_visible_by_id(work_order_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );
CREATE POLICY "Manage WO Comments" ON public.comments
  FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin() OR public.is_wildcard_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_admin() OR public.is_wildcard_staff());
CREATE POLICY "Delete WO Comments" ON public.comments
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Subtasks require login" ON public.subtasks;
DROP POLICY IF EXISTS "Open Subtasks" ON public.subtasks;
CREATE POLICY "Read Subtasks" ON public.subtasks
  FOR SELECT USING (public.work_order_visible_by_id(work_order_id));
CREATE POLICY "Manage Subtasks" ON public.subtasks
  FOR ALL USING (public.can_read_ops_data() AND public.work_order_visible_by_id(work_order_id))
  WITH CHECK (public.can_read_ops_data() AND public.work_order_visible_by_id(work_order_id));

DROP POLICY IF EXISTS "Attachments require login" ON public.attachments;
DROP POLICY IF EXISTS "Open Attachments" ON public.attachments;
CREATE POLICY "Read Attachments" ON public.attachments
  FOR SELECT USING (public.attachment_visible_to_me(parent_type, parent_id));
CREATE POLICY "Manage Attachments" ON public.attachments
  FOR ALL USING (public.attachment_visible_to_me(parent_type, parent_id))
  WITH CHECK (public.attachment_visible_to_me(parent_type, parent_id));

DROP POLICY IF EXISTS "Read Collaborators" ON public.work_order_collaborators;
DROP POLICY IF EXISTS "Insert Collaborators" ON public.work_order_collaborators;
DROP POLICY IF EXISTS "Update Collaborators" ON public.work_order_collaborators;
DROP POLICY IF EXISTS "Delete Collaborators" ON public.work_order_collaborators;
CREATE POLICY "Read Collaborators" ON public.work_order_collaborators
  FOR SELECT USING (public.work_order_visible_by_id(work_order_id));
CREATE POLICY "Manage Collaborators" ON public.work_order_collaborators
  FOR ALL USING (public.can_read_ops_data() AND public.work_order_visible_by_id(work_order_id))
  WITH CHECK (public.can_read_ops_data() AND public.work_order_visible_by_id(work_order_id));

-- 10. RLS: planes preventivos -------------------------------------------------

DROP POLICY IF EXISTS "Read Plans" ON public.preventive_plans;
DROP POLICY IF EXISTS "Manage Plans" ON public.preventive_plans;
CREATE POLICY "Read Plans" ON public.preventive_plans
  FOR SELECT USING (
    public.can_read_ops_data()
    AND (
      public.is_admin() OR public.is_wildcard_staff()
      OR section IS NULL OR section = '' OR section = 'Global'
      OR section = ANY(public.my_sections())
    )
  );
CREATE POLICY "Manage Plans" ON public.preventive_plans
  FOR ALL USING (
    public.can_read_ops_data()
    AND (public.is_admin() OR role_in_profile('Responsable Sección'))
    AND (
      public.is_admin()
      OR section IS NULL OR section = '' OR section = 'Global'
      OR section = ANY(public.my_sections())
    )
  )
  WITH CHECK (
    public.can_read_ops_data()
    AND (public.is_admin() OR role_in_profile('Responsable Sección'))
    AND (
      public.is_admin()
      OR section IS NULL OR section = '' OR section = 'Global'
      OR section = ANY(public.my_sections())
    )
  );

-- 11. RLS: inventario y movimientos -------------------------------------------

-- Lectura con precio/proveedor: solo parcial+. El resto pasa por la vista
-- inventory_browse (abajo), que devuelve price/supplier como NULL.
DROP POLICY IF EXISTS "Read Inventory" ON public.inventory;
DROP POLICY IF EXISTS "Manage Inventory" ON public.inventory;
CREATE POLICY "Read Inventory" ON public.inventory
  FOR SELECT USING (public.can_read_ops_data() AND public.has_inventory_access('parcial'));
CREATE POLICY "Create Inventory" ON public.inventory
  FOR INSERT WITH CHECK (public.can_read_ops_data() AND public.has_inventory_access('parcial'));
CREATE POLICY "Update Inventory" ON public.inventory
  FOR UPDATE
  USING (public.can_read_ops_data() AND public.has_inventory_access('parcial'))
  WITH CHECK (public.can_read_ops_data() AND public.has_inventory_access('parcial'));
CREATE POLICY "Delete Inventory" ON public.inventory
  FOR DELETE USING (public.can_read_ops_data() AND public.has_inventory_access('total'));

DROP POLICY IF EXISTS "Read Movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Insert Movements" ON public.inventory_movements;
CREATE POLICY "Read Movements" ON public.inventory_movements
  FOR SELECT USING (public.can_read_ops_data() AND public.has_inventory_access('consulta'));
CREATE POLICY "Insert Movements" ON public.inventory_movements
  FOR INSERT WITH CHECK (
    public.can_read_ops_data() AND public.has_inventory_access('parcial')
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- 12. RLS: órdenes de compra --------------------------------------------------
-- Exigen permiso 'parcial'+ (coincide con canManagePurchaseOrders /
-- canViewSensibleInfo de la UI: el usuario 'consulta' solo ve stock, nunca POs).

DROP POLICY IF EXISTS "Orders require login" ON public.purchase_orders;
DROP POLICY IF EXISTS "Full Access Orders" ON public.purchase_orders;
CREATE POLICY "Read Purchase Orders" ON public.purchase_orders
  FOR SELECT USING (public.can_read_ops_data() AND public.has_inventory_access('parcial'));
CREATE POLICY "Create Purchase Orders" ON public.purchase_orders
  FOR INSERT WITH CHECK (
    public.can_read_ops_data() AND public.has_inventory_access('parcial')
    AND (requested_by IS NULL OR requested_by = auth.uid())
  );
CREATE POLICY "Update Purchase Orders" ON public.purchase_orders
  FOR UPDATE
  USING (public.can_read_ops_data() AND public.has_inventory_access('parcial'))
  WITH CHECK (public.can_read_ops_data() AND public.has_inventory_access('parcial'));
CREATE POLICY "Delete Purchase Orders" ON public.purchase_orders
  FOR DELETE USING (public.can_read_ops_data() AND public.has_inventory_access('total'));

DROP POLICY IF EXISTS "Order Items require login" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Full Access Order Items" ON public.purchase_order_items;
CREATE POLICY "Read Purchase Order Items" ON public.purchase_order_items
  FOR SELECT USING (public.can_read_ops_data() AND public.has_inventory_access('parcial'));
CREATE POLICY "Manage Purchase Order Items" ON public.purchase_order_items
  FOR ALL USING (public.can_read_ops_data() AND public.has_inventory_access('parcial'))
  WITH CHECK (public.can_read_ops_data() AND public.has_inventory_access('parcial'));

-- 13. RLS: paradas programadas ------------------------------------------------

DROP POLICY IF EXISTS "Read Stoppages" ON public.equipment_stoppages;
DROP POLICY IF EXISTS "Manage Stoppages" ON public.equipment_stoppages;
CREATE POLICY "Read Stoppages" ON public.equipment_stoppages
  FOR SELECT USING (public.can_read_ops_data());
CREATE POLICY "Create Stoppages" ON public.equipment_stoppages
  FOR INSERT WITH CHECK (
    public.can_read_ops_data() AND public.can_manage_stoppages()
    AND (created_by IS NULL OR created_by = auth.uid())
    AND (requested_by IS NULL OR requested_by = auth.uid())
  );
CREATE POLICY "Manage Stoppages" ON public.equipment_stoppages
  FOR UPDATE
  USING (public.can_read_ops_data() AND public.can_manage_stoppages())
  WITH CHECK (public.can_read_ops_data() AND public.can_manage_stoppages());
CREATE POLICY "Delete Stoppages" ON public.equipment_stoppages
  FOR DELETE USING (public.can_read_ops_data() AND public.can_manage_stoppages());

-- 14. RLS: skills y user_skills -----------------------------------------------

DROP POLICY IF EXISTS "Read Skills" ON public.skills;
DROP POLICY IF EXISTS "Manage Skills" ON public.skills;
CREATE POLICY "Read Skills" ON public.skills
  FOR SELECT USING (public.can_read_ops_data());
CREATE POLICY "Manage Skills" ON public.skills
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Read User Skills" ON public.user_skills;
DROP POLICY IF EXISTS "Manage User Skills" ON public.user_skills;
CREATE POLICY "Read User Skills" ON public.user_skills
  FOR SELECT USING (public.can_read_ops_data());
CREATE POLICY "Manage User Skills" ON public.user_skills
  FOR ALL USING (public.can_read_ops_data()) WITH CHECK (public.can_read_ops_data());

-- 15. RLS: secuencias ---------------------------------------------------------

DROP POLICY IF EXISTS "Read WO Sequences" ON public.work_order_sequences;
DROP POLICY IF EXISTS "Update WO Sequences" ON public.work_order_sequences;
DROP POLICY IF EXISTS "Read Incident Sequences" ON public.incident_sequences;
DROP POLICY IF EXISTS "Update Incident Sequences" ON public.incident_sequences;
CREATE POLICY "Read WO Sequences" ON public.work_order_sequences
  FOR SELECT USING (public.can_read_ops_data());
CREATE POLICY "Manage WO Sequences" ON public.work_order_sequences
  FOR ALL USING (public.can_read_ops_data()) WITH CHECK (public.can_read_ops_data());
CREATE POLICY "Read Incident Sequences" ON public.incident_sequences
  FOR SELECT USING (public.can_read_catalog());
CREATE POLICY "Manage Incident Sequences" ON public.incident_sequences
  FOR ALL USING (public.can_read_catalog()) WITH CHECK (public.can_read_catalog());

-- 16. Vista de lectura de inventario con precio/proveedor enmascarados --------
-- Para niveles 'consulta' price y supplier salen como NULL. Corre como el
-- propietario (bypassa RLS de inventory) pero aplica sus propios predicados.
-- OJO: el realtime de la tabla inventory sigue llegando con precio a los
-- usuarios 'parcial'+ (correcto) y NO llega a los 'consulta' (RLS los filtra),
-- así que el precio no se filtra por websocket.

DROP VIEW IF EXISTS public.inventory_browse CASCADE;

CREATE OR REPLACE VIEW public.inventory_browse AS
SELECT
  i.id,
  i.name,
  i.sku,
  i.manufacturer,
  i.quantity,
  i.min_stock,
  i.category,
  i.location,
  i.critic,
  i.status,
  i.image,
  i.qr_code,
  i.linked_equipment_ids,
  i.created_at,
  CASE WHEN public.has_inventory_access('parcial') THEN i.price   ELSE NULL END AS price,
  CASE WHEN public.has_inventory_access('parcial') THEN i.supplier ELSE NULL END AS supplier
FROM public.inventory i
WHERE public.can_read_ops_data()
  AND public.has_inventory_access('consulta');

GRANT SELECT ON public.inventory_browse TO authenticated;
REVOKE ALL ON public.inventory_browse FROM anon;

-- 17. Guard de escritura de campos sensibles de inventario --------------------
-- price/supplier solo los toca quien tiene 'parcial'+.

CREATE OR REPLACE FUNCTION public.protect_inventory_pricing()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.has_inventory_access('parcial') THEN
    IF TG_OP = 'UPDATE' AND (NEW.price IS DISTINCT FROM OLD.price
                             OR NEW.supplier IS DISTINCT FROM OLD.supplier) THEN
      RAISE EXCEPTION 'No tienes permiso para modificar precio o proveedor';
    END IF;
    IF TG_OP = 'INSERT' AND (NEW.price IS NOT NULL OR NEW.supplier IS NOT NULL) THEN
      RAISE EXCEPTION 'No tienes permiso para fijar precio o proveedor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_inventory_protect_pricing ON public.inventory;
CREATE TRIGGER trg_inventory_protect_pricing
  BEFORE INSERT OR UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.protect_inventory_pricing();

-- 18. Endurecimiento de los RPCs existentes -----------------------------------
-- Misma firma y mismo cuerpo que hfs_phase_b.sql; solo se cambia la guarda de
-- autorización para que coincida con lo que exige la UI (usePermissions.ts):
--   register_inventory_movement  -> permiso inventory 'parcial'+
--   merge_inventory_items        -> permiso inventory 'total'

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
    UPDATE public.inventory
    SET
        quantity = COALESCE(keep_record.quantity, 0) + COALESCE(delete_record.quantity, 0),
        linked_equipment_ids = combined_equipment_ids,
        image = COALESCE(keep_record.image, delete_record.image),
        manufacturer = COALESCE(keep_record.manufacturer, delete_record.manufacturer),
        supplier = COALESCE(keep_record.supplier, delete_record.supplier),
        location = COALESCE(keep_record.location, delete_record.location)
    WHERE id = keep_id;
    DELETE FROM public.inventory WHERE id = delete_id;
    RETURN keep_id;
END;
$$;


-- ===== hfs_phase_f.sql =====

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


-- ===== hfs_phase_f2.sql =====

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


-- ===== hfs_work_order_events.sql =====

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


-- ===== hfs_incident_stoppage.sql =====

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


-- ===== hfs_phase_g.sql =====

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


-- ===== hfs_phase_g2.sql =====

-- ============================================================================
-- GMAO HFS — Fase G2: ajustes a las vistas de reporting
-- ============================================================================
--  1. report_equipment_stats gana `total_count` (todas las OTs, no sólo las
--     correctivas) — lo pide la pestaña "Equipos" de Informes.
--  2. report_incident_stats_by_category: mismas métricas que
--     report_incident_stats pero agrupadas por categoría, para que la pestaña
--     "Incidencias" pueda mostrar tanto "Todas las categorías" como una suelta.
-- ============================================================================

-- 1. Equipos ------------------------------------------------------------------

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
  count(w.id) AS total_count,
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

-- 2. Incidencias por categoría ------------------------------------------------

DROP VIEW IF EXISTS public.report_incident_stats_by_category CASCADE;
CREATE VIEW public.report_incident_stats_by_category AS
SELECT
  category_id,
  count(*) AS total,
  count(*) FILTER (WHERE status = 'Abierta') AS open_count,
  count(*) FILTER (WHERE status = 'En Revisión') AS in_review_count,
  count(*) FILTER (WHERE status = 'Resuelta') AS resolved_count,
  count(*) FILTER (WHERE status = 'Cancelada') AS cancelled_count,
  count(*) FILTER (WHERE status = 'Convertida a OT') AS converted_count,
  count(*) FILTER (WHERE reason IS NOT NULL AND trim(reason) <> '') AS reasons_filled,
  count(*) FILTER (WHERE solution IS NOT NULL AND trim(solution) <> '') AS solutions_filled,
  -- Postgres no tiene round(double precision, integer): castear a numeric
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
WHERE public.incident_visible_to_me(section, category_id)
GROUP BY category_id;

GRANT SELECT ON public.report_incident_stats_by_category TO authenticated;
REVOKE ALL ON public.report_incident_stats_by_category FROM anon;



-- ============================================================================
-- GMAO HFS — Fase G2: ajustes a las vistas de reporting
-- ============================================================================
--  1. report_equipment_stats gana `total_count` (todas las OTs, no sólo las
--     correctivas) — lo pide la pestaña "Equipos" de Informes.
--  2. report_incident_stats_by_category: mismas métricas que
--     report_incident_stats pero agrupadas por categoría, para que la pestaña
--     "Incidencias" pueda mostrar tanto "Todas las categorías" como una suelta.
-- ============================================================================

-- 1. Equipos ------------------------------------------------------------------

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
  count(w.id) AS total_count,
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

-- 2. Incidencias por categoría ------------------------------------------------

DROP VIEW IF EXISTS public.report_incident_stats_by_category CASCADE;
CREATE VIEW public.report_incident_stats_by_category AS
SELECT
  category_id,
  count(*) AS total,
  count(*) FILTER (WHERE status = 'Abierta') AS open_count,
  count(*) FILTER (WHERE status = 'En Revisión') AS in_review_count,
  count(*) FILTER (WHERE status = 'Resuelta') AS resolved_count,
  count(*) FILTER (WHERE status = 'Cancelada') AS cancelled_count,
  count(*) FILTER (WHERE status = 'Convertida a OT') AS converted_count,
  count(*) FILTER (WHERE reason IS NOT NULL AND trim(reason) <> '') AS reasons_filled,
  count(*) FILTER (WHERE solution IS NOT NULL AND trim(solution) <> '') AS solutions_filled,
  -- Postgres no tiene round(double precision, integer): castear a numeric
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
WHERE public.incident_visible_to_me(section, category_id)
GROUP BY category_id;

GRANT SELECT ON public.report_incident_stats_by_category TO authenticated;
REVOKE ALL ON public.report_incident_stats_by_category FROM anon;


-- ============================================================================
-- DIAGNÓSTICO — revisa la salida de este bloque
-- ============================================================================

DO $$
DECLARE
  v_missing TEXT := '';
  r RECORD;
BEGIN
  -- Tablas nuevas
  FOR r IN
    SELECT t FROM unnest(ARRAY[
      'incident_categories','equipment_stoppages','work_order_events','profile_emails'
    ]) AS t
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name = r.t) THEN
      v_missing := v_missing || 'FALTA tabla: ' || r.t || E'\n';
    END IF;
  END LOOP;

  -- Columnas clave
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='equipment_stoppages'
                   AND column_name='incident_id') THEN
    v_missing := v_missing || 'FALTA columna: equipment_stoppages.incident_id' || E'\n';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='equipment_stoppages'
                   AND column_name='end_at' AND is_nullable='YES') THEN
    v_missing := v_missing || 'FALTA: equipment_stoppages.end_at nullable' || E'\n';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='work_orders'
                   AND column_name='time_source') THEN
    v_missing := v_missing || 'FALTA columna: work_orders.time_source' || E'\n';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles'
               AND column_name='email') THEN
    v_missing := v_missing || 'SOBRA columna: profiles.email (deberia estar en profile_emails)' || E'\n';
  END IF;

  -- Vistas
  FOR r IN
    SELECT t FROM unnest(ARRAY[
      'inventory_browse','report_worker_stats','report_equipment_stats',
      'report_part_rotation','report_incident_stats','report_incident_stats_by_category'
    ]) AS t
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.views
                   WHERE table_schema='public' AND table_name = r.t) THEN
      v_missing := v_missing || 'FALTA vista: ' || r.t || E'\n';
    END IF;
  END LOOP;

  -- Sobrecargas de RPCs (debe haber exactamente 1 por funcion)
  FOR r IN
    SELECT p.proname, count(*) AS n
    FROM pg_proc p JOIN pg_namespace n2 ON n2.oid = p.pronamespace
    WHERE n2.nspname = 'public' AND p.proname IN (
      'create_incident_with_stoppage','complete_stoppage','transition_work_order',
      'transition_incident','convert_incident_to_wo','assign_work_order',
      'create_purchase_order','receive_purchase_order','register_inventory_movement',
      'merge_inventory_items','create_user_with_role','launch_due_preventive_plans'
    )
    GROUP BY p.proname
  LOOP
    IF r.n <> 1 THEN
      v_missing := v_missing || 'SOBRECARGA (' || r.n || ' versiones): ' || r.proname || E'\n';
    END IF;
  END LOOP;

  IF v_missing = '' THEN
    RAISE NOTICE '==== TODO OK: la BD esta sincronizada con la aplicacion ====';
  ELSE
    RAISE WARNING '==== PROBLEMAS DETECTADOS ====\n%', v_missing;
  END IF;
END $$;
