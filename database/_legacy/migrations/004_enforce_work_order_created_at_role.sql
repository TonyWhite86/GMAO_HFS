-- 1. Función para validar el rol en el cambio de fecha de creación
CREATE OR REPLACE FUNCTION public.check_work_order_created_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Si created_at cambia, validamos que el usuario ejecutor sea Admin
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'Admin'
    ) THEN
      -- Si no es Admin, revertimos la fecha al valor original (seguridad silenciosa)
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS enforce_work_order_created_at_role ON public.work_orders;

CREATE TRIGGER enforce_work_order_created_at_role
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_work_order_created_at();
