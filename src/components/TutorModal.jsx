import { useState } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";

export default function TutorModal({ student, onSave, onClose }) {
  const [tutorName,  setTutorName]  = useState(student.tutor_name  || "");
  const [tutorPhone, setTutorPhone] = useState(student.tutor_phone || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Limpia el número: solo dígitos, agrega 52 si es México y no lo tiene
  function cleanPhone(raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return "52" + digits;          // 10 dígitos MX
    if (digits.length === 12 && digits.startsWith("52")) return digits;
    return digits;
  }

  async function save() {
    if (!tutorPhone.trim()) { setError("El teléfono es requerido"); return; }
    setBusy(true);
    const { error: err } = await sb.from("students")
      .update({ tutor_name: tutorName.trim(), tutor_phone: tutorPhone.trim() })
      .eq("id", student.id);
    if (err) { setError(err.message); setBusy(false); return; }
    onSave({ ...student, tutor_name: tutorName.trim(), tutor_phone: tutorPhone.trim() });
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid #25d36644`,borderRadius:20,padding:28,width:"100%",maxWidth:420,boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#25d36622",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📱</div>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:C.text}}>Datos del tutor</div>
            <div style={{color:C.muted,fontSize:13,marginTop:2}}>{student.name}</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Nombre del tutor (opcional)</div>
            <input className="inp" placeholder="Ej. María García" value={tutorName} autoFocus onChange={e=>setTutorName(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Teléfono WhatsApp</div>
            <input className="inp" type="tel" placeholder="Ej. 3312345678" value={tutorPhone}
              onChange={e=>setTutorPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}/>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>10 dígitos sin código de país · se agrega +52 automáticamente</div>
          </div>
          {error && <div style={{color:C.danger,fontSize:12}}>{error}</div>}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button className="btn" onClick={save} disabled={busy}
              style={{flex:1,background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
              {busy ? "Guardando..." : "💾 Guardar"}
            </button>
            <button className="btn" onClick={onClose}
              style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",fontSize:14,fontFamily:"inherit"}}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Función utilitaria para abrir WhatsApp ───────────────────────
export function sendWhatsApp({ student, date, sessionName, status, reason }) {
  const phone = student.tutor_phone?.replace(/\D/g, "");
  if (!phone) return false;

  const fullPhone = phone.length === 10 ? "52" + phone : phone;
  const tutorName = student.tutor_name ? `, ${student.tutor_name}` : "";
  const fmtDate = new Date(date + "T12:00:00").toLocaleDateString("es-MX", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  });

  const statusMsg = {
    absent:  "❌ *FALTA* — no asistió a clases",
    late:    "🕐 *RETARDO* — llegó tarde a clases",
    excused: `📝 *FALTA JUSTIFICADA*${reason ? ` — Motivo: ${reason}` : ""}`,
  }[status] || "ausencia registrada";

  const msg = `Estimado tutor${tutorName}:\n\nLe informamos que el alumno *${student.name}* registró ${statusMsg} el día *${fmtDate}* en la materia/grupo *${sessionName}*.\n\nPor favor comuníquese con la institución si tiene alguna duda.\n\n_CBTIS 179 — AppProf_`;

  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
  return true;
}
