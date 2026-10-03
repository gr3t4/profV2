import { sb } from "./supabase";

// Cola de cambios pendientes guardada en el celular (localStorage).
// Cada marca de asistencia se guarda aquí primero y luego se envía a Supabase.
// Si no hay internet, se queda en la cola y se reintenta sola al volver la conexión.
//
// Formato: { "a|<student_id>|<date>": {session_id, student_id, date, status, reason},
//            "h|<session_id>|<date>": {session_id, date, hours} }
const KEY = "appprof_pending";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function write(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* sin almacenamiento */ }
}

const listeners = new Set();
function notify() { const n = pendingCount(); listeners.forEach(fn => fn(n)); }
export function onPendingChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function pendingCount() { return Object.keys(read()).length; }

export function queueAttendance(rows) {
  const q = read();
  rows.forEach(r => { q[`a|${r.student_id}|${r.date}`] = { session_id:r.session_id, student_id:r.student_id, date:r.date, status:r.status, reason:r.reason || null }; });
  write(q); notify();
}
export function queueHours(session_id, date, hours) {
  const q = read();
  q[`h|${session_id}|${date}`] = { session_id, date, hours };
  write(q); notify();
}

// Marcas pendientes de un grupo en una fecha: { student_id: {status, reason} }
export function pendingFor(session_id, date) {
  const out = {};
  Object.entries(read()).forEach(([k, v]) => {
    if (k.startsWith("a|") && v.session_id === session_id && v.date === date) out[v.student_id] = { status:v.status, reason:v.reason || "" };
  });
  return out;
}
// Fechas y horas pendientes de un grupo
export function pendingDates(session_id) {
  const dates = new Set(); const hours = {};
  Object.entries(read()).forEach(([k, v]) => {
    if (v.session_id !== session_id) return;
    dates.add(v.date);
    if (k.startsWith("h|")) hours[v.date] = v.hours;
  });
  return { dates: [...dates], hours };
}

// Error de red (sin internet, timeout) vs. error real del servidor (permiso, datos inválidos)
function isNetworkError(error) {
  return !error?.code || error.code === "20" || /fetch|network|timeout|abort|Failed/i.test(error.message || "");
}

// Con señal muy mala una petición puede quedarse colgada; se corta a los 15 s
// para que la marca siga en la cola y se reintente.
function withTimeout(query, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return query.abortSignal(ctrl.signal).then(r => { clearTimeout(t); return r; }, e => { clearTimeout(t); throw e; });
}

let flushing = null;
// Envía todo lo pendiente. Regresa { ok, sent, rejected, offline }.
export function flush() {
  if (flushing) return flushing;
  // (El IIFE puede terminar en forma síncrona; por eso se limpia con .finally()
  // después de asignarlo y no dentro de la función.)
  flushing = (async () => {
    let sent = 0, rejected = null, offline = false;
    try {
      for (let pass = 0; pass < 3; pass++) {           // repite si llegaron marcas nuevas mientras se enviaba
        const snapshot = read();
        const keys = Object.keys(snapshot);
        if (!keys.length) break;
        if (typeof navigator !== "undefined" && navigator.onLine === false) { offline = true; break; }

        const attKeys = keys.filter(k => k.startsWith("a|"));
        const hKeys   = keys.filter(k => k.startsWith("h|"));
        const done = [];

        if (attKeys.length) {
          const { error } = await withTimeout(sb.from("attendance").upsert(attKeys.map(k => snapshot[k]), { onConflict:"student_id,date" }));
          if (error) {
            if (isNetworkError(error)) { offline = true; break; }
            rejected = error.message; done.push(...attKeys);   // el servidor lo rechazó: no reintentar en bucle
          } else { done.push(...attKeys); sent += attKeys.length; }
        }
        if (hKeys.length) {
          const { error } = await withTimeout(sb.from("class_hours").upsert(hKeys.map(k => snapshot[k]), { onConflict:"session_id,date" }));
          if (error) {
            if (isNetworkError(error)) { offline = true; break; }
            rejected = rejected || error.message; done.push(...hKeys);
          } else done.push(...hKeys);
        }

        // Quitar de la cola solo lo enviado y que no cambió mientras tanto
        const now = read();
        done.forEach(k => { if (JSON.stringify(now[k]) === JSON.stringify(snapshot[k])) delete now[k]; });
        write(now); notify();
      }
    } catch {
      offline = true;
    }
    return { ok: !offline && !rejected, sent, rejected, offline };
  })().finally(() => { flushing = null; });
  return flushing;
}
