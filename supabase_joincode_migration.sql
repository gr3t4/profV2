-- Agregar código de unión a sesiones
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS join_code text UNIQUE;

-- Generar códigos para sesiones existentes
UPDATE sessions SET join_code = upper(substring(replace(gen_random_uuid()::text,'-',''),1,6)) WHERE join_code IS NULL;
