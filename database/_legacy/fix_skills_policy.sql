-- Drop strict policies if they exist (handling potentially different names just in case, but targeting the ones we created)
DROP POLICY IF EXISTS "Enable write access for Admins and Managers" ON public.skills;
DROP POLICY IF EXISTS "Enable write access for Admins and Managers" ON public.user_skills;

-- Create loose policies consistent with the rest of the app (using is_admin() which returns true in demo)
CREATE POLICY "Manage Skills" ON public.skills
    FOR ALL USING (public.is_admin());

CREATE POLICY "Manage User Skills" ON public.user_skills
    FOR ALL USING (public.is_admin());
