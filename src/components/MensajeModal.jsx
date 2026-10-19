import { useState } from "react";
import { C } from "../lib/constants";

// Muestra el mensaje de faltas listo (docente, materia, fecha y alumnos con falta)
// para copiarlo y pegarlo donde se necesite (WhatsApp, correo, etc.).
export default function MensajeModal({ initial, title, onClose }) {
  const [msg, setMsg]       = useState(initial);
  const [copied, setCopied] = useState(false);
  const [error, setError]   = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      // Respaldo para navegadores sin acceso al portapapeles: seleccionar y copiar
      const ta = document.getElementById("msg-text");
      ta?.select();
      if (!document.execCommand?.("copy")) { setError("No se pudo copiar: mantén presionado el texto y elige «Copiar»."); return; }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:22,width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div style={{width:44,height:44,borderRadius:14,background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📋</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:16,color:C.text}}>Mensaje de faltas</div>
            <div style={{color:C.muted,fontSize:13,marginTop:2}}>{title}</div>
          </div>
        </div>
        <textarea id="msg-text" className="inp" value={msg} rows={13} onChange={e => setMsg(e.target.value)}
          style={{resize:"vertical",lineHeight:1.4,fontSize:"14px",minHeight:240}}/>
        <div style={{fontSize:11,color:C.muted,marginTop:5}}>Puedes ajustar el texto antes de copiarlo. El texto entre *asteriscos* sale en negritas en WhatsApp.</div>
        {error && <div style={{color:C.danger,fontSize:12,marginTop:8}}>{error}</div>}
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button className="btn" onClick={copy}
            style={{flex:1,background:copied?C.success:`linear-gradient(135deg,${C.accent},${C.teal})`,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
            {copied ? "✓ Copiado" : "📋 Copiar mensaje"}
          </button>
          <button className="btn" onClick={onClose}
            style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",fontSize:14,fontFamily:"inherit"}}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
