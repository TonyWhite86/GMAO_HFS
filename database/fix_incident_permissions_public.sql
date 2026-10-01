-- Restaurar visibilidad y permisos para la "Demo Login" (acceso anonimo/público)
-- Como la app gestiona el usuario en estado local sin sesión Supabase Auth real,
-- debemos permitir el acceso público a la tabla para que funcione.

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- 1. Limpiar políticas restrictivas anteriores
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.incidents;
DROP POLICY IF EXISTS "Actualizar incidencias" ON public.incidents;
DROP POLICY IF EXISTS "Incidencias visibles para interesados" ON public.incidents;
DROP POLICY IF EXISTS "Gestionar incidencias" ON public.incidents;

-- 2. Crear política PERMISIVA TOTAL (Solución para modo Demo/Local)
-- Permite SELECT, INSERT, UPDATE, DELETE a cualquiera (anon)
CREATE POLICY "Acceso total incidencias" ON public.incidents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Lo mismo para comentarios
DROP POLICY IF EXISTS "Permitir todo a autenticados comentarios" ON public.incident_comments;
DROP POLICY IF EXISTS "Comentarios visibles para interesados" ON public.incident_comments;
DROP POLICY IF EXISTS "Insertar comentarios incidencias" ON public.incident_comments;

CREATE POLICY "Acceso total comentarios" ON public.incident_comments
    FOR ALL
    USING (true)
    WITH CHECK (true);
