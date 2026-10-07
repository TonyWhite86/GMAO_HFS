-- Allow Section Managers (Responsable Sección) and Admins to manage Preventive Plans

-- 1. Drop existing policy if it exists (to avoid conflicts or to replace strict Admin-only policy)
DROP POLICY IF EXISTS "Manage Plans" ON public.preventive_plans;

-- 2. Create new policy allowing both Admins and Section Managers
CREATE POLICY "Manage Plans" ON public.preventive_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'Admin' OR role = 'Responsable Sección')
  )
);
