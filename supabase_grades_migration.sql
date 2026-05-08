-- ══════════════════════════════════════════════════════
--  Módulo de Calificaciones — ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- Materias (vinculadas a una sesión)
create table if not exists subjects (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade not null,
  owner_id    uuid references users(id) on delete cascade not null,
  name        text not null,
  period      text,
  created_at  timestamptz default now()
);

-- Actividades / rubros con porcentaje
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid references subjects(id) on delete cascade not null,
  name        text not null,
  weight      numeric(5,2) not null check (weight > 0 and weight <= 100),
  created_at  timestamptz default now()
);

-- Calificaciones por alumno × actividad
create table if not exists grades (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid references subjects(id) on delete cascade not null,
  activity_id uuid references activities(id) on delete cascade not null,
  student_id  uuid references students(id) on delete cascade not null,
  score       numeric(5,2) not null check (score >= 0 and score <= 100),
  updated_at  timestamptz default now(),
  unique (subject_id, activity_id, student_id)
);

-- Índices para consultas rápidas
create index if not exists idx_subjects_session on subjects(session_id);
create index if not exists idx_activities_subject on activities(subject_id);
create index if not exists idx_grades_subject on grades(subject_id);
create index if not exists idx_grades_student on grades(student_id);
