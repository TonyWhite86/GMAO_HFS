-- 1. Hacer que la columna section sea nullable
ALTER TABLE public.incidents ALTER COLUMN section DROP NOT NULL;

-- 2. (Opcional) Si quisiéramos una política RLS específica para "Sin Sección", sería algo así:
-- Pero como la política actual es "Incidencias visibles para interesados" FOR ALL USING (true),
-- el filtrado real se hará en el frontend o se puede refinar aquí.

-- Para mayor seguridad, podríamos restringir la visibilidad a nivel de BD, 
-- pero dado que ya tenemos lógica de filtrado en el frontend y la política actual es permisiva,
-- este cambio de esquema es lo principal.
