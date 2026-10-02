-- Turno (matutino / vespertino) por grupo y por usuario de Prefectura.
-- Cada Prefectura ve los grupos de su turno (y los que aún no tienen turno).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS turno text CHECK (turno IN ('matutino','vespertino'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS turno text CHECK (turno IN ('matutino','vespertino'));
UPDATE profiles SET turno = 'matutino' WHERE username = 'Matutino' AND role = 'viewer';
