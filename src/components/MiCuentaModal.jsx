import { useState } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { usernameToEmail } from "../lib/username";

// "Mi cuenta": el docente cambia su nombre (el que aparece como Docente en los
// mensajes y reportes) y su contraseña.
export default function MiCuentaModal({ user, onNameChanged, onClose }) {
  const [name, setName]         = useState(user.name || "");
  const [nameMsg, setNameMsg]   = useState(null); // {ok, text}
  const [savingName, setSavingName] = useState(false);

  const [cur, setCur]   = useState("");
  const [p1, setP1]     = useState("");
  const [p2, setP2]     = useState("");
  const [passMsg, setPassMsg]   = useState(null);
  const [savingPass, setSavingPass] = useState(false);
  const [show, setShow] = useState(false);

  async function saveName() {
    const n = name.trim();
    setNameMsg(null);
    if (n.length < 3) { setNameMsg({ ok:false, text:"Escribe tu nombre completo (mínimo 3 letras)" }); return; }
    if (n === user.name) { setNameMsg({ ok:true, text:"Sin cambios" }); return; }
    setSavingName(true);
    const { data, error } = await sb.rpc("update_my_name", { p_name: n });
    setSavingName(false);
    if (error) { setNameMsg({ ok:false, text: error.message }); return; }
    onNameChanged(data || n);
    setNameMsg({ ok:true, text:"✅ Nombre actualizado" });
  }

  async function savePass() {
    setPassMsg(null);
    if (!cur) { setPassMsg({ ok:false, text:"Escribe tu contraseña actual" }); return; }
    if (p1.length < 6) { setPassMsg({ ok:false, text:"La nueva contraseña debe tener al menos 6 caracteres" }); return; }
    if (p1 !== p2) { setPassMsg({ ok:false, text:"Las contraseñas nuevas no coinciden" }); return; }
    if (p1 === cur) { setPassMsg({ ok:false, text:"La nueva contraseña es igual a la actual" }); return; }
    setSavingPass(true);
    // Confirma la contraseña actual antes de cambiarla
    const { error: e1 } = await sb.auth.signInWithPassword({ email: usernameToEmail(user.username), password: cur });
    if (e1) { setSavingPass(false); setPassMsg({ ok:false, text:"La contraseña actual no es correcta" }); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    setSavingPass(false);
    if (error) { setPassMsg({ ok:false, text: error.message }); return; }
    setCur(""); setP1(""); setP2("");
    setPassMsg({ ok:true, text:"✅ Contraseña actualizada. Úsala la próxima vez que inicies sesión." });
  }

  const lbl = { fontSize:11, color:C.muted, marginBottom:5 };
  const sec = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:14 };
  const msg = (m) => m && <div style={{fontSize:12,marginTop:8,color:m.ok?C.success:C.danger}}>{m.text}</div>;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:22,width:"100%",maxWidth:440,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{width:46,height:46,borderRadius:14,background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>👤</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:17}}>Mi cuenta</div>
            <div style={{color:C.muted,fontSize:12,marginTop:2}}>Usuario: <b style={{color:C.text}}>{user.username}</b> (no se cambia)</div>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={sec}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Nombre</div>
            <div style={lbl}>Así aparece como «Docente» en los mensajes y reportes</div>
            <input className="inp" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveName()} placeholder="Ej. Mario Ulises Peña Flores"/>
            <button className="btn" onClick={saveName} disabled={savingName}
              style={{marginTop:10,width:"100%",background:`linear-gradient(135deg,${C.accent},${C.teal})`,color:"#fff",borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
              {savingName ? "Guardando…" : "💾 Guardar nombre"}
            </button>
            {msg(nameMsg)}
          </div>

          <div style={sec}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>Contraseña</span>
              <button className="btn" onClick={()=>setShow(v=>!v)} style={{background:"none",color:C.muted,border:"none",fontSize:12,fontFamily:"inherit",padding:0,minHeight:0}}>{show?"🙈 Ocultar":"👁️ Mostrar"}</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div><div style={lbl}>Contraseña actual</div><input className="inp" type={show?"text":"password"} autoComplete="current-password" value={cur} onChange={e=>setCur(e.target.value)}/></div>
              <div><div style={lbl}>Nueva contraseña (mínimo 6 caracteres)</div><input className="inp" type={show?"text":"password"} autoComplete="new-password" value={p1} onChange={e=>setP1(e.target.value)}/></div>
              <div><div style={lbl}>Repite la nueva contraseña</div><input className="inp" type={show?"text":"password"} autoComplete="new-password" value={p2} onChange={e=>setP2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&savePass()}/></div>
            </div>
            <button className="btn" onClick={savePass} disabled={savingPass}
              style={{marginTop:10,width:"100%",background:`${C.gold}22`,color:C.gold,border:`1.5px solid ${C.gold}66`,borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
              {savingPass ? "Cambiando…" : "🔑 Cambiar contraseña"}
            </button>
            {msg(passMsg)}
          </div>

          <button className="btn" onClick={onClose}
            style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 0",fontSize:14,fontFamily:"inherit"}}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
