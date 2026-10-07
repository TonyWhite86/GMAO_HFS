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
