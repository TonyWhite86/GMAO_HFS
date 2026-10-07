-- ============================================================================
-- GMAO HFS (Healthy Food Solutions) — Full Database Schema
--
-- This file is the authoritative schema definition. All migrations in
-- database/ and database/migrations/ have been incorporated here.
-- To bootstrap a fresh database, run this entire script in the Supabase SQL Editor.
--
-- Generated from: database_schema.sql (base) + 23 migration files
-- Tables: 20 total
-- Storage buckets: 3 (equipment-photos, work-order-files, incident-files)
-- ============================================================================

-- Limpieza inicial
DROP TABLE IF EXISTS public.work_order_collaborators CASCADE;
DROP TABLE IF EXISTS public.work_order_sequences CASCADE;
DROP TABLE IF EXISTS public.incident_sequences CASCADE;
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.incident_comments CASCADE;
DROP TABLE IF EXISTS public.incidents CASCADE;
DROP TABLE IF EXISTS public.user_skills CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP TABLE IF EXISTS public.subtasks CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.work_orders CASCADE;
DROP TABLE IF EXISTS public.preventive_plans CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.equipment CASCADE;
DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.sections CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TABLAS BASE
-- ============================================================================

-- Usuarios (Profiles)
CREATE TABLE public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Técnico',
  sections TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Secciones
CREATE TABLE public.sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_special BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permisos por usuario y módulo
CREATE TABLE public.user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'sin_acceso' CHECK (level IN ('sin_acceso', 'consulta', 'parcial', 'total')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, module)
);

-- Equipos
CREATE TABLE public.equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  manufacturer TEXT,
  serial_number TEXT,
  location TEXT,
  status TEXT DEFAULT 'En Producción',
  sections TEXT[] DEFAULT '{}',
  parent_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  photo_url TEXT,
  qr_code TEXT,
  code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inventario
CREATE TABLE public.inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category TEXT,
  location TEXT,
  price DECIMAL(10,2),
  supplier TEXT,
  qr_code TEXT,
  critic TEXT DEFAULT 'Media',
  image TEXT,
  linked_equipment_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'Active',
  manufacturer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Planes Preventivos
CREATE TABLE public.preventive_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE,
  frequency_days INTEGER NOT NULL,
  description TEXT,
  tasks JSONB DEFAULT '[]',
  section TEXT,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Órdenes de Trabajo
CREATE TABLE public.work_orders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendiente',
  priority TEXT NOT NULL DEFAULT 'Media',
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  collaborators UUID[] DEFAULT '{}',
  section TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  time_spent_minutes INTEGER DEFAULT 0,
  pending_reason TEXT,
  audio_note_url TEXT,
  status_history JSONB DEFAULT '[]',
  collaborating_sections TEXT[] DEFAULT '{}',
  used_parts JSONB DEFAULT '[]',
  related_plan_id UUID REFERENCES public.preventive_plans(id) ON DELETE SET NULL,
  related_incident_id UUID
);

-- Comentarios
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id TEXT REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  text TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  status TEXT,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adjuntos
CREATE TABLE public.attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id TEXT NOT NULL,
  parent_type TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Subtareas
CREATE TABLE public.subtasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id TEXT REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  assigned_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- ============================================================================
-- 2. TABLAS DE MIGRACIONES
-- ============================================================================

-- Incidencias
CREATE TABLE public.incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'Media',
  status TEXT NOT NULL DEFAULT 'Abierta',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  section TEXT,
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  work_order_id TEXT REFERENCES public.work_orders(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  display_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentarios de Incidencias
CREATE TABLE public.incident_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  text TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Movimientos de Inventario
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Órdenes de Compra
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  supplier TEXT,
  status TEXT NOT NULL DEFAULT 'Solicitado',
  requested_by UUID REFERENCES public.profiles(id),
  requested_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  order_date TIMESTAMP WITH TIME ZONE,
  expected_date TIMESTAMP WITH TIME ZONE,
  received_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Items de Órdenes de Compra
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.inventory(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  equipment_id UUID REFERENCES public.equipment(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilidades (Skills)
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilidades por Usuario
CREATE TABLE public.user_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level >= 0 AND level <= 5),
  validation_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, skill_id)
);

-- Colaboradores de Órdenes de Trabajo
CREATE TABLE public.work_order_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id TEXT REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(work_order_id, user_id)
);

-- Secuencias para IDs auto-generados de Órdenes de Trabajo
CREATE TABLE public.work_order_sequences (
  year INTEGER PRIMARY KEY,
  last_val INTEGER DEFAULT 0
);

