import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY");
}

// Por defecto, supabase-js usa el Web Locks API del navegador (navigator.locks)
// para sincronizar el refresco de sesión entre pestañas. Tiene un bug conocido
// y muy reportado (locks huérfanos tras recargar la página que dejan la
// inicialización de la sesión colgada 30s o más — ver
// github.com/supabase/supabase-js/issues/2013, /issues/2111, /issues/1517).
// Esta app se usa normalmente en una sola pestaña/dispositivo a la vez, así
// que desactivamos ese lock entre pestañas en vez de arriesgar el cuelgue.
async function noCrossTabLock(_name, _acquireTimeout, fn) {
  return await fn();
}

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // necesario para OAuth callback
    lock: noCrossTabLock,
  }
});
