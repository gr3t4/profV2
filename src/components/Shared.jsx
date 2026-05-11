import { useState } from "react";
import { C } from "../lib/constants";

export function Empty({ icon, msg }) {
  return (
    <div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>
      <div style={{fontSize:46,marginBottom:12}}>{icon}</div>
      <p style={{fontSize:14}}>{msg}</p>
    </div>
  );
}

export function Toast({ msg }) {
  return (
    <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:"#1e293b",border:`1px solid ${C.border}`,color:C.text,padding:"12px 24px",borderRadius:12,fontSize:14,fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",zIndex:1000,animation:"toastIn .3s ease",whiteSpace:"nowrap"}}>
      {msg}
    </div>
  );
}

export function Glow({ top, bottom, left, right, color, size="45vw" }) {
  return (
    <div style={{
      position:"absolute",top,bottom,left,right,
      width:size,height:size,borderRadius:"50%",
      background:`radial-gradient(circle,rgba(${color},0.07) 0%,transparent 70%)`,
      pointerEvents:"none",zIndex:0,
    }}/>
  );
}

export function Pill({ color, label }) {
  return <span style={{background:`${color}18`,color,border:`1px solid ${color}33`,borderRadius:6,padding:"3px 10px",fontSize:12}}>{label}</span>;
}

export function Avatar({ name }) {
  return (
    <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${C.accent}33,${C.purple}33)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:C.accent,flexShrink:0}}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}

export function StatusBadge({ active }) {
  return (
    <span style={{background:active?`${C.success}18`:`${C.danger}18`,color:active?C.success:C.danger,border:`1px solid ${active?C.success:C.danger}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
      {active?"Activo":"Inactivo"}
    </span>
  );
}

export function RoleBadge({ role }) {
  const t = role==="teacher";
  const s = role==="student";
  const color = t ? C.accent : s ? C.teal : C.warning;
  const label = t ? "Docente" : s ? "Alumno" : role==="admin" ? "Admin" : "Lectura";
  return (
    <span style={{background:`${color}18`,color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
      {label}
    </span>
  );
}

export function AddStudentInline({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  function submit() { if(!name.trim()) return; onAdd(name.trim()); setName(""); setOpen(false); }
  if (!open) return (
    <button className="btn" onClick={()=>setOpen(true)} style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
      + Alumno
    </button>
  );
  return (
    <div style={{display:"flex",gap:8,animation:"fadeUp .2s ease"}}>
      <input className="inp" placeholder="Nombre del alumno" value={name} autoFocus onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{width:220}}/>
      <button className="btn" onClick={submit} style={{background:C.success,color:"#fff",borderRadius:10,padding:"9px 12px",fontSize:13,fontFamily:"inherit",border:"none"}}>✓</button>
      <button className="btn" onClick={()=>setOpen(false)} style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 10px",fontSize:13}}>✕</button>
    </div>
  );
}

export function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      html{
        -webkit-text-size-adjust:100%;
        height:100%;
        overflow-y:auto;
        overflow-x:hidden;
        -webkit-overflow-scrolling:touch;
      }
      body{
        background:${C.bg};
        overflow-x:hidden;
        overflow-y:auto;
        -webkit-overflow-scrolling:touch;
        width:100%;
        max-width:100vw;
        font-family:'Inter',sans-serif;
        min-height:100%;
        position:relative;
      }
      #root{
        min-height:100vh;
        overflow-x:hidden;
        width:100%;
      }
      input,select,textarea{outline:none;-webkit-appearance:none;border-radius:8px;}
      ::-webkit-scrollbar{width:5px;height:5px;}
      ::-webkit-scrollbar-track{background:${C.surface};}
      ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
      .btn{cursor:pointer;border:none;transition:all .18s;min-height:36px;}
      .btn:hover{filter:brightness(1.12);}
      .btn:active{filter:brightness(.95);}
      .inp{background:${C.surface};border:1.5px solid ${C.border};color:${C.text};border-radius:8px;padding:10px 14px;font-size:15px!important;font-family:'Inter',sans-serif;transition:border-color .2s;width:100%;}
      .inp:focus{border-color:${C.accent};}
      .inp::placeholder{color:${C.muted};}
      textarea.inp{font-family:'Inter',sans-serif;}
      .tab-on{color:${C.text}!important;border-bottom:2px solid ${C.accent}!important;}
      .row-hover{transition:background .15s;}
      .row-hover:hover{background:rgba(255,255,255,0.03)!important;}
      .chip{cursor:pointer;transition:all .15s;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;border:1.5px solid;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
      @keyframes slideIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}
      @keyframes toastIn{from{opacity:0;transform:translateY(14px) scale(.93);}to{opacity:1;transform:translateY(0) scale(1);}}

      /* ── Responsive grid helpers ── */
      .grid-stats-6{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;}
      .grid-stats-5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
      .grid-stats-3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
      .grid-new-user{display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:10px;align-items:end;}
      .header-actions{display:flex;align-items:center;gap:10px;}
      .session-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}
      .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center;}
      .toolbar-right{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap;}
      .student-row-actions{display:flex;gap:6px;align-items:center;flex-shrink:0;}
      .overflow-x{overflow-x:auto;-webkit-overflow-scrolling:touch;}
      .tabs-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
      .tabs-scroll::-webkit-scrollbar{display:none;}
      .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap;}
      .card-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}

      /* ── Tablet (≤900px) ── */
      @media(max-width:900px){
        .grid-stats-6{grid-template-columns:repeat(3,1fr);}
        .grid-new-user{grid-template-columns:1fr 1fr;row-gap:10px;}
        .grid-new-user>:nth-child(3){grid-column:1/-1;}
        .grid-new-user>:last-child{grid-column:1/-1;}
      }

      /* ── Phablet (≤640px) ── */
      @media(max-width:640px){
        main{padding:12px 10px!important;}
        .btn:hover{filter:none!important;}
        .chip{padding:6px 10px!important;font-size:11px!important;}
        .grid-stats-6{grid-template-columns:repeat(3,1fr);gap:8px;}
        .grid-stats-5{grid-template-columns:repeat(3,1fr);gap:8px;}
        .grid-stats-3{grid-template-columns:repeat(3,1fr);gap:8px;}
        .grid-new-user{grid-template-columns:1fr;row-gap:8px;}
        .grid-new-user>*{grid-column:1/-1!important;}
        .header-actions .hide-mobile{display:none!important;}
        .session-header{flex-direction:column;align-items:flex-start;gap:10px;}
        .toolbar{gap:6px;}
        .toolbar-right{margin-left:0;width:100%;}
        .student-row-actions{flex-wrap:wrap;gap:4px;}
        .hide-mobile{display:none!important;}
        .page-header{flex-direction:column;align-items:flex-start;}
        .page-header>*:last-child{width:100%;}
        .card-actions{flex-wrap:wrap;}
      }

      /* ── Mobile (≤480px) ── */
      @media(max-width:480px){
        .grid-stats-6{grid-template-columns:repeat(2,1fr);gap:7px;}
        .grid-stats-5{grid-template-columns:repeat(2,1fr);gap:7px;}
        .grid-stats-3{grid-template-columns:repeat(2,1fr);gap:7px;}
        .chip{padding:5px 8px!important;font-size:10px!important;}
      }

      /* ── Small mobile (≤360px) ── */
      @media(max-width:360px){
        main{padding:8px!important;}
        .grid-stats-6,.grid-stats-5,.grid-stats-3{grid-template-columns:repeat(2,1fr);gap:6px;}
        .inp{padding:9px 10px;font-size:14px!important;}
        .btn{min-height:40px;}
      }
    `}</style>
  );
}
