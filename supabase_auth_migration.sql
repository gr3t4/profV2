-- ══════════════════════════════════════════════════════════════
--  Migración a Supabase Auth — ejecutar en SQL Editor
--  Esto vincula auth.users con tu tabla users existente
-- ══════════════════════════════════════════════════════════════

-- 1. Agrega columna auth_id a users para vincular con auth.users
alter table users add column if not exists auth_id uuid unique references auth.users(id) on delete cascade;

-- 2. Función que crea automáticamente un registro en users
--    cuando alguien se registra con Supabase Auth (email o Google)
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
declare
  existing_id uuid;
begin
  -- Si ya existe un usuario con ese email, solo vincula el auth_id
  select id into existing_id from public.users where username = new.email;
  if existing_id is not null then
    update public.users set auth_id = new.id where id = existing_id;
  else
    -- Crea nuevo usuario con rol teacher por defecto
    insert into public.users (auth_id, username, name, role, active, password)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
      'teacher',
      true,
      ''
    );
  end if;
  return new;
end;
$$;

-- 3. Trigger que ejecuta la función al crear usuario en auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- 4. Habilitar envío de emails en Supabase Auth
--    (Authentication → Email Templates → ya viene configurado)
