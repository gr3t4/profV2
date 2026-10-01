-- Contacto de Tutorías por grupo/sesión, para enviar el reporte de faltas por WhatsApp.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutoria_name  text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutoria_phone text;
