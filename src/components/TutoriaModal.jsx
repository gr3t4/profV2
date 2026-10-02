import { useState } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { cleanPhone, sendTutoriaMessage } from "../lib/whatsapp";

// Aviso a Tutorías: contacto del grupo (nombre + WhatsApp) y mensaje editable
// con docente, materia, fecha y alumnos con falta. El docente puede cambiar el
// texto antes de enviarlo.
export default function TutoriaModal({ session, absentCount, buildMessage, onSave, onSent, onClose }) {
  const [name,  setName]  = useState(session.tutoria_name  || "");
  const [phone, setPhone] = useState(session.tutoria_phone || "");
  const [msg,   setMsg]   = useState(() => absentCount > 0 ? buildMessage(session.tutoria_name || "") : "");
  const [edited, setEdited] = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  function changeName(v) {
    setName(v);
    // Mientras el docente no haya editado el texto, el saludo sigue al nombre.
    if (!edited && absentCount > 0) setMsg(buildMessage(v.trim()));
  }

  function restore() {
    setMsg(buildMessage(name.trim()));
    setEdited(false);
  }

  async function saveContact() {
    if (!phone.trim()) { setError("El teléfono es requerido"); return null; }
    const cleaned = cleanPhone(phone.trim());
    const newName = name.trim() || null;
    if (cleaned === session.tutoria_phone && newName === (session.tutoria_name || null)) return session;
    setBusy(true); setError("");
    const { error:err } = await sb.from("sessions")
      .update({ tutoria_name: newName, tutoria_phone: cleaned })
      .eq("id", session.id);
    setBusy(false);
    if (err) { setError(err.message); return null; }
    const updated = { ...session, tutoria_name: newName, tutoria_phone: cleaned };
    onSave(updated);
    return updated;
  }

  async function send() {
    if (!msg.trim()) { setError("El mensaje está vacío"); return; }
    const sess = await saveContact();
    if (!sess) return;
    sendTutoriaMessage(sess.tutoria_phone, msg);
    onSent();
  }

  async function saveOnly() {
    if (await saveContact()) onClose();
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.gold}55`,borderRadius:20,padding:22,width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          <div style={{width:46,height:46,borderRadius:14,background:`${C.gold}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🏫</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:16,color:C.text}}>Avisar a Tutorías</div>
            <div style={{color:C.muted,fontSize:13,marginTop:2}}>{session.name}</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 180px"}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Tutor(a) del grupo (opcional)</div>
              <input className="inp" placeholder="Ej. Mtra. Laura Pérez" value={name} onChange={e=>changeName(e.target.value)}/>
            </div>
            <div style={{flex:"1 1 150px"}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:5}}>WhatsApp (10 dígitos)</div>
              <input className="inp" type="tel" placeholder="Ej. 7761234567" value={phone} onChange={e=>setPhone(e.target.value)}/>
            </div>
          </div>

          {absentCount > 0 ? (
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>Mensaje (puedes editarlo antes de enviar)</span>
                {edited && <button className="btn" onClick={restore} style={{background:"none",color:C.gold,border:"none",fontSize:11,fontWeight:700,padding:0,fontFamily:"inherit"}}>↺ Restaurar</button>}
              </div>
              <textarea className="inp" value={msg} rows={12}
                onChange={e=>{ setMsg(e.target.value); setEdited(true); }}
                style={{resize:"vertical",lineHeight:1.4,fontSize:"14px",minHeight:220}}/>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>Tip: el texto entre *asteriscos* sale en negritas en WhatsApp.</div>
            </div>
          ) : (
            <div style={{fontSize:12,color:C.muted,background:C.surface,borderRadius:10,padding:"10px 12px"}}>
              No hay faltas en esta fecha. Puedes guardar el contacto para usarlo después.
            </div>
          )}

          {error && <div style={{color:C.danger,fontSize:12}}>{error}</div>}

          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {absentCount > 0 && (
              <button className="btn" onClick={send} disabled={busy}
                style={{flex:"1 1 200px",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
                📲 Enviar por WhatsApp ({absentCount} falta{absentCount===1?"":"s"})
              </button>
            )}
            <button className="btn" onClick={saveOnly} disabled={busy}
              style={{flex:"1 1 120px",background:`${C.gold}22`,color:C.gold,border:`1.5px solid ${C.gold}66`,borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
              {busy ? "Guardando..." : "💾 Guardar contacto"}
            </button>
            <button className="btn" onClick={onClose}
              style={{flex:"0 0 auto",background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",fontSize:13,fontFamily:"inherit"}}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
