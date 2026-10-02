-- ══════════════════════════════════════════════════════
--  Seguridad + rendimiento de RLS (2026-10-02)
-- ══════════════════════════════════════════════════════

-- 1. Quitar reglas que permitían a CUALQUIERA (incluso sin sesión) leer,
--    modificar o borrar grupos, alumnos y asistencia.
DROP POLICY IF EXISTS allow_all_sessions   ON sessions;
DROP POLICY IF EXISTS allow_all_students   ON students;
DROP POLICY IF EXISTS allow_all_attendance ON attendance;

-- 2. Reescribir las reglas por docente usando (select auth.uid()) para que se
--    evalúe una sola vez por consulta y no una vez por fila.
--    Las reglas de escritura se separan por operación para no duplicar el SELECT.

-- profiles
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING ((select can_view_all()) OR id = (select auth.uid()));

-- sessions
DROP POLICY IF EXISTS sessions_select ON sessions;
DROP POLICY IF EXISTS sessions_insert ON sessions;
DROP POLICY IF EXISTS sessions_update ON sessions;
DROP POLICY IF EXISTS sessions_delete ON sessions;
CREATE POLICY sessions_select ON sessions FOR SELECT TO authenticated
  USING ((select can_view_all()) OR owner_id = (select auth.uid()));
CREATE POLICY sessions_insert ON sessions FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()) AND (select my_role()) = 'teacher');
CREATE POLICY sessions_update ON sessions FOR UPDATE TO authenticated
  USING ((select is_admin()) OR (owner_id = (select auth.uid()) AND (select my_role()) = 'teacher'))
  WITH CHECK ((select is_admin()) OR (owner_id = (select auth.uid()) AND (select my_role()) = 'teacher'));
CREATE POLICY sessions_delete ON sessions FOR DELETE TO authenticated
  USING ((select is_admin()) OR (owner_id = (select auth.uid()) AND (select my_role()) = 'teacher'));

-- Tablas hijas de sessions (students, attendance, class_hours): mismo patrón.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['students','attendance','class_hours'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_select ON %1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_write  ON %1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_insert ON %1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_update ON %1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_delete ON %1$s', t);

    EXECUTE format($p$CREATE POLICY %1$s_select ON %1$s FOR SELECT TO authenticated
      USING ((select can_view_all()) OR EXISTS (SELECT 1 FROM sessions s
             WHERE s.id = %1$s.session_id AND s.owner_id = (select auth.uid())))$p$, t);

    EXECUTE format($p$CREATE POLICY %1$s_insert ON %1$s FOR INSERT TO authenticated
      WITH CHECK ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s
             WHERE s.id = %1$s.session_id AND s.owner_id = (select auth.uid())))$p$, t);

    EXECUTE format($p$CREATE POLICY %1$s_update ON %1$s FOR UPDATE TO authenticated
      USING ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s
             WHERE s.id = %1$s.session_id AND s.owner_id = (select auth.uid())))
      WITH CHECK ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s
             WHERE s.id = %1$s.session_id AND s.owner_id = (select auth.uid())))$p$, t);

    EXECUTE format($p$CREATE POLICY %1$s_delete ON %1$s FOR DELETE TO authenticated
      USING ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s
             WHERE s.id = %1$s.session_id AND s.owner_id = (select auth.uid())))$p$, t);
  END LOOP;
END $$;

-- 3. Respaldos del 2026-08-18: estaban expuestos sin RLS (incluido users_backup
--    con contraseñas). Se bloquean por completo; los datos se conservan.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users_backup_20260818','sessions_backup_20260818',
                           'students_backup_20260818','attendance_backup_20260818'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
