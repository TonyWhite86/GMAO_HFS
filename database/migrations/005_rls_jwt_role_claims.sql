-- 1. Función para sincronizar el rol a la tabla interna de autenticación (app_metadata)
CREATE OR REPLACE FUNCTION public.sync_user_role_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear trigger en la tabla profiles
DROP TRIGGER IF EXISTS trigger_sync_user_role_to_app_metadata ON public.profiles;

CREATE TRIGGER trigger_sync_user_role_to_app_metadata
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_to_app_metadata();

-- 3. Sincronizar perfiles existentes de inmediato (Backfill)
UPDATE auth.users u
SET raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE u.id = p.id;

-- 4. Actualizar funciones RLS para leer desde JWT
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'Admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('Admin', 'Responsable Sección', 'Técnico');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
