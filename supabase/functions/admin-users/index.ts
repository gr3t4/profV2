// =============================================================================
// supabase/functions/admin-users/index.ts
// =============================================================================
// Operaciones sobre cuentas que no se pueden hacer desde el navegador con la
// llave pública: registro (público, queda PENDIENTE de aprobación), crear
// cuentas (admin), restablecer contraseña, activar/desactivar y borrar.
//
// La llave service_role vive SOLO como secreto de la función
// (supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...). Nunca en el repo ni en
// el navegador. SUPABASE_URL y SUPABASE_ANON_KEY los pone Supabase.
//
// Seguridad (2026-10-28): las cuentas creadas con "Crear cuenta" nacen
// desactivadas (perfil active=false y usuario bloqueado en Auth) hasta que un
// administrador las active desde su panel ("setActive").
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// KEEP IN SYNC with src/lib/username.js
function usernameToEmail(username: string): string {
  const slug = username
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (slug.length < 1) throw new Error("Usuario inválido");
  return `${slug}@users.asistenciaapp.internal`;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BLOQUEO = "876000h"; // ~100 años = bloqueado hasta que el admin lo active

function validar(username: unknown, password: unknown, name: unknown): string | null {
  const u = String(username ?? "").trim(), p = String(password ?? ""), n = String(name ?? "").trim();
  if (u.length < 3 || u.length > 30) return "El usuario debe tener entre 3 y 30 caracteres";
  if (p.length < 6 || p.length > 72) return "La contraseña debe tener entre 6 y 72 caracteres";
  if (n.length < 3 || n.length > 80) return "Escribe tu nombre completo";
  return null;
}

async function createUserAndProfile(
  adminClient: ReturnType<typeof createClient>,
  params: { username: string; password: string; name: string; role: "teacher" | "viewer"; createdByAdmin: boolean; active: boolean },
) {
  const { username, password, name, role, createdByAdmin, active } = params;
  const email = usernameToEmail(username);

  const { data: existing, error: existingError } = await adminClient
    .from("profiles").select("id").ilike("username", username).maybeSingle();
  if (existingError) return { error: existingError.message, status: 500 };
  if (existing) return { error: "usuario ya existe", status: 409 };

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username, name, role },
    ...(active ? {} : { ban_duration: BLOQUEO }),
  });
  if (createError || !created?.user) {
    return { error: createError?.message ?? "no se pudo crear el usuario", status: 400 };
  }

  const { data: upserted, error: upsertError } = await adminClient
    .from("profiles")
    .upsert({ id: created.user.id, username, name, role, active, created_by_admin: createdByAdmin })
    .select("id, username, name, role, active, created_at, created_by_admin")
    .single();

  if (upsertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return { error: upsertError.message, status: 500 };
  }
  return { data: upserted, status: 200 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body ?? {};

    // ── Registro público: la cuenta queda PENDIENTE de aprobación ──
    if (action === "register") {
      const { username, password, name } = body ?? {};
      const err = validar(username, password, name);
      if (err) return json({ error: err }, 400);

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const result = await createUserAndProfile(adminClient, {
        username: String(username).trim(), password: String(password), name: String(name).trim(),
        role: "teacher",          // siempre docente, sin importar lo que mande el cliente
        createdByAdmin: false,
        active: false,            // no entra hasta que el admin la active
      });
      if (result.error) return json({ error: result.error }, result.status);
      return json({ ok: true, pending: true }, 200);
    }

    // ── Todo lo demás: solo un administrador activo ──
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles").select("role, active").eq("id", userData.user.id).single();
    if (callerProfileError || callerProfile?.role !== "admin" || callerProfile?.active === false) {
      return json({ error: "forbidden" }, 403);
    }

    switch (action) {
      case "create": {
        const { username, password, name, role } = body ?? {};
        const err = validar(username, password, name);
        if (err) return json({ error: err }, 400);
        if (role !== "teacher" && role !== "viewer") return json({ error: "rol inválido" }, 400);
        const result = await createUserAndProfile(adminClient, {
          username: String(username).trim(), password: String(password), name: String(name).trim(),
          role, createdByAdmin: true, active: true,
        });
        if (result.error) return json({ error: result.error }, result.status);
        return json(result.data, result.status);
      }

      case "resetPassword": {
        const { userId, newPassword } = body ?? {};
        if (!userId || !newPassword) return json({ error: "faltan campos requeridos" }, 400);
        if (String(newPassword).length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
        const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "setActive": {
        const { userId, active } = body ?? {};
        if (!userId || typeof active !== "boolean") return json({ error: "faltan campos requeridos" }, 400);
        const { error: authError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : BLOQUEO });
        if (authError) return json({ error: authError.message }, 400);
        const { error: profileError } = await adminClient.from("profiles").update({ active }).eq("id", userId);
        if (profileError) return json({ error: profileError.message }, 400);
        return json({ ok: true });
      }

      case "delete": {
        const { userId } = body ?? {};
        if (!userId) return json({ error: "faltan campos requeridos" }, 400);
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
