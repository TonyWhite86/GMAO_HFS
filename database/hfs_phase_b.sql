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
