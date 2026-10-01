-- Grant permissions for new incident tables
GRANT ALL ON TABLE public.incidents TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.incident_comments TO anon, authenticated, service_role;

-- Ensure RLS policies are permissive for reading
-- Note: These policies were already set to 'true' in create_incidents_schema.sql,
-- but re-applying ensures they are active and correctly configured.

DROP POLICY IF EXISTS "Incidencias visibles para interesados" ON public.incidents;
CREATE POLICY "Incidencias visibles para interesados" ON public.incidents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestionar incidencias" ON public.incidents;
CREATE POLICY "Gestionar incidencias" ON public.incidents
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualizar incidencias" ON public.incidents
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Comentarios visibles para interesados" ON public.incident_comments;
CREATE POLICY "Comentarios visibles para interesados" ON public.incident_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insertar comentarios incidencias" ON public.incident_comments;
CREATE POLICY "Insertar comentarios incidencias" ON public.incident_comments
  FOR INSERT WITH CHECK (true);

-- Also ensure attachments table is accessible (often missed)
GRANT ALL ON TABLE public.attachments TO anon, authenticated, service_role;
