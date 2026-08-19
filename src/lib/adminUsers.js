import { sb } from "./supabase";

// Llama a la Edge Function `admin-users` (crear/registrar/resetear clave/activar/borrar cuentas).
export async function callAdminUsers(action, payload = {}) {
  const { data, error } = await sb.functions.invoke("admin-users", { body: { action, ...payload } });
  if (error) {
    let message = error.message || "Error inesperado";
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      }
    } catch {
      // sin body JSON legible, se mantiene el mensaje por defecto
    }
    return { ok: false, error: message };
  }
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data };
}
