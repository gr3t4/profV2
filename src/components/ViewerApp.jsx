import { useState, useEffect } from "react";
import { sb } from "../lib/supabase";
import { C, STATUS, today, fmtDate } from "../lib/constants";
import { GlobalStyles, Glow, Empty } from "./Shared";

const todayStr = today();

function pctColor(p) {
  if (p === null) return C.muted;
  if (p >= 80) return C.success;
  if (p >= 60) return C.warning;
  return C.danger;
}

// ── Barra segmentada ────────────────────────────────────────────
function SegBar({ counts, total, height = 8 }) {
  if (!total) return <div style={{background:C.border,borderRadius:4,height,marginTop:6}}/>;
  return (
    <div style={{background:C.border,borderRadius:4,height,overflow:"hidden",display:"flex",marginTop:6}}>
      {[{v:counts.present,c:C.success},{v:counts.late,c:C.late},{v:counts.excused,c:C.excused},{v:counts.absent,c:C.danger}]
        .map((s,i)=><div key={i} style={{height:"100%",width:`${(s.v/total)*100}%`,background:s.c,transition:"width .5s ease"}}/>)}
    </div>
  );
}

// ── Anillo de porcentaje SVG ─────────────────────────────────────
function Ring({ pct, size = 72, stroke = 7 }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = pct !== null ? (circ * (1 - pct / 100)) : circ;
  const color = pctColor(pct);
  return (
    <svg width={size} height={size} style={{flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:"stroke-dashoffset .6s ease"}}/>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill={color} fontSize={size*0.22} fontWeight="800" fontFamily="Sora,sans-serif">
        {pct !== null ? pct+"%" : "—"}
      </text>
    </svg>
  );
}

// ── Tarjeta de grupo en la lista ─────────────────────────────────
function GroupCard({ session, isActive, onClick }) {
  const { counts, total } = session;
  const pct = total > 0 ? Math.round(((counts.present+counts.late+counts.excused)/total)*100) : null;
  const registered = counts.present + counts.late + counts.excused + counts.absent;
  const progress = total > 0 ? Math.round((registered/total)*100) : 0;

  return (
    <div onClick={onClick} className="row-hover" style={{
      background: isActive ? `${C.accent}14` : C.card,
      border: `1px solid ${isActive ? C.accent : C.border}`,
      borderLeft: `3px solid ${pctColor(pct)}`,
      borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all .18s"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <Ring pct={pct} size={52} stroke={5}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.name}</div>
          <div style={{color:C.muted,fontSize:11,marginTop:2}}>👤 {session.ownerName}</div>
          <div style={{display:"flex",gap:8,marginTop:5,fontSize:11,flexWrap:"wrap"}}>
            <span style={{color:C.success}}>✅{counts.present}</span>
            <span style={{color:C.late}}>🕐{counts.late}</span>
            <span style={{color:C.excused}}>📝{counts.excused}</span>
            <span style={{color:C.danger}}>❌{counts.absent}</span>
            {counts.pending>0&&<span style={{color:C.muted}}>⏳{counts.pending}</span>}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:11,color:C.muted}}>{registered}/{total}</div>
          <div style={{fontSize:10,color:C.muted,marginTop:2}}>registrados</div>
        </div>
      </div>
      <SegBar counts={counts} total={total} height={5}/>
    </div>
  );
}