-- Secuencias para IDs auto-generados de Incidencias
CREATE TABLE public.incident_sequences (
  year INTEGER PRIMARY KEY,
  last_val INTEGER DEFAULT 0
);

-- ============================================================================
-- 3. FUNCIONES
-- ============================================================================

-- Función: Crear usuario con rol (desde la app)
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

-- Función: Merge de inventario (RPC transaccional)
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

-- Función: Generar ID auto-incremental para Órdenes de Trabajo
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
$$ LANGUAGE plpgsql;

-- Función: Generar ID auto-incremental para Incidencias
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
$$ LANGUAGE plpgsql;

-- Función: Proteger created_at en work_orders (solo Admin puede cambiarlo)
CREATE OR REPLACE FUNCTION public.check_work_order_created_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'Admin'
    ) THEN
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función: Sincronizar rol a app_metadata para JWT
CREATE OR REPLACE FUNCTION public.sync_user_role_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función RLS: Verificar si es Admin vía JWT
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'Admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función RLS: Verificar si es Staff vía JWT
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('Admin', 'Responsable Sección', 'Técnico');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

CREATE TRIGGER set_work_order_id
BEFORE INSERT ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_work_order_id();

CREATE TRIGGER set_incident_display_id
BEFORE INSERT ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.generate_incident_id();

CREATE TRIGGER enforce_work_order_created_at_role
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.check_work_order_created_at();

CREATE TRIGGER trigger_sync_user_role_to_app_metadata
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role_to_app_metadata();

-- ============================================================================
-- 5. RLS (Row Level Security)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_sequences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. POLÍTICAS RLS
-- ============================================================================

-- Profiles
CREATE POLICY "Read Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Manage Profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Sections
CREATE POLICY "Read Sections" ON public.sections FOR SELECT USING (true);
CREATE POLICY "Manage Sections" ON public.sections FOR ALL USING (public.is_admin());

-- User Permissions
CREATE POLICY "Read Permissions" ON public.user_permissions FOR SELECT USING (true);
CREATE POLICY "Manage Permissions" ON public.user_permissions FOR ALL USING (public.is_admin());

-- Equipment
CREATE POLICY "Read Equipment" ON public.equipment FOR SELECT USING (true);
CREATE POLICY "Manage Equipment" ON public.equipment FOR ALL USING (public.is_admin());

-- Inventory
CREATE POLICY "Read Inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Manage Inventory" ON public.inventory FOR ALL USING (public.is_staff());

-- Work Orders
CREATE POLICY "Read Work Orders" ON public.work_orders FOR SELECT USING (true);
CREATE POLICY "Manage Work Orders" ON public.work_orders FOR ALL USING (public.is_staff());

-- Comments
CREATE POLICY "Open Comments" ON public.comments FOR ALL USING (true);

-- Attachments
CREATE POLICY "Open Attachments" ON public.attachments FOR ALL USING (true);

-- Subtasks
CREATE POLICY "Open Subtasks" ON public.subtasks FOR ALL USING (true);

-- Preventive Plans
CREATE POLICY "Read Plans" ON public.preventive_plans FOR SELECT USING (true);
CREATE POLICY "Manage Plans" ON public.preventive_plans FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'Admin' OR role = 'Responsable Sección')
  )
);

-- Incidents (modo Demo: acceso total)
CREATE POLICY "Acceso total incidencias" ON public.incidents
  FOR ALL USING (true) WITH CHECK (true);

-- Incident Comments (modo Demo: acceso total)
CREATE POLICY "Acceso total comentarios" ON public.incident_comments
  FOR ALL USING (true) WITH CHECK (true);

-- Inventory Movements
CREATE POLICY "Read Movements" ON public.inventory_movements FOR SELECT USING (true);
CREATE POLICY "Insert Movements" ON public.inventory_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Purchase Orders
CREATE POLICY "Full Access Orders" ON public.purchase_orders FOR ALL USING (true);
CREATE POLICY "Full Access Order Items" ON public.purchase_order_items FOR ALL USING (true);

-- Skills
CREATE POLICY "Read Skills" ON public.skills FOR SELECT USING (true);
CREATE POLICY "Manage Skills" ON public.skills FOR ALL USING (public.is_admin());

-- User Skills
CREATE POLICY "Read User Skills" ON public.user_skills FOR SELECT USING (true);
CREATE POLICY "Manage User Skills" ON public.user_skills FOR ALL USING (public.is_admin());

-- Work Order Collaborators
CREATE POLICY "Read Collaborators" ON public.work_order_collaborators FOR SELECT USING (true);
CREATE POLICY "Insert Collaborators" ON public.work_order_collaborators FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Update Collaborators" ON public.work_order_collaborators FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete Collaborators" ON public.work_order_collaborators FOR DELETE USING (auth.role() = 'authenticated');

