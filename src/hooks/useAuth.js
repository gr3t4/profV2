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

// Reintenta `fn` ante fallas de red/timeout (no ante errores ya resueltos por Supabase).
async function withRetry(fn, attempts = 3, delayMs = 1200) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// Sesión real de Supabase Auth + perfil (public.profiles) del usuario actual.
export function useAuth() {
  const [user, setUser] = useState(null); // {id, username, name, role}
  const [loading, setLoading] = useState(true);
  const [connError, setConnError] = useState(false); // red caída tras reintentos (no es "sesión inválida")

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      setConnError(false);
      return;
    }
    try {
      const { data: profile, error } = await withRetry(() =>
        withTimeout(sb.from("profiles").select("*").eq("id", authUser.id).single(), 12000)
      );
      if (error || !profile || profile.active === false) {
        // Respuesta real del servidor: el perfil no existe o está desactivado.
        await sb.auth.signOut().catch(() => {});
        setUser(null);
        setConnError(false);
        return;
      }
      setConnError(false);
      setUser({ id: authUser.id, username: profile.username, name: profile.name, role: profile.role });
    } catch {
      // Red caída o timeout tras reintentos: NO es una sesión inválida, así que no
      // cerramos sesión ni tocamos `user` — solo avisamos para mostrar un reintento
      // en vez de mandar al usuario a la pantalla de login.
      setConnError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await withRetry(() => withTimeout(sb.auth.getSession(), 12000));
        if (!active) return;
        await loadProfile(session?.user ?? null);
      } catch {
        if (active) setConnError(true);
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

  const retry = useCallback(() => {
    setConnError(false);
    setLoading(true);
    (async () => {
      try {
        const { data: { session } } = await withRetry(() => withTimeout(sb.auth.getSession(), 12000));
        await loadProfile(session?.user ?? null);
      } catch {
        setConnError(true);
      } finally {
        setLoading(false);
      }
    })();
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

  return { user, loading, connError, retry, login, register, logout };
}
