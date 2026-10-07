-- ══════════════════════════════════════════════════════════════════
--  Grupos escolares con lista de alumnos compartida (2026-10-07)
--  Antes: cada sesión (clase de un docente) tenía su propia copia de alumnos.
--  Ahora: el grupo (p. ej. "304") tiene UNA lista; cada clase (materia +
--  docente + horario) pertenece a un grupo y la asistencia es por clase.
--
--  FASE 1 — solo agrega (no rompe la versión anterior de la app).
-- ══════════════════════════════════════════════════════════════════

-- 0. Respaldo de seguridad antes de migrar (bloqueado para la app)
CREATE TABLE IF NOT EXISTS sessions_backup_20261007   AS TABLE sessions;
CREATE TABLE IF NOT EXISTS students_backup_20261007   AS TABLE students;
CREATE TABLE IF NOT EXISTS attendance_backup_20261007 AS TABLE attendance;
ALTER TABLE sessions_backup_20261007   ENABLE ROW LEVEL SECURITY;
ALTER TABLE students_backup_20261007   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_backup_20261007 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sessions_backup_20261007, students_backup_20261007, attendance_backup_20261007 FROM anon, authenticated;

-- 1. Grupos
CREATE TABLE IF NOT EXISTS grupos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  turno      text CHECK (turno IN ('matutino','vespertino')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS grupos_name_key ON grupos (lower(trim(name)));

-- 2. Clase = sesión con grupo, materia y horario
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES grupos(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS materia  text;
-- horario: [{"dia":1,"inicio":"07:00","fin":"08:40"}, ...]  (dia: 1=lunes … 6=sábado)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS horario  jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Alumnos pertenecen al grupo; las bajas no borran historial
ALTER TABLE students ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES grupos(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS active   boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_students_grupo   ON students(grupo_id);
CREATE INDEX IF NOT EXISTS idx_sessions_grupo   ON sessions(grupo_id);

-- 4. Migrar datos actuales: un grupo por cada sesión existente (nombre = primera palabra)
INSERT INTO grupos (name, turno, created_by)
SELECT DISTINCT ON (lower(split_part(trim(s.name),' ',1)))
       split_part(trim(s.name),' ',1), s.turno, s.owner_id
FROM sessions s
WHERE s.grupo_id IS NULL
ORDER BY lower(split_part(trim(s.name),' ',1)), s.created_at
ON CONFLICT DO NOTHING;

UPDATE sessions s SET
  grupo_id = g.id,
  materia  = COALESCE(s.materia, NULLIF(trim(substr(trim(s.name), length(split_part(trim(s.name),' ',1)) + 1)), ''))
FROM grupos g
WHERE s.grupo_id IS NULL AND lower(trim(g.name)) = lower(split_part(trim(s.name),' ',1));

UPDATE students st SET grupo_id = s.grupo_id
FROM sessions s
WHERE st.grupo_id IS NULL AND st.session_id = s.id;

-- 5. Asistencia por clase: un registro por alumno, clase y día
CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_student_date_key ON attendance (session_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- 6. Seguridad (RLS)
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;

-- ¿El usuario actual da alguna clase en este grupo o lo creó?
CREATE OR REPLACE FUNCTION my_grupo(p_grupo uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM grupos g WHERE g.id = p_grupo AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM sessions s WHERE s.grupo_id = p_grupo AND s.owner_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION my_grupo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_grupo(uuid) TO authenticated;

DROP POLICY IF EXISTS grupos_select ON grupos;
DROP POLICY IF EXISTS grupos_insert ON grupos;
DROP POLICY IF EXISTS grupos_update ON grupos;
DROP POLICY IF EXISTS grupos_delete ON grupos;
-- Cualquier usuario con sesión puede ver los nombres de los grupos (para elegirlos al crear una clase)
CREATE POLICY grupos_select ON grupos FOR SELECT TO authenticated USING (true);
CREATE POLICY grupos_insert ON grupos FOR INSERT TO authenticated
  WITH CHECK ((select my_role()) IN ('teacher','admin') AND created_by = (select auth.uid()));
CREATE POLICY grupos_update ON grupos FOR UPDATE TO authenticated
  USING ((select is_admin()) OR ((select my_role()) = 'teacher' AND my_grupo(id)))
  WITH CHECK ((select is_admin()) OR ((select my_role()) = 'teacher' AND my_grupo(id)));
CREATE POLICY grupos_delete ON grupos FOR DELETE TO authenticated USING ((select is_admin()));

-- Alumnos: los ve y edita cualquier docente con una clase en el grupo; Prefectura/admin los ven todos
DROP POLICY IF EXISTS students_grupo_select ON students;
DROP POLICY IF EXISTS students_grupo_insert ON students;
DROP POLICY IF EXISTS students_grupo_update ON students;
CREATE POLICY students_grupo_select ON students FOR SELECT TO authenticated
  USING ((select can_view_all()) OR (grupo_id IS NOT NULL AND my_grupo(grupo_id)));
CREATE POLICY students_grupo_insert ON students FOR INSERT TO authenticated
  WITH CHECK ((select my_role()) IN ('teacher','admin') AND grupo_id IS NOT NULL AND ((select is_admin()) OR my_grupo(grupo_id)));
CREATE POLICY students_grupo_update ON students FOR UPDATE TO authenticated
  USING ((select my_role()) IN ('teacher','admin') AND grupo_id IS NOT NULL AND ((select is_admin()) OR my_grupo(grupo_id)))
  WITH CHECK ((select my_role()) IN ('teacher','admin') AND grupo_id IS NOT NULL AND ((select is_admin()) OR my_grupo(grupo_id)));

-- 7. Portal de padres: ahora con la materia de cada registro
DROP FUNCTION IF EXISTS get_parent_attendance(uuid);
CREATE FUNCTION get_parent_attendance(p_token uuid)
RETURNS TABLE (student_name text, session_name text, att_date date, status text, reason text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT st.name,
         COALESCE(NULLIF(sess.materia,''), sess.name),
         a.date, a.status, a.reason
  FROM students st
  LEFT JOIN attendance a ON a.student_id = st.id
  LEFT JOIN sessions sess ON sess.id = a.session_id
  WHERE st.parent_token = p_token
  ORDER BY a.date DESC NULLS LAST, sess.name;
$$;
REVOKE ALL ON FUNCTION get_parent_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_parent_attendance(uuid) TO anon, authenticated;
