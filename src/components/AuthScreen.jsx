import { useState } from "react";
import { GlobalStyles } from "./Shared";

const T = {
  bg:"#07201a", surface:"#0c2d24", card:"#0f3529", border:"#1a5040",
  accent:"#007a5e", light:"#00a87e", text:"#e8f5f1", muted:"#5a9e8a", danger:"#e53935",
  grad:"linear-gradient(135deg,#007a5e,#005a44)",
  glow1:"rgba(0,122,94,0.10)", glow2:"rgba(0,168,126,0.07)",
};

function Screen({ children }) {
  return (
    <div style={{
      minHeight:"100vh", width:"100%", background:T.bg,
      display:"flex", flexDirection:"column",
      fontFamily:"'Inter',sans-serif", position:"relative",
    }}>
      <GlobalStyles/>
      <div style={{position:"fixed",top:"-20%",left:"-10%",width:"55vw",height:"55vw",borderRadius:"50%",background:`radial-gradient(circle,${T.glow1} 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",bottom:"-20%",right:"-10%",width:"50vw",height:"50vw",borderRadius:"50%",background:`radial-gradient(circle,${T.glow2} 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
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

export default function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode]     = useState("login");
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [name, setName]     = useState("");
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [forgot, setForgot] = useState(false);

  async function submit() {
    setError(""); setBusy(true);
    if (!username.trim()||!password.trim()) { setError("Completa todos los campos"); setBusy(false); return; }
    let res;
    if (mode==="register") {
      if (!name.trim()) { setError("Ingresa tu nombre"); setBusy(false); return; }
      res = await onRegister(username.trim(), password, name.trim());
    } else {
      res = await onLogin(username.trim(), password);
    }
    if (!res.ok) setError(res.message || "Ocurrió un error, intenta de nuevo");
    setBusy(false);
  }

  const inp = {width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.text,
    borderRadius:10,padding:"11px 14px",fontSize:15,fontFamily:"inherit",outline:"none",
    boxSizing:"border-box",transition:"border-color .2s"};

  return (
    <Screen>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{width:58,height:58,borderRadius:16,background:"linear-gradient(135deg,#007a5e,#005a44)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,
          margin:"0 auto 12px",boxShadow:"0 4px 20px rgba(0,122,94,0.4)"}}>👨‍🏫</div>
        <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:"clamp(22px,6vw,26px)",color:T.text,fontWeight:800,margin:0}}>AppProf</h1>
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
                  style={{...inp,borderColor:name?T.accent:T.border}}/>
              </div>
            )}
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>USUARIO</div>
              <input placeholder="Nombre de usuario" value={username} autoFocus={mode==="login"}
                onChange={e=>setUser(e.target.value)}
                style={{...inp,borderColor:username?T.accent:T.border}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:5,letterSpacing:.5}}>CONTRASEÑA</div>
              <input type="password" placeholder="••••••••" value={password}
                onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
                style={{...inp,borderColor:password?T.accent:T.border}}/>
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
