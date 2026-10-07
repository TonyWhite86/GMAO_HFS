-- Create a specific table for collaborators to track status
CREATE TABLE IF NOT EXISTS public.work_order_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    work_order_id TEXT REFERENCES public.work_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(work_order_id, user_id)
);

-- Enable RLS
ALTER TABLE public.work_order_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read collaborators
CREATE POLICY "Everyone can read collaborators" ON public.work_order_collaborators
    FOR SELECT USING (true);

-- Authenticated users can insert (adding collaborators)
CREATE POLICY "Users can add collaborators" ON public.work_order_collaborators
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Collaborators can update their own status (Accept/Reject)
CREATE POLICY "Collaborators can update own status" ON public.work_order_collaborators
    FOR UPDATE USING (auth.uid() = user_id);

-- Creators or Admins can remove collaborators (DELETE) - Simplified for now
CREATE POLICY "Users can remove collaborators" ON public.work_order_collaborators
    FOR DELETE USING (auth.role() = 'authenticated');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_collaborators;

-- Migration: Move existing array collaborators to the new table
-- This assumes 'ACCEPTED' for existing ones to ignore the new flow for legacy data
INSERT INTO public.work_order_collaborators (work_order_id, user_id, status)
SELECT 
    wo.id,
    collab_id::uuid,
    'ACCEPTED'
FROM 
    public.work_orders wo,
    unnest(wo.collaborators) as collab_id
ON CONFLICT (work_order_id, user_id) DO NOTHING;