-- Sequences
CREATE POLICY "Read WO Sequences" ON public.work_order_sequences FOR SELECT USING (true);
CREATE POLICY "Update WO Sequences" ON public.work_order_sequences FOR ALL USING (public.is_staff());
CREATE POLICY "Read Incident Sequences" ON public.incident_sequences FOR SELECT USING (true);
CREATE POLICY "Update Incident Sequences" ON public.incident_sequences FOR ALL USING (public.is_staff());

-- ============================================================================
-- 7. REPLICA IDENTITY (para Realtime completo)
-- ============================================================================

ALTER TABLE public.equipment REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;
ALTER TABLE public.user_permissions REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_orders REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_order_items REPLICA IDENTITY FULL;
ALTER TABLE public.work_orders REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.preventive_plans REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.incident_comments REPLICA IDENTITY FULL;

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- 9. STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-photos', 'equipment-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-files', 'work-order-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-files', 'incident-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies: Equipment Photos
DROP POLICY IF EXISTS "Public Access Equipment Photos" ON storage.objects;
CREATE POLICY "Public Access Equipment Photos"
ON storage.objects FOR SELECT USING (bucket_id = 'equipment-photos');

DROP POLICY IF EXISTS "Upload Equipment Photos" ON storage.objects;
CREATE POLICY "Upload Equipment Photos"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'equipment-photos');

DROP POLICY IF EXISTS "Delete Equipment Photos" ON storage.objects;
CREATE POLICY "Delete Equipment Photos"
ON storage.objects FOR DELETE USING (bucket_id = 'equipment-photos');

-- Storage Policies: Work Order Files
DROP POLICY IF EXISTS "Public Access WO Files" ON storage.objects;
CREATE POLICY "Public Access WO Files"
ON storage.objects FOR SELECT USING (bucket_id = 'work-order-files');

DROP POLICY IF EXISTS "Upload WO Files" ON storage.objects;
CREATE POLICY "Upload WO Files"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'work-order-files');

DROP POLICY IF EXISTS "Delete WO Files" ON storage.objects;
CREATE POLICY "Delete WO Files"
ON storage.objects FOR DELETE USING (bucket_id = 'work-order-files');

-- Storage Policies: Incident Files
CREATE POLICY "Public Access Incident Files"
ON storage.objects FOR SELECT USING (bucket_id = 'incident-files');

CREATE POLICY "Full Access Incident Files"
ON storage.objects FOR ALL USING (bucket_id = 'incident-files')
WITH CHECK (bucket_id = 'incident-files');

-- ============================================================================
-- 10. REALTIME PUBLICATION
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE sections;
ALTER PUBLICATION supabase_realtime ADD TABLE user_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE subtasks;
ALTER PUBLICATION supabase_realtime ADD TABLE preventive_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE skills;
ALTER PUBLICATION supabase_realtime ADD TABLE user_skills;
ALTER PUBLICATION supabase_realtime ADD TABLE work_order_collaborators;

-- ============================================================================
-- 12. SEED HFS (Healthy Food Solutions)
-- ============================================================================

INSERT INTO public.sections (name, is_special)
VALUES
  ('Producción 1', false), ('Producción 2', false), ('Producción 3', false),
  ('Mecanizado', false), ('Tratamiento Térmico', false), ('Pintura y Acabado', false),
  ('Calidad', false), ('Almacén y Logística', false), ('Servicios Auxiliares', false),
  ('Calefacción / Aire Acondicionado', true), ('Fontanería', true), ('Electricista', true),
  ('Pintura / Albañilería', true), ('Jardinería', true);

-- Único usuario inicial: Administrador
INSERT INTO public.profiles (id, name, email, role, sections, active)
VALUES
  ('b1a00000-0000-4000-8000-000000000001', 'Aitor Blanco', 'aitor.blanco@healthy-foodsolutions.com', 'Admin', '{}', true);

-- ============================================================================
-- 13. RPC: registro atómico de movimientos de inventario
-- (incluido desde database/migration_register_movement_rpc.sql; requerido por
-- services/inventoryService.ts — sin él fallan las entradas/salidas de stock)
-- ============================================================================

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

-- ============================================================================
-- NOTA: las funciones is_admin() / is_staff() ya están definidas en la sección 3
-- y leen el rol del JWT. En el pasado había aquí un bloque "MODO APP SIN SESIÓN
-- SUPABASE AUTH" que las sobreescribía con RETURN true (modo demo: cualquiera era
-- Admin). Se ha eliminado por ser un pie forzado de seguridad.
-- ============================================================================
