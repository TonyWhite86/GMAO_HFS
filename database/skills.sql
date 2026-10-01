-- Create Skills table
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- e.g., 'Electricidad', 'Mecánica', 'Gestión'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create User Skills table (Matrix)
CREATE TABLE IF NOT EXISTS public.user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 0 AND level <= 5), -- 0 to 5 scale
    validation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, skill_id) -- Ensure one entry per user per skill
);

-- Enable RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

-- Policies for Skills
-- Everyone can read skills
DROP POLICY IF EXISTS "Enable read access for all users" ON public.skills;
CREATE POLICY "Enable read access for all users" ON public.skills
    FOR SELECT USING (true);

-- Only Admins and Section Managers can insert/update/delete skills
DROP POLICY IF EXISTS "Manage Skills" ON public.skills;
CREATE POLICY "Manage Skills" ON public.skills
    FOR ALL USING (public.is_admin());

-- Policies for User Skills
-- Everyone can read matrix (transparency)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_skills;
CREATE POLICY "Enable read access for all users" ON public.user_skills
    FOR SELECT USING (true);

-- Only Admins and Section Managers can assign/update skills
DROP POLICY IF EXISTS "Manage User Skills" ON public.user_skills;
CREATE POLICY "Manage User Skills" ON public.user_skills
    FOR ALL USING (public.is_admin());

-- Realtime subscriptions
-- Realtime subscriptions (Safe execution)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'skills') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.skills;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_skills') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_skills;
    END IF;
END $$;
