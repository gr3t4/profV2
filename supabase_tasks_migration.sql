-- ══════════════════════════════════════════════════════
--  Módulo de Tareas — ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- Tareas definidas por el docente
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade not null,
  owner_id    uuid references users(id) on delete cascade not null,
  title       text not null,
  description text,
  due_date    date,
  max_score   numeric(5,2) default 100,
  created_at  timestamptz default now()
);

-- Entrega por alumno
create table if not exists task_submissions (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references tasks(id) on delete cascade not null,
  student_id  uuid references students(id) on delete cascade not null,
  status      text not null default 'pending' check (status in ('pending','on_time','late','missing')),
  score       numeric(5,2),
  notes       text,
  updated_at  timestamptz default now(),
  unique (task_id, student_id)
);

create index if not exists idx_tasks_session    on tasks(session_id);
create index if not exists idx_submissions_task on task_submissions(task_id);
create index if not exists idx_submissions_student on task_submissions(student_id);
