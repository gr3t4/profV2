import { useState } from "react";
import { sb } from "../lib/supabase";
import { setSession } from "../lib/session";
import { GlobalStyles } from "./Shared";

const THEMES = {
  teacher: {
    bg:"#07201a", surface:"#0c2d24", card:"#0f3529", border:"#1a5040",
    accent:"#007a5e", light:"#00a87e", text:"#e8f5f1", muted:"#5a9e8a", danger:"#e53935",
    grad:"linear-gradient(135deg,#007a5e,#005a44)",
    glow1:"rgba(0,122,94,0.10)", glow2:"rgba(0,168,126,0.07)",
  },
  student: {
    bg:"#0a0f1e", surface:"#0f1730", card:"#131d3a", border:"#1e2d5a",
    accent:"#3b6fd4", light:"#5b8ff9", text:"#e8eeff", muted:"#6b82b8", danger:"#e53935",
    grad:"linear-gradient(135deg,#3b6fd4,#1a3a8a)",
    glow1:"rgba(59,111,212,0.10)", glow2:"rgba(91,143,249,0.07)",
  },
};

// ── Wrapper común para todas las pantallas ───────────────────────
function Screen({ bg, glow1, glow2, glow1Pos="top:-20%;left:-10%", glow2Pos="bottom:-20%;right:-10%", children }) {
  const g1 = Object.fromEntries(glow1Pos.split(";").map(s=>s.split(":")));
  const g2 = Object.fromEntries(glow2Pos.split(";").map(s=>s.split(":")));
  return (
    <div style={{
      minHeight:"100vh", width:"100%", background:bg,
      display:"flex", flexDirection:"column",
      fontFamily:"'Inter',sans-serif", position:"relative",
    }}>
      <GlobalStyles/>
      <div style={{position:"fixed",...g1,width:"55vw",height:"55vw",borderRadius:"50%",background:`radial-gradient(circle,${glow1} 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",...g2,width:"50vw",height:"50vw",borderRadius:"50%",background:`radial-gradient(circle,${glow2} 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
      <div style={{
        flex:1, display:"flex", flexDirection:"column", justifyContent:"center",
        padding:"clamp(20px,5vw,48px) clamp(16px,5vw,32px)",
        position:"relative", zIndex:1, maxWidth:480, width:"100%", margin:"0 auto",
        boxSizing:"border-box",
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Pantalla de selección ────────────────────────────────────────
function RoleSelect({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  return (
    <Screen bg="#060b14" glow1="rgba(0,122,94,0.08)" glow2="rgba(59,111,212,0.08)"
      glow1Pos="top:-15%;left:-10%" glow2Pos="bottom:-15%;right:-10%">

      <div style={{textAlign:"center",marginBottom:40,animation:"fadeUp .5s ease both"}}>
        <div style={{
          width:68,height:68,borderRadius:20,margin:"0 auto 16px",
          background:"linear-gradient(135deg,#007a5e22,#3b6fd422)",
          border:"1px solid #ffffff11",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,
        }}>📚</div>
        <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:"clamp(22px,6vw,30px)",fontWeight:800,color:"#fff",margin:0}}>
          AppProf
        </h1>
        <p style={{color:"#5a7090",fontSize:12,marginTop:8,letterSpacing:1.2,textTransform:"uppercase"}}>
          ¿Cómo deseas ingresar?
        </p>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeUp .5s ease .1s both"}}>
        {[
          { id:"teacher", icon:"👨‍🏫", label:"Soy Docente", sub:"Gestiona asistencia, tareas y calificaciones",
            bg:"#0c2d2488", bgH:"#0f3529", border:"#1a504066", borderH:"#00a87e",
            color:"#e8f5f1", muted:"#5a9e8a", shadow:"rgba(0,122,94,0.25)",
            grad:"linear-gradient(135deg,#007a5e,#005a44)", glow:"rgba(0,122,94,0.4)" },
          { id:"student", icon:"🎓", label:"Soy Alumno", sub:"Consulta tus tareas, asistencia y calificaciones",
            bg:"#0f173088", bgH:"#131d3a", border:"#1e2d5a66", borderH:"#5b8ff9",
            color:"#e8eeff", muted:"#6b82b8", shadow:"rgba(59,111,212,0.25)",
            grad:"linear-gradient(135deg,#3b6fd4,#1a3a8a)", glow:"rgba(59,111,212,0.4)" },
        ].map(r => (
          <button key={r.id} onClick={()=>onSelect(r.id)}
            onMouseEnter={()=>setHovered(r.id)} onMouseLeave={()=>setHovered(null)}
            style={{
              background:hovered===r.id?r.bgH:r.bg,
              border:`2px solid ${hovered===r.id?r.borderH:r.border}`,
              borderRadius:16, padding:"20px 20px",
              cursor:"pointer", textAlign:"left", transition:"all .2s", fontFamily:"inherit",
              transform:hovered===r.id?"translateY(-2px)":"none",
              boxShadow:hovered===r.id?`0 10px 36px ${r.shadow}`:"none",
            }}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{
                width:50,height:50,borderRadius:13,flexShrink:0,
                background:r.grad, display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:24, boxShadow:`0 4px 14px ${r.glow}`,
              }}>{r.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:16,color:r.color,marginBottom:3}}>{r.label}</div>
                <div style={{fontSize:12,color:r.muted,lineHeight:1.4}}>{r.sub}</div>
              </div>
              <div style={{color:r.muted,fontSize:18,flexShrink:0}}>→</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{marginTop:36,textAlign:"center",fontSize:11,color:"#2a3a50"}}>AppProf v4</div>
    </Screen>
  );
}

// ── Login de docente ─────────────────────────────────────────────
function TeacherLogin({ onLogin, onBack }) {
  const T = THEMES.teacher;
  const [mode, setMode]   = useState("login");
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [name, setName]   = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);
  const [forgot, setForgot] = useState(false);

  async function submit() {
    setError(""); setBusy(true);
    if (!username.trim()||!password.trim()) { setError("Completa todos los campos"); setBusy(false); return; }
    if (mode==="register") {
      if (!name.trim()) { setError("Ingresa tu nombre"); setBusy(false); return; }
      const { data:ex } = await sb.from("users").select("id").eq("username",username.trim()).maybeSingle();
      if (ex) { setError("Ese usuario ya existe"); setBusy(false); return; }
      const { data,error:err } = await sb.from("users").insert({username:username.trim(),password,name:name.trim(),role:"teacher"}).select().single();
      if (err) { setError("Error: "+err.message); setBusy(false); return; }
      setSession({id:data.id,username:data.username,name:data.name,role:data.role});
      onLogin({id:data.id,username:data.username,name:data.name,role:data.role});
    } else {
      const { data,error:err } = await sb.from("users").select("*").eq("username",username.trim()).eq("password",password).maybeSingle();
      if (err||!data) { setError("Usuario o contraseña incorrectos"); setBusy(false); return; }
      if (data.active===false) { setError("Cuenta desactivada. Contacta al administrador."); setBusy(false); return; }
      setSession({id:data.id,username:data.username,name:data.name,role:data.role});
      onLogin({id:data.id,username:data.username,name:data.name,role:data.role});
    }
    setBusy(false);
  }

  const inp = {width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.text,
    borderRadius:10,padding:"11px 14px",fontSize:15,fontFamily:"inherit",outline:"none",
    boxSizing:"border-box",transition:"border-color .2s"};

  return (
    <Screen bg={T.bg} glow1={T.glow1} glow2={T.glow2}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:13,
        cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,
        marginBottom:24,padding:"8px 0",width:"fit-content"}}>
        ← Volver
      </button>

      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{width:58,height:58,borderRadius:16,background:"linear-gradient(135deg,#007a5e,#005a44)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,
          margin:"0 auto 12px",boxShadow:"0 4px 20px rgba(0,122,94,0.4)"}}>👨‍🏫</div>
        <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:"clamp(20px,5vw,24px)",color:T.text,fontWeight:800,margin:0}}>Acceso Docente</h1>
        <div style={{width:48,height:3,background:`linear-gradient(90deg,${T.accent},${T.light})`,borderRadius:2,margin:"10px auto 0"}}/>
      </div>

      {forgot ? (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{textAlign:"center",color:T.muted,fontSize:13}}>Contacta al administrador para recuperar tu contraseña.</div>
          <a href="https://wa.me/527757716024?text=Necesito+recuperar+mi+contraseña+de+AppProf" target="_blank" rel="noreferrer"
            style={{background:"#25d36622",color:"#25d366",border:"1.5px solid #25d36666",borderRadius:10,
              padding:"12px 0",fontSize:14,fontWeight:600,textAlign:"center",textDecoration:"none",display:"block"}}>
            📲 Contactar por WhatsApp
          </a>
          <button onClick={()=>setForgot(false)} style={{background:"none",color:T.muted,border:`1px solid ${T.border}`,
            borderRadius:10,padding:"11px 0",fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>
            ← Volver al login
          </button>
        </div>
      ) : (
        <>
          <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:20}}>
            {[["login","Iniciar sesión"],["register","Crear cuenta"]].map(([m,l])=>(
              <button key={m} onClick={()=>{setMode(m);setError("");}}
                style={{flex:1,padding:"9px 0",background:"none",color:mode===m?T.light:T.muted,
                  borderBottom:mode===m?`2px solid ${T.light}`:"2px solid transparent",
                  fontSize:14,fontFamily:"inherit",fontWeight:mode===m?600:400,border:"none",
                  borderBottomWidth:2,borderBottomStyle:"solid",cursor:"pointer",transition:"all .2s"}}>
                {l}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {mode==="register" && (
              <div>
                <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>NOMBRE COMPLETO</div>
                <input placeholder="Ej. María García" value={name} onChange={e=>setName(e.target.value)}
                  style={{...inp,borderColor:name?T.accent:T.border}}
                  onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=name?T.accent:T.border}/>
              </div>
            )}
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>USUARIO</div>
              <input placeholder="Nombre de usuario" value={username} autoFocus={mode==="login"}
                onChange={e=>setUser(e.target.value)}
                style={{...inp,borderColor:username?T.accent:T.border}}
                onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=username?T.accent:T.border}/>
            </div>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>CONTRASEÑA</div>
              <input type="password" placeholder="••••••••" value={password}
                onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
                style={{...inp,borderColor:password?T.accent:T.border}}
                onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=password?T.accent:T.border}/>
              {mode==="login" && (
                <button onClick={()=>setForgot(true)} style={{background:"none",border:"none",color:T.muted,
                  fontSize:12,cursor:"pointer",fontFamily:"inherit",marginTop:5,padding:0,
                  display:"block",width:"100%",textAlign:"right"}}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            {error && <div style={{background:`${T.danger}18`,border:`1px solid ${T.danger}44`,borderRadius:8,
              padding:"10px 14px",color:T.danger,fontSize:13,textAlign:"center"}}>{error}</div>}
            <button onClick={submit} disabled={busy} style={{
              background:T.grad,color:"#fff",borderRadius:10,padding:"14px 0",fontSize:15,
              fontWeight:700,fontFamily:"inherit",border:"none",cursor:busy?"not-allowed":"pointer",
              marginTop:4,boxShadow:`0 4px 20px ${T.accent}55`,opacity:busy?.7:1,transition:"opacity .2s"}}>
              {busy?"Conectando...":(mode==="login"?"Entrar":"Crear cuenta")}
            </button>
          </div>
        </>
      )}
      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:T.muted}}>AppProf v4</div>
    </Screen>
  );
}

