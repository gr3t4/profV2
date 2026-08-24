-- ══════════════════════════════════════════════════════
--  Portal de padres (link por token) — ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. Token único e impredecible por alumno para el link de solo lectura.
--    No requiere login: quien tenga el link ve la asistencia de ESE alumno,
--    nada más (ni datos de otros alumnos, ni acceso de escritura).
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_parent_token ON students(parent_token);

-- 2. Función de solo lectura, expuesta a usuarios anónimos, que regresa
--    ÚNICAMENTE los datos del alumno dueño del token (SECURITY DEFINER le
--    permite saltarse RLS internamente, pero el filtro por token evita que
--    se pueda listar o adivinar la información de otros alumnos).
CREATE OR REPLACE FUNCTION get_parent_attendance(p_token uuid)
RETURNS TABLE (
  student_name  text,
  session_name  text,
  att_date      date,
  status        text,
  reason        text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.name, sess.name, a.date, a.status, a.reason
  FROM students s
  JOIN sessions sess ON sess.id = s.session_id
  LEFT JOIN attendance a ON a.student_id = s.id
  WHERE s.parent_token = p_token
  ORDER BY a.date DESC;
$$;

REVOKE ALL ON FUNCTION get_parent_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_parent_attendance(uuid) TO anon, authenticated;
