-- ══════════════════════════════════════════════════════════════════
--  Calificaciones, alertas de riesgo y aviso de privacidad (2026-10-22)
--  Solo agrega columnas y una función: no borra ni modifica datos.
-- ══════════════════════════════════════════════════════════════════

-- Actividades: parcial al que pertenecen y su valor (peso) en la calificación
ALTER TABLE activities ADD COLUMN IF NOT EXISTS parcial smallint NOT NULL DEFAULT 1;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS peso    numeric  NOT NULL DEFAULT 1;
DO $$ BEGIN
  ALTER TABLE activities ADD CONSTRAINT activities_parcial_chk CHECK (parcial BETWEEN 1 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE activities ADD CONSTRAINT activities_peso_chk CHECK (peso > 0 AND peso <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Entregas: calificación opcional (0 a 10)
ALTER TABLE activity_marks ADD COLUMN IF NOT EXISTS score numeric;
DO $$ BEGIN
  ALTER TABLE activity_marks ADD CONSTRAINT activity_marks_score_chk CHECK (score IS NULL OR (score >= 0 AND score <= 10));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Configuración de evaluación por clase (porcentajes, mínimos, fechas de parciales)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS eval_config jsonb;

-- Aviso de privacidad: fecha en que cada usuario lo aceptó
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION accept_privacy() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sin sesión'; END IF;
  UPDATE profiles SET privacy_accepted_at = t WHERE id = auth.uid();
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION accept_privacy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_privacy() TO authenticated;