// ── Login de alumno (con auto-registro por código) ──────────────
function StudentLogin({ onLogin, onBack }) {
  const T = THEMES.student;
  const [mode, setMode]     = useState("login"); // login | register
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [code, setCode]     = useState("");
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);

  const inp = {width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.text,
    borderRadius:10,padding:"11px 14px",fontSize:15,fontFamily:"inherit",outline:"none",
    boxSizing:"border-box",transition:"border-color .2s"};

  async function login() {
    setError(""); setBusy(true);
    if (!username.trim()||!password.trim()) { setError("Completa todos los campos"); setBusy(false); return; }
    const { data,error:err } = await sb.from("users").select("*").eq("username",username.trim()).eq("password",password).maybeSingle();
    if (err||!data) { setError("Usuario o contraseña incorrectos"); setBusy(false); return; }
    if (data.active===false) { setError("Cuenta desactivada. Contacta a tu docente."); setBusy(false); return; }
    if (data.role!=="student") { setError("Esta cuenta no es de alumno. Usa el acceso Docente."); setBusy(false); return; }
    setSession({id:data.id,username:data.username,name:data.name,role:data.role});
    onLogin({id:data.id,username:data.username,name:data.name,role:data.role});
    setBusy(false);
  }

  async function register() {
    setError(""); setBusy(true);
    const u = username.trim(), p = password.trim(), c = code.trim().toUpperCase();
    if (!u||!p||!c) { setError("Completa todos los campos"); setBusy(false); return; }
    if (p.length < 4) { setError("La contraseña debe tener al menos 4 caracteres"); setBusy(false); return; }

    // 1. Verificar código de sesión
    const { data:sess } = await sb.from("sessions")
      .select("id,name,owner:users(name)")
      .eq("join_code", c).maybeSingle();
    if (!sess) { setError("Código de sesión incorrecto o expirado"); setBusy(false); return; }

    // 2. Verificar que el usuario no exista
    const { data:ex } = await sb.from("users").select("id").eq("username",u).maybeSingle();
    if (ex) { setError("Ese nombre de usuario ya está en uso"); setBusy(false); return; }

    // 3. Crear usuario con rol student (nombre = username capitalizado)
    const displayName = u.replace(/\./g," ").replace(/\b\w/g, l => l.toUpperCase());
    const { data:newUser, error:uErr } = await sb.from("users")
      .insert({ username:u, password:p, name:displayName, role:"student" })
      .select().single();
    if (uErr) { setError("Error al crear cuenta: "+uErr.message); setBusy(false); return; }

    // 4. Crear registro de alumno — nombre tomado del usuario
    const { error:sErr } = await sb.from("students")
      .insert({ session_id:sess.id, name:displayName, user_id:newUser.id });
    if (sErr) { setError("Error al unirse a la sesión: "+sErr.message); setBusy(false); return; }

    setSession({id:newUser.id,username:newUser.username,name:newUser.name,role:newUser.role});
    onLogin({id:newUser.id,username:newUser.username,name:newUser.name,role:newUser.role});
    setBusy(false);
  }

  return (
    <Screen bg={T.bg} glow1={T.glow1} glow2={T.glow2}
      glow1Pos="top:-20%;right:-10%" glow2Pos="bottom:-20%;left:-10%">
      <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:13,
        cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,
        marginBottom:24,padding:"8px 0",width:"fit-content"}}>
        ← Volver
      </button>

      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{width:58,height:58,borderRadius:16,background:"linear-gradient(135deg,#3b6fd4,#1a3a8a)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,
          margin:"0 auto 12px",boxShadow:"0 4px 20px rgba(59,111,212,0.4)"}}>🎓</div>
        <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:"clamp(20px,5vw,24px)",color:T.text,fontWeight:800,margin:0}}>Acceso Alumno</h1>
        <div style={{width:48,height:3,background:`linear-gradient(90deg,${T.accent},${T.light})`,borderRadius:2,margin:"10px auto 0"}}/>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:20}}>
        {[["login","Iniciar sesión"],["register","Registrarme"]].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setError("");}}
            style={{flex:1,padding:"9px 0",background:"none",color:mode===m?T.light:T.muted,
              borderBottom:mode===m?`2px solid ${T.light}`:"2px solid transparent",
              fontSize:14,fontFamily:"inherit",fontWeight:mode===m?600:400,border:"none",
              borderBottomWidth:2,borderBottomStyle:"solid",cursor:"pointer",transition:"all .2s"}}>
            {l}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>USUARIO</div>
            <input placeholder="Tu usuario" value={username} autoFocus
              onChange={e=>setUser(e.target.value)}
              style={{...inp,borderColor:username?T.accent:T.border}}
              onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=username?T.accent:T.border}/>
          </div>
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>CONTRASEÑA</div>
            <input type="password" placeholder="••••••••" value={password}
              onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
              style={{...inp,borderColor:password?T.accent:T.border}}
              onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=password?T.accent:T.border}/>
          </div>
          {error && <div style={{background:`${T.danger}18`,border:`1px solid ${T.danger}44`,borderRadius:8,padding:"10px 14px",color:T.danger,fontSize:13,textAlign:"center"}}>{error}</div>}
          <button onClick={login} disabled={busy} style={{
            background:T.grad,color:"#fff",borderRadius:10,padding:"14px 0",fontSize:15,
            fontWeight:700,fontFamily:"inherit",border:"none",cursor:busy?"not-allowed":"pointer",
            marginTop:4,boxShadow:`0 4px 20px ${T.accent}55`,opacity:busy?.7:1,transition:"opacity .2s"}}>
            {busy?"Conectando...":"Entrar"}
          </button>
          <button onClick={()=>{setMode("register");setError("");}} style={{background:"none",border:"none",
            color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",textAlign:"center",padding:"4px 0"}}>
            ¿Primera vez? Regístrate con el código de tu docente →
          </button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Código destacado */}
          <div style={{background:`${T.accent}11`,border:`2px dashed ${T.accent}44`,borderRadius:12,padding:"12px 16px"}}>
            <div style={{fontSize:11,color:T.accent,marginBottom:6,letterSpacing:.5,fontWeight:700}}>CÓDIGO DE SESIÓN</div>
            <input placeholder="Ej. AB12CD" value={code}
              onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} autoFocus
              style={{...inp,textAlign:"center",fontFamily:"'Sora',monospace",
                fontSize:"clamp(18px,6vw,24px)",fontWeight:800,letterSpacing:"clamp(4px,2vw,6px)",
                background:"transparent",border:`1.5px solid ${T.border}`,borderColor:code?T.accent:T.border}}
              onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=code?T.accent:T.border}/>
            <div style={{fontSize:11,color:T.muted,marginTop:6,textAlign:"center"}}>Pídelo a tu docente</div>
          </div>
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>ELIGE UN USUARIO</div>
            <input placeholder="Ej. juan.perez" value={username}
              onChange={e=>setUser(e.target.value.toLowerCase().replace(/\s/g,""))}
              style={{...inp,borderColor:username?T.accent:T.border}}
              onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=username?T.accent:T.border}/>
          </div>
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>ELIGE UNA CONTRASEÑA</div>
            <input type="password" placeholder="Mínimo 4 caracteres" value={password}
              onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&register()}
              style={{...inp,borderColor:password?T.accent:T.border}}
              onFocus={e=>e.target.style.borderColor=T.light} onBlur={e=>e.target.style.borderColor=password?T.accent:T.border}/>
          </div>
          {error && <div style={{background:`${T.danger}18`,border:`1px solid ${T.danger}44`,borderRadius:8,padding:"10px 14px",color:T.danger,fontSize:13,textAlign:"center"}}>{error}</div>}
          <button onClick={register} disabled={busy} style={{
            background:T.grad,color:"#fff",borderRadius:10,padding:"14px 0",fontSize:15,
            fontWeight:700,fontFamily:"inherit",border:"none",cursor:busy?"not-allowed":"pointer",
            marginTop:4,boxShadow:`0 4px 20px ${T.accent}55`,opacity:busy?.7:1,transition:"opacity .2s"}}>
            {busy?"Creando cuenta...":"Crear cuenta y unirme →"}
          </button>
        </div>
      )}

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:T.muted}}>AppProf v4</div>
    </Screen>
  );
}

// ── Exportación principal ────────────────────────────────────────
export default function AuthScreen({ onLogin }) {
  const [role, setRole] = useState(null);
  if (!role)            return <RoleSelect onSelect={setRole}/>;
  if (role==="teacher") return <TeacherLogin onLogin={onLogin} onBack={()=>setRole(null)}/>;
  if (role==="student") return <StudentLogin onLogin={onLogin} onBack={()=>setRole(null)}/>;
}
