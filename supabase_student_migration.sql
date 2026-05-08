-- ══════════════════════════════════════════════════════
--  Módulo de Alumnos — ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. Agregar rol 'student' al check de users (si existe constraint)
--    Si no existe constraint, este paso no es necesario.
--    Ejecuta solo si tienes un check constraint en role:
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check
--   CHECK (role IN ('admin','teacher','viewer','student'));

-- 2. Vincular un usuario (role='student') con un registro de students
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL;

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);

-- Vincular tareas con materias (opcional)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_subject ON tasks(subject_id);

-- Horas por clase (una fila por sesión+fecha)
CREATE TABLE IF NOT EXISTS class_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  date        date NOT NULL,
  hours       numeric(4,1) NOT NULL DEFAULT 1,
  UNIQUE (session_id, date)
);
CREATE INDEX IF NOT EXISTS idx_class_hours_session ON class_hours(session_id);
