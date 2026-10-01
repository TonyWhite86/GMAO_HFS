-- 1. Tabla para controlar la secuencia por año de incidencias
CREATE TABLE IF NOT EXISTS public.incident_sequences (
    year INTEGER PRIMARY KEY,
    last_val INTEGER DEFAULT 0
);

-- Habilitar RLS
ALTER TABLE public.incident_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read Sequences" ON public.incident_sequences;
CREATE POLICY "Read Sequences" ON public.incident_sequences FOR SELECT USING (true);

DROP POLICY IF EXISTS "Update Sequences" ON public.incident_sequences;
CREATE POLICY "Update Sequences" ON public.incident_sequences FOR ALL USING (public.is_staff());

-- 2. Añadir columna display_id a incidents
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS display_id TEXT UNIQUE;

-- 3. Función para generar el ID con reinicio anual
CREATE OR REPLACE FUNCTION generate_incident_id()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
    next_val INTEGER;
BEGIN
    -- Solo generar si display_id no viene pre-definido o está vacío
    IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
        
        -- Obtener año actual
        current_year := date_part('year', now())::INTEGER;

        -- Insertar el año si no existe, con valor inicial 0
        INSERT INTO public.incident_sequences (year, last_val)
        VALUES (current_year, 0)
        ON CONFLICT (year) DO NOTHING;

        -- Incrementar el contador para el año actual y obtener el valor
        UPDATE public.incident_sequences
        SET last_val = last_val + 1
        WHERE year = current_year
        RETURNING last_val INTO next_val;

        -- Formatear: INC-YYYY-XXXXXX (ej: INC-2025-000001)
        NEW.display_id := 'INC-' || current_year::TEXT || '-' || lpad(next_val::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear Trigger
DROP TRIGGER IF EXISTS set_incident_display_id ON public.incidents;

CREATE TRIGGER set_incident_display_id
BEFORE INSERT ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION generate_incident_id();

-- 5. Backfill para incidencias existentes (si las hay)
DO $$
DECLARE
    r RECORD;
    current_year INTEGER;
    next_val INTEGER;
BEGIN
    current_year := date_part('year', now())::INTEGER;
    
    FOR r IN SELECT id FROM public.incidents WHERE display_id IS NULL ORDER BY created_at ASC LOOP
        INSERT INTO public.incident_sequences (year, last_val)
        VALUES (current_year, 0)
        ON CONFLICT (year) DO NOTHING;

        UPDATE public.incident_sequences
        SET last_val = last_val + 1
        WHERE year = current_year
        RETURNING last_val INTO next_val;

        UPDATE public.incidents 
        SET display_id = 'INC-' || current_year::TEXT || '-' || lpad(next_val::TEXT, 6, '0')
        WHERE id = r.id;
    END LOOP;
END $$;
