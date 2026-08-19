import { useCallback, useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { usernameToEmail } from "../lib/username";
import { callAdminUsers } from "../lib/adminUsers";

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Sesión real de Supabase Auth + perfil (public.profiles) del usuario actual.
export function useAuth() {
  const [user, setUser] = useState(null); // {id, username, name, role}
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      return;
    }
    try {
      const { data: profile, error } = await withTimeout(
        sb.from("profiles").select("*").eq("id", authUser.id).single(),
        10000
      );
      if (error || !profile || profile.active === false) {
        await sb.auth.signOut().catch(() => {});
        setUser(null);
        return;
      }
      setUser({ id: authUser.id, username: profile.username, name: profile.name, role: profile.role });
    } catch {
      // Perfil ilocalizable, red caída, o timeout: tratar como sesión inválida
      // en vez de dejar la app colgada en "Cargando...".
      await sb.auth.signOut().catch(() => {});
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await withTimeout(sb.auth.getSession(), 10000);
        if (!active) return;
        await loadProfile(session?.user ?? null);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
      await loadProfile(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function login(username, password) {
    const email = usernameToEmail(username);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: "Usuario o contraseña incorrectos" };
    return { ok: true };
  }

  async function register(username, password, name) {
    const res = await callAdminUsers("register", { username, password, name });
    if (!res.ok) return { ok: false, message: res.error };
    return login(username, password);
  }

  async function logout() {
    await sb.auth.signOut();
  }

  return { user, loading, login, register, logout };
}
