-- ══════════════════════════════════════════════════════════════════
--  Módulo de Actividades (2026-10-19)
--  Cada clase puede registrar productos/actividades y marcar qué alumnos
--  los entregaron (a tiempo, tarde o no entregaron).
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  due_date    date,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activities_session ON activities(session_id);

CREATE TABLE IF NOT EXISTS activity_marks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('delivered','late','missing')),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (activity_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_marks_activity ON activity_marks(activity_id);

ALTER TABLE activities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_marks ENABLE ROW LEVEL SECURITY;

-- Actividades: el docente dueño de la clase las administra; Prefectura/admin las ven
CREATE POLICY activities_select ON activities FOR SELECT TO authenticated
  USING ((select can_view_all()) OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = activities.session_id AND s.owner_id = (select auth.uid())));
CREATE POLICY activities_insert ON activities FOR INSERT TO authenticated
  WITH CHECK ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = activities.session_id AND s.owner_id = (select auth.uid())));
CREATE POLICY activities_update ON activities FOR UPDATE TO authenticated
  USING ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = activities.session_id AND s.owner_id = (select auth.uid())))
  WITH CHECK ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = activities.session_id AND s.owner_id = (select auth.uid())));
CREATE POLICY activities_delete ON activities FOR DELETE TO authenticated
  USING ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = activities.session_id AND s.owner_id = (select auth.uid())));

-- Entregas: mismas reglas, a través de la actividad
CREATE POLICY activity_marks_select ON activity_marks FOR SELECT TO authenticated
  USING ((select can_view_all()) OR EXISTS (SELECT 1 FROM activities a JOIN sessions s ON s.id = a.session_id WHERE a.id = activity_marks.activity_id AND s.owner_id = (select auth.uid())));
CREATE POLICY activity_marks_insert ON activity_marks FOR INSERT TO authenticated
  WITH CHECK ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM activities a JOIN sessions s ON s.id = a.session_id WHERE a.id = activity_marks.activity_id AND s.owner_id = (select auth.uid())));
CREATE POLICY activity_marks_update ON activity_marks FOR UPDATE TO authenticated
  USING ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM activities a JOIN sessions s ON s.id = a.session_id WHERE a.id = activity_marks.activity_id AND s.owner_id = (select auth.uid())))
  WITH CHECK ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM activities a JOIN sessions s ON s.id = a.session_id WHERE a.id = activity_marks.activity_id AND s.owner_id = (select auth.uid())));
CREATE POLICY activity_marks_delete ON activity_marks FOR DELETE TO authenticated
  USING ((select my_role()) = 'teacher' AND EXISTS (SELECT 1 FROM activities a JOIN sessions s ON s.id = a.session_id WHERE a.id = activity_marks.activity_id AND s.owner_id = (select auth.uid())));

-- ══════════════════════════════════════════════════════════════════
--  Mi cuenta: el usuario cambia su propio nombre (2026-10-19)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_my_name(p_name text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text := trim(coalesce(p_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sin sesión'; END IF;
  IF length(n) < 3 OR length(n) > 80 THEN RAISE EXCEPTION 'El nombre debe tener entre 3 y 80 caracteres'; END IF;
  UPDATE profiles SET name = n WHERE id = auth.uid();
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION update_my_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_my_name(text) TO authenticated;
