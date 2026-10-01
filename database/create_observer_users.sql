-- Migration: Create Observer Users for Demo
-- Note: These are inserted into the profiles table. 
-- In a real environment, these would also need to be created in auth.users.

-- Insertamos Observador N1 si no existe
INSERT INTO public.profiles (id, name, email, role, sections, active)
SELECT gen_random_uuid(), 'Observador Nivel 1', 'observador1@maintpro.com', 'Observador N1', '{}', true
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'observador1@maintpro.com');

-- Insertamos Observador N2 si no existe
INSERT INTO public.profiles (id, name, email, role, sections, active)
SELECT gen_random_uuid(), 'Observador Nivel 2', 'observador2@maintpro.com', 'Observador N2', '{}', true
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'observador2@maintpro.com');
