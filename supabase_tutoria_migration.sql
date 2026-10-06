-- Contacto de Tutorías por grupo/sesión, para enviar el reporte de faltas por WhatsApp.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutoria_name  text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutoria_phone text;

-- Destino del reporte a Tutorías: un número o un grupo de WhatsApp (se elige al enviar).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutoria_dest text NOT NULL DEFAULT 'grupo' CHECK (tutoria_dest IN ('numero','grupo'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutoria_group text;
