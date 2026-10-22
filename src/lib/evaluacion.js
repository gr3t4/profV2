// Cálculo de calificaciones y riesgo de reprobar de una clase.
// Todo se calcula en el dispositivo a partir de la asistencia, las actividades
// y sus entregas; la configuración vive en sessions.eval_config.

import { sb, fetchAll } from "./supabase";
import { C } from "./constants";

export const NIVEL = {
  2: { label:"Reprobando", icon:"🔴", color:C.danger },
  1: { label:"En riesgo",  icon:"🟠", color:C.warning },
  0: { label:"Bien",       icon:"🟢", color:C.success },
};

export const EVAL_DEFAULT = {
  pct_asistencia: 0,      // % de la calificación que vale la asistencia (0 = solo actividades)
  nota_tarde: 8,          // calificación de una entrega tarde sin calificación capturada
  aprobatoria: 6,         // calificación mínima para aprobar
  asistencia_min: 80,     // % mínimo de asistencia para tener derecho
  margen_riesgo: 5,       // puntos sobre el mínimo de asistencia para avisar "en riesgo"
  entregas_min: 70,       // % mínimo de actividades entregadas
  parciales: [{ inicio:"", fin:"" }, { inicio:"", fin:"" }, { inicio:"", fin:"" }],
};

export function evalConfig(session) {
  const c = { ...EVAL_DEFAULT, ...(session?.eval_config || {}) };
  c.parciales = [0, 1, 2].map(i => ({ ...EVAL_DEFAULT.parciales[i], ...(c.parciales?.[i] || {}) }));
  return c;
}

export const r1 = (n) => n === null || n === undefined ? null : Math.round(n * 10) / 10;

// Descarga todo lo necesario para evaluar la clase
export async function cargarDatosClase(sessionId) {
  const [{ data: att }, { data: acts }] = await Promise.all([
    fetchAll(() => sb.from("attendance").select("student_id,date,status").eq("session_id", sessionId).order("id")),
    sb.from("activities").select("*").eq("session_id", sessionId).order("due_date", { ascending:true, nullsFirst:false }).order("created_at"),
  ]);
  const ids = (acts || []).map(a => a.id);
  let marks = [];
  if (ids.length) {
    const { data } = await fetchAll(() => sb.from("activity_marks").select("activity_id,student_id,status,score").in("activity_id", ids).order("id"));
    marks = data || [];
  }
  return { att: att || [], acts: acts || [], marks };
}

// Puntaje (0-10) de una entrega
export function puntaje(mark, cfg) {
  if (!mark) return null;
  if (mark.score !== null && mark.score !== undefined && mark.score !== "") return Number(mark.score);
  if (mark.status === "delivered") return 10;
  if (mark.status === "late") return Number(cfg.nota_tarde);
  if (mark.status === "missing") return 0;
  return null;
}

const enRango = (d, p) => (!p.inicio || d >= p.inicio) && (!p.fin || d <= p.fin);

/**
 * Evalúa a todos los alumnos.
 * Devuelve { porAlumno: {id: {...}}, resumen: {reprobando, riesgo}, fechas, actsPorParcial }
 */
export function evaluar({ students, att, acts, marks, cfg, extraAtt = [] }) {
  // Asistencia: { student: { date: status } }
  const A = {};
  for (const r of [...att, ...extraAtt]) (A[r.student_id] ||= {})[r.date] = r.status;
  const fechas = [...new Set([...att, ...extraAtt].map(r => r.date))].sort();

  const M = {};
  for (const m of marks) (M[m.activity_id] ||= {})[m.student_id] = m;

  const actsPorParcial = [1, 2, 3].map(p => acts.filter(a => (a.parcial || 1) === p));
  const hayFechasParcial = cfg.parciales.some(p => p.inicio || p.fin);

  const porAlumno = {};
  for (const s of students) {
    const as = A[s.id] || {};
    const asistDe = (fs) => {
      let reg = 0, faltas = 0, just = 0, ret = 0;
      for (const d of fs) { const st = as[d]; if (!st) continue; reg++; if (st === "absent") faltas++; else if (st === "excused") just++; else if (st === "late") ret++; }
      return { reg, faltas, just, ret, pct: reg ? ((reg - faltas) / reg) * 100 : null };
    };
    const asistTotal = asistDe(fechas);

    const parciales = [0, 1, 2].map(i => {
      const lista = actsPorParcial[i];
      let suma = 0, pesos = 0, entregadas = 0, noEntregadas = 0, calificadas = 0;
      for (const a of lista) {
        const m = M[a.id]?.[s.id];
        const pts = puntaje(m, cfg);
        if (pts === null) continue;
        calificadas++;
        if (m.status === "missing") noEntregadas++; else entregadas++;
        suma += pts * Number(a.peso || 1); pesos += Number(a.peso || 1);
      }
      const promAct = pesos ? suma / pesos : null;
      const fs = hayFechasParcial ? fechas.filter(d => enRango(d, cfg.parciales[i])) : fechas;
      const asis = asistDe(fs);
      const pa = Number(cfg.pct_asistencia) / 100;
      let cal = null;
      if (promAct !== null) cal = pa > 0 && asis.pct !== null ? promAct * (1 - pa) + (asis.pct / 10) * pa : promAct;
      return { promAct: r1(promAct), cal: r1(cal), entregadas, noEntregadas, calificadas, total: lista.length, asis };
    });

    const conCal = parciales.filter(p => p.cal !== null);
    const final = conCal.length ? r1(conCal.reduce((a, p) => a + p.cal, 0) / conCal.length) : null;

    const totEnt = parciales.reduce((a, p) => a + p.entregadas, 0);
    const totCalif = parciales.reduce((a, p) => a + p.calificadas, 0);
    const pctEntregas = totCalif ? (totEnt / totCalif) * 100 : null;

    // ── Riesgo ──
    const motivos = [];
    let nivel = 0; // 0 ok, 1 en riesgo, 2 reprobando
    const min = Number(cfg.asistencia_min), margen = Number(cfg.margen_riesgo);
    if (asistTotal.pct !== null) {
      if (asistTotal.pct < min) { nivel = 2; motivos.push(`Asistencia ${Math.round(asistTotal.pct)}% (mínimo ${min}%)`); }
      else if (asistTotal.pct < min + margen) { nivel = Math.max(nivel, 1); motivos.push(`Asistencia ${Math.round(asistTotal.pct)}%, cerca del mínimo`); }
    }
    if (pctEntregas !== null && pctEntregas < Number(cfg.entregas_min)) {
      nivel = Math.max(nivel, 1);
      motivos.push(`Entregó ${totEnt} de ${totCalif} actividades`);
    }
    if (final !== null && final < Number(cfg.aprobatoria)) {
      nivel = 2; motivos.push(`Promedio ${final} (mínimo ${cfg.aprobatoria})`);
    } else if (final !== null && final < Number(cfg.aprobatoria) + 1) {
      nivel = Math.max(nivel, 1); motivos.push(`Promedio ${final}, cerca de reprobar`);
    }

    porAlumno[s.id] = { asist: asistTotal, parciales, final, pctEntregas, totEnt, totCalif, nivel, motivos };
  }

  const resumen = { reprobando: 0, riesgo: 0 };
  for (const id in porAlumno) { if (porAlumno[id].nivel === 2) resumen.reprobando++; else if (porAlumno[id].nivel === 1) resumen.riesgo++; }
  return { porAlumno, resumen, fechas, actsPorParcial };
}
