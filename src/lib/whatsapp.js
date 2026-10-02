function longDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("es-MX", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  });
}

function openChat(rawPhone, msg) {
  const phone = rawPhone?.replace(/\D/g, "");
  if (!phone) return false;
  const fullPhone = phone.length === 10 ? "52" + phone : phone;
  window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  return true;
}

// MENSAJE PARA PAPÁS — aviso individual al padre/madre/tutor legal de un alumno.
export function sendWhatsApp({ student, date, sessionName, status, reason, teacherName }) {
  const saludo = student.tutor_name ? `Buen día, ${student.tutor_name}:` : "Buen día, estimado padre de familia:";
  const fmtDate = longDate(date);
  const firma = `Atentamente,\n${teacherName ? teacherName + "\n" : ""}_CBTIS 179_`;

  const cuerpo = {
    absent:  `Le informamos que su hijo(a) *${student.name}* *no asistió* a la clase de *${sessionName}* el día *${fmtDate}*.\n\nSi la inasistencia tuvo un motivo justificado, le pedimos hacer llegar el comprobante para registrarla como falta justificada.`,
    late:    `Le informamos que su hijo(a) *${student.name}* llegó *tarde* a la clase de *${sessionName}* el día *${fmtDate}*.`,
    excused: `Le informamos que la falta de su hijo(a) *${student.name}* en *${sessionName}* del día *${fmtDate}* quedó registrada como *justificada*${reason ? ` (motivo: ${reason})` : ""}.`,
  }[status] || `Le informamos que se registró una incidencia de asistencia de *${student.name}* en *${sessionName}* el día *${fmtDate}*.`;

  const msg = `${saludo}\n\n${cuerpo}\n\nQuedamos a sus órdenes para cualquier aclaración.\n\n${firma}`;
  return openChat(student.tutor_phone, msg);
}

// MENSAJE PARA TUTORÍAS — un solo reporte con todos los alumnos que faltaron en la fecha.
export function sendTutoriaReport({ phone, contactName, date, sessionName, absentStudents, totalStudents, teacherName }) {
  const saludo = contactName ? `Buen día, ${contactName}:` : "Buen día, área de Tutorías:";
  const lista = absentStudents.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
  const msg =
    `${saludo}\n\n` +
    `Le informo los alumnos que tuvieron *falta* en mi clase:\n\n` +
    `👨‍🏫 *Docente:* ${teacherName || "—"}\n` +
    `📚 *Materia / grupo:* ${sessionName}\n` +
    `📅 *Fecha:* ${longDate(date)}\n\n` +
    `❌ *Alumnos con falta (${absentStudents.length} de ${totalStudents}):*\n${lista}\n\n` +
    `Gracias por su apoyo.\n_CBTIS 179 — AppProf_`;
  return openChat(phone, msg);
}

// Envía al tutor, por WhatsApp, el link de solo lectura para ver la
// asistencia de su hijo (?padre=<token>, sin necesidad de iniciar sesión).
export function sendAttendanceLink({ student, sessionName }) {
  const phone = student.tutor_phone?.replace(/\D/g, "");
  if (!phone) return false;

  const fullPhone = phone.length === 10 ? "52" + phone : phone;
  const tutorName = student.tutor_name ? `, ${student.tutor_name}` : "";
  const link = `${window.location.origin}/?padre=${student.parent_token}`;

  const msg = `Estimado tutor${tutorName}:\n\nAquí puede consultar la asistencia de *${student.name}* en *${sessionName}* en cualquier momento:\n${link}\n\n_CBTIS 179 — AppProf_`;

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