// ── Detalle de grupo ─────────────────────────────────────────────
function GroupDetail({ session, students, attendance, onClose }) {
  const [filter, setFilter] = useState("all");
  const getStatus = id => attendance[id]?.status || "pending";

  const counts = {
    present: students.filter(s=>getStatus(s.id)==="present").length,
    late:    students.filter(s=>getStatus(s.id)==="late").length,
    excused: students.filter(s=>getStatus(s.id)==="excused").length,
    absent:  students.filter(s=>getStatus(s.id)==="absent").length,
    pending: students.filter(s=>getStatus(s.id)==="pending").length,
  };
  const pct = students.length > 0
    ? Math.round(((counts.present+counts.late+counts.excused)/students.length)*100) : 0;

  const filtered = students.filter(s => filter==="all" ? true : getStatus(s.id)===filter);

  return (
    <div style={{animation:"fadeUp .3s ease both"}}>
      {/* Header */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"22px 24px",marginBottom:16,position:"relative"}}>
        <button className="btn" onClick={onClose}
          style={{position:"absolute",top:14,right:14,background:`${C.border}`,color:C.muted,border:"none",borderRadius:8,padding:"4px 10px",fontSize:13}}>
          ✕
        </button>
        <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:18}}>
          <Ring pct={pct} size={80} stroke={7}/>
          <div>
            <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:18,color:C.text}}>{session.name}</div>
            <div style={{color:C.muted,fontSize:13,marginTop:4}}>👤 {session.ownerName}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:2}}>📅 {fmtDate(todayStr)}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
          {[
            {label:"Presentes",  v:counts.present, color:C.success, icon:"✅"},
            {label:"Retardos",   v:counts.late,    color:C.late,    icon:"🕐"},
            {label:"Justif.",    v:counts.excused, color:C.excused, icon:"📝"},
            {label:"Ausentes",   v:counts.absent,  color:C.danger,  icon:"❌"},
            {label:"Pendientes", v:counts.pending, color:C.muted,   icon:"⏳"},
          ].map(st=>(
            <div key={st.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
              <div style={{fontSize:18}}>{st.icon}</div>
              <div style={{fontSize:20,fontWeight:700,color:st.color,fontFamily:"'Sora',sans-serif"}}>{st.v}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>{st.label}</div>
            </div>
          ))}
        </div>
        <SegBar counts={counts} total={students.length} height={8}/>
      </div>

      {/* Filtros */}
      <div className="tabs-scroll" style={{marginBottom:12}}>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {[["all","Todos",C.accent],["present","Presentes",C.success],["late","Retardos",C.late],
            ["excused","Justificadas",C.excused],["absent","Ausentes",C.danger],["pending","Pendientes",C.muted]].map(([f,l,color])=>(
            <button key={f} className="btn chip" onClick={()=>setFilter(f)}
              style={{background:filter===f?`${color}22`:"transparent",color:filter===f?color:C.muted,borderColor:filter===f?color:C.border}}>
              {l} {filter===f&&`(${filtered.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length===0 ? <Empty icon="👥" msg="Sin alumnos en este filtro"/> : (
        <div style={{display:"grid",gap:6,maxHeight:"calc(100vh - 420px)",overflowY:"auto",paddingRight:4}}>
          {filtered.map((s,i)=>{
            const st  = getStatus(s.id);
            const cfg = STATUS[st];
            const reason = attendance[s.id]?.reason||"";
            return (
              <div key={s.id} style={{background:C.card,border:`1px solid ${cfg.color}22`,borderLeft:`3px solid ${cfg.color}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,animation:`slideIn .2s ease both`,animationDelay:`${i*.015}s`}}>
                <div style={{width:32,height:32,borderRadius:8,background:`${cfg.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:cfg.color,flexShrink:0}}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                  {st==="excused"&&reason&&<div style={{fontSize:10,color:C.muted,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📝 {reason}</div>}
                </div>
                <span style={{background:`${cfg.color}18`,color:cfg.color,border:`1px solid ${cfg.color}33`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700,flexShrink:0}}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ViewerApp ────────────────────────────────────────────────────
export default function ViewerApp({ user, onLogout }) {
  const [sessions, setSessions]           = useState([]);
  const [selected, setSelected]           = useState(null);
  const [students, setStudents]           = useState([]);
  const [attendance, setAttendance]       = useState({});
  const [loading, setLoading]             = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch]               = useState("");
  const [lastUpdate, setLastUpdate]       = useState(null);
  const [filterRisk, setFilterRisk]       = useState("all"); // all | ok | warning | danger

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 60000);
    return () => clearInterval(iv);
  }, []);

  async function loadAll() {
    const { data: sessData } = await sb.from("sessions")
      .select("id,name,date,owner_id,owner:users(id,name)")
      .order("name");
    if (!sessData) { setLoading(false); return; }

    const enriched = await Promise.all(sessData.map(async s => {
      const [{ data: studs }, { data: att }] = await Promise.all([
        sb.from("students").select("id").eq("session_id", s.id),
        sb.from("attendance").select("student_id,status").eq("session_id", s.id).eq("date", todayStr),
      ]);
      const total = studs?.length || 0;
      const counts = { present:0, late:0, excused:0, absent:0, pending:0 };
      (att||[]).forEach(a => { if (counts[a.status]!==undefined) counts[a.status]++; });
      counts.pending = total - (counts.present+counts.late+counts.excused+counts.absent);
      const pct = total > 0 ? Math.round(((counts.present+counts.late+counts.excused)/total)*100) : null;
      const risk = pct===null?"pending":pct>=80?"ok":pct>=60?"warning":"danger";
      return { ...s, ownerName:s.owner?.name||"—", total, counts, pct, risk };
    }));

    setSessions(enriched);
    setLastUpdate(new Date());
    setLoading(false);
    if (selected) {
      const upd = enriched.find(s=>s.id===selected.id);
      if (upd) { setSelected(upd); loadDetail(upd, false); }
    }
  }

  async function loadDetail(session, showLoader=true) {
    if (showLoader) setLoadingDetail(true);
    setSelected(session);
    const [{ data: studs }, { data: att }] = await Promise.all([
      sb.from("students").select("*").eq("session_id", session.id).order("name"),
      sb.from("attendance").select("student_id,status,reason").eq("session_id", session.id).eq("date", todayStr),
    ]);
    const attMap = {};
    (att||[]).forEach(a => { attMap[a.student_id] = { status:a.status, reason:a.reason||"" }; });
    setStudents(studs||[]);
    setAttendance(attMap);
    setLoadingDetail(false);
  }

  // Totales globales
  const G = sessions.reduce((a,s)=>({
    present: a.present+s.counts.present, late: a.late+s.counts.late,
    excused: a.excused+s.counts.excused, absent: a.absent+s.counts.absent,
    pending: a.pending+s.counts.pending, total: a.total+s.total,
  }), {present:0,late:0,excused:0,absent:0,pending:0,total:0});
  const globalPct = G.total>0 ? Math.round(((G.present+G.late+G.excused)/G.total)*100) : null;

  const riskCount = {
    danger:  sessions.filter(s=>s.risk==="danger").length,
    warning: sessions.filter(s=>s.risk==="warning").length,
    ok:      sessions.filter(s=>s.risk==="ok").length,
    pending: sessions.filter(s=>s.risk==="pending").length,
  };

  const displayed = sessions.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                        s.ownerName.toLowerCase().includes(search.toLowerCase());
    const matchRisk = filterRisk==="all" || s.risk===filterRisk;
    return matchSearch && matchRisk;
  });

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter',sans-serif",color:C.text}}>
      <GlobalStyles/>
      <Glow top="-15%" right="-5%" color="27,58,138" size="40vw"/>
      <Glow bottom="-10%" left="-5%" color="200,160,32" size="35vw"/>

      {/* Header */}
      <div style={{height:3,background:"linear-gradient(90deg,#b71c1c 33%,#1b3a8a 66%,#c8a020 100%)"}}/>
      <header style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 20px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/dgti-logo.png" alt="CBTIS 179" style={{height:26,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>
            <span style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:17,color:C.text}}>AppProf</span>
            <span style={{background:`${C.teal}22`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,letterSpacing:.5}}>VISOR</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {lastUpdate&&<span style={{fontSize:11,color:C.muted}}>🔄 {lastUpdate.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</span>}
            <span className="hide-mobile" style={{fontSize:13,color:C.muted}}>👤 {user.name}</span>
            <button className="btn" onClick={loadAll}
              style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"5px 12px",fontSize:12,fontFamily:"inherit",fontWeight:600}}>
              🔄
            </button>
            <button className="btn" onClick={onLogout}
              style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:8,padding:"6px 14px",fontSize:13,fontFamily:"inherit"}}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <main style={{maxWidth:1400,margin:"0 auto",padding:"20px 16px",position:"relative",zIndex:1}}>

        {/* Título */}
        <div style={{marginBottom:16}}>
          <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800}}>Monitor de asistencia</h2>
          <p style={{color:C.muted,fontSize:13,marginTop:3}}>📅 {fmtDate(todayStr)} · {sessions.length} grupos activos</p>
        </div>

        {/* Dashboard global */}
        {!loading && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"20px 24px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
              {/* Anillo grande */}
              <Ring pct={globalPct} size={100} stroke={9}/>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:1.5,marginBottom:10}}>RESUMEN INSTITUCIONAL — HOY</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:10}}>
                  {[
                    {label:"Presentes",  v:G.present, color:C.success, icon:"✅"},
                    {label:"Retardos",   v:G.late,    color:C.late,    icon:"🕐"},
                    {label:"Justif.",    v:G.excused, color:C.excused, icon:"📝"},
                    {label:"Ausentes",   v:G.absent,  color:C.danger,  icon:"❌"},
                    {label:"Pendientes", v:G.pending, color:C.muted,   icon:"⏳"},
                  ].map(st=>(
                    <div key={st.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                      <div style={{fontSize:16}}>{st.icon}</div>
                      <div style={{fontSize:20,fontWeight:700,color:st.color,fontFamily:"'Sora',sans-serif"}}>{st.v}</div>
                      <div style={{color:C.muted,fontSize:10,marginTop:1}}>{st.label}</div>
                    </div>
                  ))}
                </div>
                <SegBar counts={G} total={G.total} height={10}/>
              </div>
              {/* Semáforo de grupos */}
              <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:140}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:1}}>GRUPOS POR ESTADO</div>
                {[
                  {label:"Asistencia alta",  count:riskCount.ok,      color:C.success, icon:"🟢"},
                  {label:"Asistencia media", count:riskCount.warning,  color:C.warning, icon:"🟡"},
                  {label:"Asistencia baja",  count:riskCount.danger,   color:C.danger,  icon:"🔴"},
                  {label:"Sin registros",    count:riskCount.pending,  color:C.muted,   icon:"⚪"},
                ].map(r=>(
                  <div key={r.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <span>{r.icon}</span>
                    <span style={{color:C.muted,flex:1}}>{r.label}</span>
                    <span style={{fontWeight:700,color:r.color}}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{textAlign:"center",padding:"60px 0",color:C.muted,fontSize:14}}>Cargando grupos...</div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:selected?"minmax(280px,360px) 1fr":"1fr",gap:20,alignItems:"start"}}>

            {/* Panel izquierdo — lista */}
            <div>
              {/* Buscador + filtro riesgo */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar grupo o docente..."
                  style={{flex:1,background:"transparent",border:"none",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                {search&&<button className="btn" onClick={()=>setSearch("")} style={{background:"none",color:C.muted,border:"none",fontSize:15,padding:"0 2px"}}>×</button>}
              </div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                {[["all","Todos",C.accent],["ok","Alta",C.success],["warning","Media",C.warning],["danger","Baja",C.danger],["pending","Sin reg.",C.muted]].map(([k,l,color])=>(
                  <button key={k} className="btn chip" onClick={()=>setFilterRisk(k)}
                    style={{background:filterRisk===k?`${color}22`:"transparent",color:filterRisk===k?color:C.muted,borderColor:filterRisk===k?color:C.border,fontSize:11,padding:"4px 10px"}}>
                    {l}
                  </button>
                ))}
              </div>

              {displayed.length===0 ? <Empty icon="📚" msg="Sin grupos"/> : (
                <div style={{display:"grid",gap:8,maxHeight:"calc(100vh - 340px)",overflowY:"auto",paddingRight:4}}>
                  {displayed.map(s=>(
                    <GroupCard key={s.id} session={s} isActive={selected?.id===s.id} onClick={()=>loadDetail(s)}/>
                  ))}
                </div>
              )}
            </div>

            {/* Panel derecho — detalle */}
            {selected && (
              <div style={{position:"sticky",top:76}}>
                {loadingDetail ? (
                  <div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>Cargando...</div>
                ) : (
                  <GroupDetail
                    session={selected} students={students} attendance={attendance}
                    onClose={()=>setSelected(null)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
