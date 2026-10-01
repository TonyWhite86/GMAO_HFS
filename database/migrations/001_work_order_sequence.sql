-- 1. Tabla para controlar la secuencia por año
CREATE TABLE IF NOT EXISTS public.work_order_sequences (
    year INTEGER PRIMARY KEY,
    last_val INTEGER DEFAULT 0
);

-- Habilitar RLS (aunque solo se usará internamente, buena práctica)
ALTER TABLE public.work_order_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read Sequences" ON public.work_order_sequences FOR SELECT USING (true);
CREATE POLICY "Update Sequences" ON public.work_order_sequences FOR ALL USING (public.is_staff());

-- 2. Función para generar el ID con reinicio anual
CREATE OR REPLACE FUNCTION generate_work_order_id()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
    next_val INTEGER;
BEGIN
    -- Solo generar si el ID no viene pre-definido o está vacío
    IF NEW.id IS NULL OR NEW.id = '' THEN
        
        -- Obtener año actual
        current_year := date_part('year', now())::INTEGER;

        -- Insertar el año si no existe (inicio de año nuevo), con valor inicial 0
        INSERT INTO public.work_order_sequences (year, last_val)
        VALUES (current_year, 0)
        ON CONFLICT (year) DO NOTHING;

        -- Incrementar el contador para el año actual y obtener el valor
        UPDATE public.work_order_sequences
        SET last_val = last_val + 1
        WHERE year = current_year
        RETURNING last_val INTO next_val;

        -- Formatear: OT-YYYY-XXXXXX (ej: OT-2025-000001)
        NEW.id := 'OT-' || current_year::TEXT || '-' || lpad(next_val::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear Trigger
DROP TRIGGER IF EXISTS set_work_order_id ON public.work_orders;

CREATE TRIGGER set_work_order_id
BEFORE INSERT ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION generate_work_order_id();
