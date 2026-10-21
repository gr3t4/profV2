/* global __BUILD_ID__ */
// Actualización automática: la app (sobre todo instalada o con la pestaña
// abierta mucho tiempo en la computadora) guarda una copia y a veces tarda en
// tomar la versión nueva. Aquí se compara la versión cargada con la publicada
// (/version.json, sin caché) y, si son distintas, se actualiza sola:
//   1er intento: pide al service worker la versión nueva y recarga.
//   2º intento:  si sigue la vieja, borra la copia guardada (service worker y
//                cachés) y recarga desde el servidor.
//   Máximo 3 intentos por versión, para no quedar en un ciclo de recargas.
const KEY = "appprof_update_attempts";

function attempts(build) {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || "{}"); return v.build === build ? v.n : 0; } catch { return 0; }
}
function setAttempts(build, n) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ build, n })); } catch { /* sin almacenamiento */ }
}

function waitForNewWorker(ms) {
  return new Promise(res => {
    if (!navigator.serviceWorker) return res(false);
    const t = setTimeout(() => res(false), ms);
    navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(t); res(true); }, { once: true });
  });
}

async function hardReset() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
  } catch { /* nada */ }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch { /* nada */ }
}

let running = false;
async function check() {
  if (running) return;
  running = true;
  try {
    const r = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const { build } = await r.json();
    if (!build || build === __BUILD_ID__) { try { sessionStorage.removeItem(KEY); } catch { /* nada */ } return; }

    const n = attempts(build);
    if (n >= 3) return;                    // ya se intentó varias veces: no insistir
    setAttempts(build, n + 1);

    if (n === 0) {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) {
        await reg.update().catch(() => {});
        reg.waiting?.postMessage?.({ type: "SKIP_WAITING" });
        await waitForNewWorker(15000);     // la descarga puede tardar con señal lenta
      }
    } else {
      await hardReset();                   // el service worker no se actualizó: empezar limpio
    }
    window.location.reload();
  } catch { /* sin internet: se intenta más tarde */ }
  finally { running = false; }
}

export function startAutoUpdate() {
  window.__APP_BUILD__ = __BUILD_ID__;   // para revisar en consola qué versión está cargada
  if (import.meta.env.DEV) return;
  check();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  window.addEventListener("focus", check);
  window.addEventListener("online", check);
  setInterval(check, 10 * 60 * 1000);
}
