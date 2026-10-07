// Utilidades de horario de clase.
// Un horario es una lista de bloques: [{ dia: 1, inicio: "07:00", fin: "08:40" }, ...]
// dia: 1 = lunes … 6 = sábado (igual que ISO; domingo no se usa).

export const DIAS = [
  { n:1, corto:"Lun", largo:"Lunes" },
  { n:2, corto:"Mar", largo:"Martes" },
  { n:3, corto:"Mié", largo:"Miércoles" },
  { n:4, corto:"Jue", largo:"Jueves" },
  { n:5, corto:"Vie", largo:"Viernes" },
  { n:6, corto:"Sáb", largo:"Sábado" },
];

// Duración de una hora-clase en minutos (para calcular las horas de cada día).
export const MIN_HORA_CLASE = 50;

const toMin = (hhmm) => { const [h, m] = (hhmm || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

// Día ISO (1..7) de una fecha "YYYY-MM-DD"
export function isoDow(date) {
  const d = new Date(date + "T12:00:00").getDay();   // 0 = domingo
  return d === 0 ? 7 : d;
}

export function bloquesDelDia(horario, date) {
  const dow = isoDow(date);
  return (horario || []).filter(b => Number(b.dia) === dow && b.inicio && b.fin)
    .sort((a, b) => toMin(a.inicio) - toMin(b.inicio));
}

export function tieneClase(horario, date) { return bloquesDelDia(horario, date).length > 0; }

// Hora de inicio de la primera clase del día ("07:00") o null
export function inicioDelDia(horario, date) {
  const b = bloquesDelDia(horario, date)[0];
  return b ? b.inicio : null;
}

// Horas-clase de ese día según el horario (bloques de 50 min, redondeado a 0.5); null si no hay clase
export function horasDelDia(horario, date) {
  const min = bloquesDelDia(horario, date).reduce((a, b) => a + Math.max(0, toMin(b.fin) - toMin(b.inicio)), 0);
  if (!min) return null;
  return Math.max(0.5, Math.round((min / MIN_HORA_CLASE) * 2) / 2);
}

// ¿La clase está ocurriendo ahora? (fecha y hora "HH:MM" en hora de México)
export function enCurso(horario, date, hhmm) {
  const t = toMin(hhmm);
  return bloquesDelDia(horario, date).some(b => t >= toMin(b.inicio) - 10 && t <= toMin(b.fin));
}

// Texto corto: "Lun 7:00–8:40 · Mié 9:00–9:50"
export function resumenHorario(horario) {
  const bs = (horario || []).filter(b => b.inicio && b.fin).slice()
    .sort((a, b) => a.dia - b.dia || toMin(a.inicio) - toMin(b.inicio));
  if (!bs.length) return "";
  const fmt = (h) => h.replace(/^0/, "");
  return bs.map(b => `${DIAS.find(d => d.n === Number(b.dia))?.corto || "?"} ${fmt(b.inicio)}–${fmt(b.fin)}`).join(" · ");
}

// Hora actual en México "HH:MM"
const MX_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false });
export function horaMX() { return MX_TIME.format(new Date()); }

// Nombre visible de una clase: "304 · Programación básica"
export function nombreClase(s) {
  const g = s?.grupo?.name;
  if (g && s?.materia) return `${g} · ${s.materia}`;
  return s?.name || "";
}
