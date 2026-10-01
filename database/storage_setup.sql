
-- ==========================================
-- 6. Storage (Almacenamiento de Imágenes)
-- ==========================================

-- NOTA: La creación de buckets suele hacerse desde el Dashboard de Supabase, 
-- pero podemos intentarlo vía SQL insertando en la tabla `storage.buckets` si tenemos permisos.
-- Si esto falla, EL USUARIO DEBE CREAR EL BUCKET 'equipment-photos' MANUALMENTE EN EL DASHBOARD (Público).

INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-photos', 'equipment-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage (Requiere que existan las tablas de storage)
-- Permitir acceso público de lectura
DROP POLICY IF EXISTS "Public Access Equipment Photos" ON storage.objects;
CREATE POLICY "Public Access Equipment Photos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'equipment-photos' );

-- Permitir subir fotos a TODOS (incluido anon para modo Demo)
DROP POLICY IF EXISTS "Upload Equipment Photos" ON storage.objects;
CREATE POLICY "Upload Equipment Photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'equipment-photos' 
);

-- Permitir eliminar fotos a TODOS (incluido anon para modo Demo)
DROP POLICY IF EXISTS "Delete Equipment Photos" ON storage.objects;
CREATE POLICY "Delete Equipment Photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'equipment-photos'
);

-- 7. Bucket work-order-files (Anexos de Órdenes de Trabajo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-files', 'work-order-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access WO Files" ON storage.objects;
CREATE POLICY "Public Access WO Files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'work-order-files' );

DROP POLICY IF EXISTS "Upload WO Files" ON storage.objects;
CREATE POLICY "Upload WO Files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'work-order-files' 
);

DROP POLICY IF EXISTS "Delete WO Files" ON storage.objects;
CREATE POLICY "Delete WO Files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'work-order-files'
);
