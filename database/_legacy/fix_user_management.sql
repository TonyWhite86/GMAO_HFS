-- Función para crear usuarios desde la aplicación (Admin)
-- Esta función crea el usuario en Auth y su perfil correspondiente
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  new_email TEXT,
  new_password TEXT,
  new_role TEXT,
  new_name TEXT,
  new_sections TEXT[]
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- 1. Crear el usuario en la tabla de auth
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    new_email,
    crypt(new_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', new_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- 2. Insertar en profiles (si no hay trigger automático)
  -- Nota: Normalmente hay un trigger, pero forzamos o actualizamos para asegurar datos
  INSERT INTO public.profiles (id, name, email, role, sections, active)
  VALUES (new_user_id, new_name, new_email, new_role, new_sections, true)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    sections = EXCLUDED.sections,
    name = EXCLUDED.name;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
