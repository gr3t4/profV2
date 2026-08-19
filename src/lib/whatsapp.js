// Abre WhatsApp Web/App con un mensaje prellenado avisando al tutor de un alumno.
export function sendWhatsApp({ student, date, sessionName, status, reason }) {
  const phone = student.tutor_phone?.replace(/\D/g, "");
  if (!phone) return false;

  const fullPhone = phone.length === 10 ? "52" + phone : phone;
  const tutorName = student.tutor_name ? `, ${student.tutor_name}` : "";
  const fmtDate = new Date(date + "T12:00:00").toLocaleDateString("es-MX", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  });

  const statusMsg = {
    absent:  "❌ *FALTA* — no asistió a clases",
    late:    "🕐 *RETARDO* — llegó tarde a clases",
    excused: `📝 *FALTA JUSTIFICADA*${reason ? ` — Motivo: ${reason}` : ""}`,
  }[status] || "ausencia registrada";

  const msg = `Estimado tutor${tutorName}:\n\nLe informamos que el alumno *${student.name}* registró ${statusMsg} el día *${fmtDate}* en la materia/grupo *${sessionName}*.\n\nPor favor comuníquese con la institución si tiene alguna duda.\n\n_CBTIS 179 — AppProf_`;

  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
  return true;
}

// Limpia el número: solo dígitos, agrega 52 si es México y no lo tiene.
export function cleanPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "52" + digits;
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  return digits;
}
