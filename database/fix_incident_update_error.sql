-- Asegurar permisos de ACTUALIZACIÓN en incidencias para todos los usuarios autenticados
-- Esto soluciona que el Responsable de Sección pueda cambiar el estado a 'CONVERTED'

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- 1. Eliminar políticas antiguas que puedan estar bloqueando
DROP POLICY IF EXISTS "Actualizar incidencias" ON public.incidents;
DROP POLICY IF EXISTS "Incidencias visibles para interesados" ON public.incidents;
DROP POLICY IF EXISTS "Gestionar incidencias" ON public.incidents;

-- 2. Crear políticas permisivas para lectura y escritura (para evitar errores 403)
CREATE POLICY "Permitir todo a autenticados" ON public.incidents
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 3. Asegurar que comentarios también funcionen
DROP POLICY IF EXISTS "Permitir todo a autenticados comentarios" ON public.incident_comments;
CREATE POLICY "Permitir todo a autenticados comentarios" ON public.incident_comments
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
