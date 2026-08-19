// KEEP IN SYNC with supabase/functions/admin-users/index.ts (deployed) and the
// twin copy in app-asistencia-main's src/lib/username.js.
// Supabase Auth es email-nativo; el login de esta app es por username, así que
// derivamos un correo interno determinístico a partir del username para usarlo
// por debajo con signInWithPassword/createUser. Nunca recibe correo real.
export function usernameToEmail(username) {
  const slug = String(username ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (slug.length < 1) throw new Error("Usuario inválido");
  return `${slug}@users.asistenciaapp.internal`;
}
