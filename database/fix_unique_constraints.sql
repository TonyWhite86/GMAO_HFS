-- Eliminar restricciones UNIQUE que puedan estar causando conflictos (Error 409)
-- Es posible que existan restricciones "ocultas" o creadas por la UI de Supabase que impidan la actualización.

-- 1. Eliminar posible restricción unique en incidents.work_order_id
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_work_order_id_key;
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS unique_work_order_id; 

-- 2. Eliminar posible restricción unique en work_orders.related_incident_id
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_related_incident_id_key;
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS unique_related_incident_id;

-- 3. Asegurar que no hay restricciones raras en display_id (aparte de la UNIQUE correcta)
-- (No tocamos display_id_key porque esa SÍ la queremos, pero verificamos que no haya otras duplicadas)
