import { useState } from "react";
import { C } from "../lib/constants";
import { Z } from "../lib/design";

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
    <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:"#1e293b",border:`1px solid ${C.border}`,color:C.text,padding:"12px 24px",borderRadius:12,fontSize:14,fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",zIndex:Z.toast,animation:"toastIn .3s ease",whiteSpace:"nowrap",maxWidth:"calc(100vw - 32px)",overflow:"hidden",textOverflow:"ellipsis"}} role="status" aria-live="polite">
      {msg}
    </div>
  );
}

// ── Estados de carga ──────────────────────────────────────────────
export function Spinner({ size = 14, color, style }) {
  return <span className="spin" aria-hidden="true" style={{width:size,height:size,color,...style}}/>;
}

// Bloque gris con brillo que ocupa el lugar del contenido mientras carga
export function Skeleton({ w = "100%", h = 14, r = 8, style }) {
  return <div className="sk" aria-hidden="true" style={{width:w,height:h,borderRadius:r,...style}}/>;
}

// Lista de tarjetas "fantasma" (clases, alumnos, actividades…)
export function SkeletonList({ rows = 4, avatar = true, lines = 2, label = "Cargando…" }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:10}}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",display:"flex",gap:12,alignItems:"center",opacity:1 - i * 0.12}}>
          {avatar && <Skeleton w={44} h={44} r={12}/>}
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
            <Skeleton w={`${62 - (i % 3) * 10}%`} h={14}/>
            {lines > 1 && <Skeleton w={`${40 + (i % 2) * 15}%`} h={10}/>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Barra de progreso delgada arriba de la pantalla (cargas que no bloquean)
export function TopProgress({ show }) {
  return show ? <div className="topbar" role="progressbar" aria-label="Cargando"/> : null;
}

// Pantalla completa de carga (arranque de la app)
export function LoadingScreen({ msg = "Cargando…" }) {
  return (
    <div role="status" aria-live="polite" style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",gap:14,alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>
      <BrandMark size={56}/>
      <span style={{color:C.muted,fontSize:14}}>{msg}</span>
    </div>
  );
}

// Contenido de un botón que está guardando: spinner + texto
export function BusyLabel({ busy, children, busyText = "Guardando…" }) {
  return busy ? <span style={{display:"inline-flex",alignItems:"center",gap:8,justifyContent:"center"}}><Spinner size={14}/>{busyText}</span> : children;
}

export function Glow({ top, bottom, left, right, color, size="45vw" }) {
  return (
    <div style={{
      position:"fixed",top,bottom,left,right,
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
  const color = t ? C.accent : C.warning;
  const label = t ? "Docente" : role==="admin" ? "Admin" : "Lectura";
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

// Figura animada de la app (en lugar de un logo): tres órbitas en guinda, verde y
// dorado girando alrededor de una palomita que se dibuja una y otra vez.
export function BrandMark({ size = 28, style }) {
  return (
    <svg className="bm" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="AppProf" style={{flexShrink:0,display:"block",...style}}>
      <circle cx="24" cy="24" r="21" fill="none" stroke="#9D2449" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 62" className="bm-o1"/>
      <circle cx="24" cy="24" r="15.5" fill="none" stroke="#00a87e" strokeWidth="3" strokeLinecap="round" strokeDasharray="44 53" className="bm-o2"/>
      <circle cx="24" cy="24" r="10" fill="none" stroke="#B38E5D" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="22 41" className="bm-o3"/>
      <path d="M18.5 24.5 L22.5 28.5 L30 20" fill="none" stroke="#e8f5f1" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="bm-check"/>
    </svg>
  );
}

export function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      .bm-o1,.bm-o2,.bm-o3{transform-origin:24px 24px;}
      .bm-o1{animation:bmSpin 3.2s linear infinite;}
      .bm-o2{animation:bmSpin 2.3s linear infinite reverse;}
      .bm-o3{animation:bmSpin 4.4s linear infinite;}
      .bm-check{stroke-dasharray:1;stroke-dashoffset:1;animation:bmDraw 3.2s ease-in-out infinite;}
      @keyframes bmSpin{to{transform:rotate(360deg);}}
      @keyframes bmDraw{0%,8%{stroke-dashoffset:1;}35%,80%{stroke-dashoffset:0;}100%{stroke-dashoffset:-1;}}
      @media (prefers-reduced-motion: reduce){.bm *{animation:none!important;stroke-dashoffset:0!important;}}
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
      /* ══ Estados de interacción (ver DESIGN.md) ══
         reposo → hover (solo con mouse) → presionado → foco con teclado → deshabilitado / ocupado */
      html{-webkit-tap-highlight-color:transparent;}
      .btn,.chip,.row-hover{touch-action:manipulation;-webkit-user-select:none;user-select:none;}
      .btn{cursor:pointer;border:none;min-height:36px;position:relative;
        transition:filter .18s ease, transform .12s ease, box-shadow .18s ease, background-color .18s ease, color .18s ease, opacity .18s ease;}
      @media (hover:hover){
        .btn:hover:not(:disabled):not([aria-busy="true"]){filter:brightness(1.15);}
        .chip:hover:not(:disabled){filter:brightness(1.2);}
        .row-hover:hover{background-color:rgba(255,255,255,0.035)!important;}
      }
      .btn:active:not(:disabled):not([aria-busy="true"]),.chip:active:not(:disabled){transform:scale(.96);filter:brightness(.92);}
      .row-hover:active{transform:scale(.99);}
      .btn:focus-visible,.chip:focus-visible,.row-hover:focus-visible{outline:2px solid ${C.gold};outline-offset:2px;}
      .btn:focus:not(:focus-visible),.chip:focus:not(:focus-visible){outline:none;}
      .btn:disabled,.chip:disabled{opacity:.5;cursor:not-allowed;filter:grayscale(.3);}
      .btn[aria-busy="true"]{cursor:progress;opacity:.85;}
      .btn[aria-pressed="true"]{box-shadow:inset 0 0 0 1px rgba(255,255,255,.28);}
      .is-loading{opacity:.55;pointer-events:none;transition:opacity .2s;}
      .inp{background:${C.surface};border:1.5px solid ${C.border};color:${C.text};border-radius:8px;padding:10px 14px;font-size:15px!important;font-family:'Inter',sans-serif;transition:border-color .18s, box-shadow .18s;width:100%;}
      @media (hover:hover){ .inp:hover:not(:disabled):not(:focus){border-color:${C.muted}88;} }
      .inp:focus{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accent}33;}
      .inp:disabled{opacity:.55;cursor:not-allowed;}
      .inp[aria-invalid="true"]{border-color:${C.danger};box-shadow:0 0 0 3px ${C.danger}22;}

      /* ══ Estados de carga ══ */
      .sk{position:relative;overflow:hidden;background:${C.border}66;border-radius:8px;}
      .sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);animation:skShine 1.3s ease-in-out infinite;}
      @keyframes skShine{to{transform:translateX(100%);}}
      .spin{display:inline-block;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:spin .7s linear infinite;vertical-align:-2px;flex-shrink:0;}
      @keyframes spin{to{transform:rotate(360deg);}}
      .topbar{position:fixed;top:0;left:0;right:0;height:3px;z-index:${Z.overlay};overflow:hidden;pointer-events:none;}
      .topbar::after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-40%;
        background:linear-gradient(90deg,${C.guinda},${C.success},${C.gold});animation:topbar 1.1s ease-in-out infinite;}
      @keyframes topbar{to{left:100%;}}
      @keyframes pop{0%{transform:scale(1);}40%{transform:scale(1.08);}100%{transform:scale(1);}}
      .pop{animation:pop .22s ease;}
      @media (prefers-reduced-motion: reduce){
        *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;}
        .sk::after,.topbar::after{animation:none!important;}
        .spin{animation:spin 1.6s linear infinite!important;}
      }
      .inp::placeholder{color:${C.muted};}
      select.inp option{background:${C.surface};color:${C.text};}
      textarea.inp{font-family:'Inter',sans-serif;}
      .tab-on{color:${C.text}!important;border-bottom:2px solid ${C.accent}!important;}
      .row-hover{transition:background .15s;}
      .row-hover:hover{background:rgba(255,255,255,0.03)!important;}
      .chip{cursor:pointer;transition:all .15s;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;border:1.5px solid;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
      @keyframes slideIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:none;}}
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
