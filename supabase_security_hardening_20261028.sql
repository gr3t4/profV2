-- ══════════════════════════════════════════════════════════════════
--  Endurecimiento de seguridad (2026-10-28) — ya aplicado en Supabase
-- ══════════════════════════════════════════════════════════════════
-- Funciones de rol: solo cuentan perfiles activos
CREATE OR REPLACE FUNCTION public.my_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select role from public.profiles where id = auth.uid() and active is not false;
$$;
CREATE OR REPLACE FUNCTION public.can_view_all() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','viewer') and active is not false);
$$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active is not false);
$$;

-- Grupos: solo usuarios con perfil activo de AppProf (antes: cualquier cuenta autenticada)
DROP POLICY IF EXISTS grupos_select ON public.grupos;
CREATE POLICY grupos_select ON public.grupos FOR SELECT TO authenticated USING ((select public.my_role()) is not null);

-- Quitar permisos innecesarios al rol anónimo (la llave pública)
REVOKE ALL ON public.activities, public.activity_marks, public.grupos FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_role(), public.can_view_all(), public.is_admin(), public.my_grupo(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_role(), public.can_view_all(), public.is_admin(), public.my_grupo(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_name(text), public.accept_privacy() FROM anon, PUBLIC;

-- Tablas de respaldo: sin acceso por la API
REVOKE ALL ON public.attendance_backup_20260818, public.attendance_backup_20261007, public.sessions_backup_20260818, public.sessions_backup_20261007,
  public.students_backup_20260818, public.students_backup_20261007, public.users_backup_20260818 FROM anon, authenticated;

-- search_path fijo
ALTER FUNCTION public.update_updated_at() SET search_path = public;
