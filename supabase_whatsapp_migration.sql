-- Agrega teléfono del tutor a la tabla students
alter table students add column if not exists tutor_name text;
alter table students add column if not exists tutor_phone text;
