/* global __BUILD_ID__ */
// Actualización automática: la app instalada guarda una copia y a veces tarda
// en tomar la versión nueva. Aquí se compara la versión del celular con la
// publicada (/version.json, sin caché) y, si son distintas, se recarga.
const KEY = "appprof_reloaded_for";

async function check() {
  try {
    const r = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const { build } = await r.json();
    if (!build || build === __BUILD_ID__) return;
    // Evita recargar en bucle si algo sale mal: una sola vez por versión publicada
    if (sessionStorage.getItem(KEY) === build) return;
    sessionStorage.setItem(KEY, build);
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.update().catch(() => {});
      await new Promise(res => {
        const t = setTimeout(res, 4000);
        navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(t); res(); }, { once: true });
      });
    }
    window.location.reload();
  } catch { /* sin internet o sin almacenamiento: se intenta más tarde */ }
}

export function startAutoUpdate() {
  if (import.meta.env.DEV) return;
  check();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  setInterval(check, 15 * 60 * 1000);
}
