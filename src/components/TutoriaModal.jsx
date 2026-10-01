import { useState } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { cleanPhone } from "../lib/whatsapp";

// Configura el contacto de Tutorías del grupo (nombre + WhatsApp) y, al guardar,
// permite enviar el reporte de faltas del día.
export default function TutoriaModal({ session, absentCount, onSave, onSend, onClose }) {
  const [name,  setName]  = useState(session.tutoria_name  || "");
  const [phone, setPhone] = useState(session.tutoria_phone || "");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  async function save(andSend) {
    if (!phone.trim()) { setError("El teléfono es requerido"); return; }
    setBusy(true); setError("");
    const cleaned = cleanPhone(phone.trim());
    const { error:err } = await sb.from("sessions")
      .update({ tutoria_name: name.trim() || null, tutoria_phone: cleaned })
      .eq("id", session.id);
    setBusy(false);
    if (err) {
      setError(err.message.includes("tutoria")
        ? "Falta ejecutar supabase_tutoria_migration.sql en Supabase"
        : err.message);
      return;
    }
    const updated = { ...session, tutoria_name: name.trim() || null, tutoria_phone: cleaned };
    onSave(updated);
    if (andSend) onSend(updated);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.gold}55`,borderRadius:20,padding:28,width:"100%",maxWidth:420,boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
          <div style={{width:46,height:46,borderRadius:14,background:`${C.gold}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🏫</div>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:C.text}}>Contacto de Tutorías</div>
            <div style={{color:C.muted,fontSize:13,marginTop:2}}>{session.name}</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Nombre del tutor(a) del grupo (opcional)</div>
            <input className="inp" placeholder="Ej. Mtra. Laura Pérez" value={name} autoFocus onChange={e=>setName(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Teléfono WhatsApp</div>
            <input className="inp" type="tel" placeholder="Ej. 7761234567" value={phone}
              onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save(false)}/>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>10 dígitos sin código de país · se agrega +52 automáticamente</div>
          </div>
          {error && <div style={{color:C.danger,fontSize:12}}>{error}</div>}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button className="btn" onClick={()=>save(false)} disabled={busy}
              style={{flex:1,background:`${C.gold}22`,color:C.gold,border:`1.5px solid ${C.gold}66`,borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
              {busy ? "Guardando..." : "💾 Guardar"}
            </button>
            <button className="btn" onClick={onClose}
              style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",fontSize:14,fontFamily:"inherit"}}>
              Cancelar
            </button>
          </div>
          {absentCount > 0 && (
            <button className="btn" onClick={()=>save(true)} disabled={busy}
              style={{background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
              📲 Guardar y enviar reporte ({absentCount} falta{absentCount===1?"":"s"})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
