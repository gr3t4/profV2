import { useState, useEffect, useMemo } from "react";
import { sb, fetchAll } from "../lib/supabase";
import { C, BRAND, STATUS, TURNOS, today, fmtDate } from "../lib/constants";
import { GlobalStyles, Glow, Empty, BrandMark } from "./Shared";
import ViewerReports from "./ViewerReports";
import { tieneClase, inicioDelDia, bloquesDelDia } from "../lib/horario";

// true en pantallas angostas (celular)
function useIsMobile(bp = 760) {
  const q = `(max-width: ${bp}px)`;
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

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

// ── Tarjeta de grupo ─────────────────────────────────────────────
function GroupCard({ grupo, isActive, onClick }) {
  const d = grupo.dia;
  return (
    <div onClick={onClick} className="row-hover" style={{
      background: isActive ? `${C.accent}14` : C.card,
      border: `1px solid ${isActive ? C.accent : C.border}`,
      borderLeft: `3px solid ${pctColor(d.pct)}`,
      borderRadius: 12, padding: "12px 14px", cursor: "pointer", transition: "all .18s", minWidth: 0
    }}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <Ring pct={d.pct} size={52} stroke={5}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:16,color:C.text}}>Grupo {grupo.name}
            {!grupo.turno&&<span style={{color:C.warning,fontSize:11,fontWeight:500,marginLeft:6}}>· sin turno</span>}
          </div>
          <div style={{color:C.muted,fontSize:11,marginTop:2}}>
            📋 {d.tomadas} de {d.cols.length} clase{d.cols.length===1?"":"s"} con lista · {grupo.students.length} alumnos
          </div>
          <div style={{display:"flex",gap:10,marginTop:5,fontSize:11,flexWrap:"wrap"}}>
            {d.noVino>0&&<span style={{color:C.danger,fontWeight:700}}>🔴 {d.noVino} no vino{d.noVino===1?"":"eron"}</span>}
            {d.parcial>0&&<span style={{color:C.warning,fontWeight:700}}>🟠 {d.parcial} con faltas</span>}
            {d.conRetardo>0&&<span style={{color:C.late}}>🕐 {d.conRetardo}</span>}
            {d.tomadas>0&&!d.noVino&&!d.parcial&&<span style={{color:C.success}}>✅ Sin faltas</span>}
            {d.tomadas===0&&<span style={{color:C.muted}}>⏳ Sin listas todavía</span>}
          </div>
        </div>
      </div>
      <SegBar counts={d.counts} total={d.counts.total} height={5}/>
    </div>
  );
}

// ── Sábana del día de un grupo ───────────────────────────────────
function GroupDetail({ grupo, onClose, selectedDate, isMobile }) {
  const [filter, setFilter] = useState("all"); // all | faltas | novino | late
  const d = grupo.dia;
  const rows = d.rows.filter(r => filter==="all" ? true : filter==="faltas" ? r.absent>0 : filter==="novino" ? r.noVino : r.late>0);
  const cell = isMobile ? 26 : 32;
  const tpl = `minmax(0,1fr) repeat(${d.cols.length},${cell}px) ${isMobile?44:56}px`;

  return (
    <div style={{animation:"fadeUp .3s ease both"}}>
      {isMobile && (
        <button className="btn" onClick={onClose}
          style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit",marginBottom:12}}>
          ← Volver a grupos
        </button>
      )}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:isMobile?"16px 14px":"20px 22px",marginBottom:14,position:"relative"}}>
        {!isMobile && <button className="btn" onClick={onClose}
          style={{position:"absolute",top:14,right:14,background:`${C.border}`,color:C.muted,border:"none",borderRadius:8,padding:"4px 10px",fontSize:13}}>✕</button>}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
          <Ring pct={d.pct} size={isMobile?60:72} stroke={7}/>
          <div style={{minWidth:0}}>
            <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:isMobile?18:20}}>Grupo {grupo.name}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:3}}>📅 {fmtDate(selectedDate)}{grupo.turno?` · ${TURNOS[grupo.turno].icon} ${TURNOS[grupo.turno].label}`:""}</div>
            <div style={{fontSize:12,marginTop:4,display:"flex",gap:10,flexWrap:"wrap"}}>
              <span style={{color:C.danger,fontWeight:700}}>🔴 {d.noVino} no vino</span>
              <span style={{color:C.warning,fontWeight:700}}>🟠 {d.parcial} con faltas</span>
              <span style={{color:C.muted}}>{grupo.students.length} alumnos</span>
            </div>
          </div>
        </div>
        {/* Clases del día (columnas) */}
        {d.cols.length===0 ? (
          <div style={{fontSize:12,color:C.muted}}>No hay clases programadas ni listas tomadas este día.</div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:5}}>
            {d.cols.map((c,i)=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",minWidth:0}}>
                <span style={{width:20,height:20,borderRadius:6,background:`${C.accent}33`,color:C.text,fontWeight:800,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                <span style={{color:C.teal,fontWeight:700,flexShrink:0,minWidth:38}}>{c.inicio||"—"}</span>
                <span style={{flex:1,minWidth:0,overflowWrap:"anywhere"}}><b>{c.materia}</b> <span style={{color:C.muted}}>· {c.docente}</span></span>
                {c.tomada ? <span style={{color:C.success,fontSize:11,flexShrink:0}}>✓ lista</span> : <span style={{color:C.muted,fontSize:11,flexShrink:0}}>⏳ pendiente</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
        {[["all","Todos",C.accent,d.rows.length],["faltas","Con faltas",C.warning,d.noVino+d.parcial],["novino","No vino",C.danger,d.noVino],["late","Retardos",C.late,d.conRetardo]].map(([f,l,color,n])=>(
          <button key={f} className="btn chip" onClick={()=>setFilter(f)}
            style={{background:filter===f?`${color}22`:"transparent",color:filter===f?color:C.muted,borderColor:filter===f?color:C.border}}>
            {l} ({n})
          </button>
        ))}
      </div>

      {d.cols.length===0 ? null : rows.length===0 ? <Empty icon="👥" msg="Sin alumnos en este filtro"/> : (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:tpl,gap:3,padding:"7px 10px",background:C.surface,fontSize:10,color:C.muted,fontWeight:700,alignItems:"center"}}>
            <span>ALUMNO</span>
            {d.cols.map((c,i)=><span key={c.id} title={`${c.inicio||""} ${c.materia}`} style={{textAlign:"center"}}>{i+1}</span>)}
            <span style={{textAlign:"right"}}>FALTAS</span>
          </div>
          {rows.map(r=>(
            <div key={r.student.id} style={{display:"grid",gridTemplateColumns:tpl,gap:3,padding:"6px 10px",borderTop:`1px solid ${C.border}66`,alignItems:"center",fontSize:12,background:r.noVino?`${C.danger}10`:"transparent"}}>
              <span style={{overflowWrap:"anywhere",lineHeight:1.2}}>{r.student.name}</span>
              {d.cols.map(c=>{
                const st = r.cells[c.id]?.status || (c.tomada ? "pending" : null);
                const cfg = st ? STATUS[st] : null;
                return (
                  <span key={c.id} title={cfg ? `${c.materia}: ${cfg.label}${r.cells[c.id]?.reason?" — "+r.cells[c.id].reason:""}` : `${c.materia}: sin lista`}
                    style={{height:cell-6,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?11:12,
                      background:cfg?`${cfg.color}22`:"transparent",border:`1px solid ${cfg?cfg.color+"55":C.border}`,color:cfg?cfg.color:C.muted}}>
                    {cfg ? (st==="present"?"✓":st==="absent"?"✕":st==="late"?"R":st==="excused"?"J":"·") : ""}
                  </span>
                );
              })}
              <span style={{textAlign:"right",fontWeight:700,fontSize:11,color:r.noVino?C.danger:r.absent?C.warning:C.muted}}>
                {r.noVino ? "No vino" : r.reg ? `${r.absent}/${r.reg}` : "—"}
              </span>
            </div>
          ))}
          <div style={{padding:"7px 10px",fontSize:10,color:C.muted,borderTop:`1px solid ${C.border}66`}}>✓ presente · ✕ falta · R retardo · J justificada · · sin registro</div>
        </div>
      )}
    </div>
  );
}

// ── Informe de faltas: una fila por alumno y día ─────────────────
function AbsenceReport({ rows, selectedDate, search, setSearch, statusFilter, setStatusFilter }) {
  const q = search.toLowerCase();
  const filtered = rows.filter(r => {
    const matchSearch = !q || r.student.name.toLowerCase().includes(q) || r.grupo.name.toLowerCase().includes(q) ||
      r.items.some(it => it.clase.materia.toLowerCase().includes(q) || it.clase.docente.toLowerCase().includes(q));
    const matchStatus = statusFilter==="all" || (statusFilter==="novino" && r.noVino) || (statusFilter==="parcial" && r.absent>0 && !r.noVino)
      || (statusFilter==="late" && r.late>0) || (statusFilter==="excused" && r.excused>0);
    return matchSearch && matchStatus;
  });
  const n = (k) => rows.filter(r => k==="novino" ? r.noVino : k==="parcial" ? r.absent>0 && !r.noVino : k==="late" ? r.late>0 : r.excused>0).length;

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const header = ["Grupo","Alumno","Situación","Faltas","Clases con lista","Detalle por clase"];
    const dataRows = filtered.map(r => [r.grupo.name, r.student.name,
      r.noVino ? "No vino" : r.absent ? "Faltó a algunas clases" : r.late ? "Retardo" : "Justificada",
      r.absent, r.reg,
      r.items.map(it => `${it.clase.inicio||""} ${it.clase.materia} (${it.clase.docente}): ${STATUS[it.status]?.label}${it.reason?" — "+it.reason:""}`).join("; ")]);
    const ws = XLSX.utils.aoa_to_sheet([[`Faltas y retardos — ${selectedDate}`], [], header, ...dataRows]);
    ws["!cols"] = [{wch:8},{wch:34},{wch:22},{wch:7},{wch:15},{wch:90}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faltas");
    XLSX.writeFile(wb, `faltas_${selectedDate}.xlsx`);
  }

  return (
    <div style={{animation:"fadeUp .3s ease both"}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
        <span>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar alumno, grupo, materia o docente..."
          style={{flex:1,minWidth:0,background:"transparent",border:"none",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        {search&&<button className="btn" onClick={()=>setSearch("")} style={{background:"none",color:C.muted,border:"none",fontSize:15,padding:"0 2px"}}>×</button>}
        <button className="btn" onClick={exportXlsx}
          style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:8,padding:"6px 12px",fontSize:12,fontFamily:"inherit",fontWeight:600,flexShrink:0}}>
          📥 Excel
        </button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["all","Todos",C.accent,rows.length],["novino","No vino",C.danger,n("novino")],["parcial","Faltó a algunas",C.warning,n("parcial")],["late","Retardos",C.late,n("late")],["excused","Justificadas",C.excused,n("excused")]].map(([k,l,color,c])=>(
          <button key={k} className="btn chip" onClick={()=>setStatusFilter(k)}
            style={{background:statusFilter===k?`${color}22`:"transparent",color:statusFilter===k?color:C.muted,borderColor:statusFilter===k?color:C.border}}>
            {l} ({c})
          </button>
        ))}
      </div>
      {filtered.length===0 ? (
        <Empty icon="🎉" msg={`Sin faltas, retardos ni justificantes el ${fmtDate(selectedDate)}.`}/>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:6}}>
          {filtered.map((r,i) => {
            const color = r.noVino ? C.danger : r.absent ? C.warning : r.late ? C.late : C.excused;
            return (
              <div key={r.student.id} className="row-hover" style={{background:C.card,border:`1px solid ${color}33`,borderLeft:`3px solid ${color}`,borderRadius:10,padding:"10px 12px",minWidth:0,animation:`slideIn .2s ease both`,animationDelay:`${Math.min(i,20)*.015}s`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{flex:"1 1 160px",minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13}}>{r.student.name}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>👥 Grupo {r.grupo.name}</div>
                  </div>
                  <span style={{background:`${color}18`,color,border:`1px solid ${color}44`,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,flexShrink:0}}>
                    {r.noVino ? "🔴 No vino" : r.absent ? `🟠 Faltó a ${r.absent} de ${r.reg}` : r.late ? "🕐 Retardo" : "📝 Justificada"}
                  </span>
                </div>
                {!r.noVino && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:7}}>
                    {r.items.map(it => {
                      const cfg = STATUS[it.status];
                      return <span key={it.clase.id} title={it.reason||""} style={{background:`${cfg.color}18`,color:cfg.color,border:`1px solid ${cfg.color}44`,borderRadius:6,padding:"2px 7px",fontSize:11}}>
                        {cfg.icon} {it.clase.inicio ? it.clase.inicio+" " : ""}{it.clase.materia} <span style={{opacity:.75}}>· {it.clase.docente}</span>{it.reason?` · ${it.reason}`:""}
                      </span>;
                    })}
                  </div>
                )}
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
  const [tab, setTab]                     = useState("grupos"); // grupos | ausencias | reportes
  const [selectedDate, setSelectedDate]   = useState(today());
  const [grupos, setGrupos]               = useState([]);
  const [selectedId, setSelectedId]       = useState(null);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [reportSearch, setReportSearch]   = useState("");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [lastUpdate, setLastUpdate]       = useState(null);
  const [filterRisk, setFilterRisk]       = useState("all"); // all | ok | warning | danger | pending
  const isMobile = useIsMobile();

  async function loadAll(date) {
    setLoading(true);
    const [{ data: grpData }, { data: sessData }, { data: studData }, { data: attData }] = await Promise.all([
      fetchAll(() => sb.from("grupos").select("id,name,turno").order("name").order("id")),
      fetchAll(() => sb.from("sessions").select("id,name,materia,horario,grupo_id,owner:profiles(id,name)").order("id")),
      fetchAll(() => sb.from("students").select("id,name,grupo_id").eq("active", true).order("name").order("id")),
      fetchAll(() => sb.from("attendance").select("session_id,student_id,status,reason").eq("date", date).order("id")),
    ]);

    const studentsByGrupo = {};
    (studData||[]).forEach(s => { if (s.grupo_id) (studentsByGrupo[s.grupo_id] ??= []).push(s); });
    const clasesByGrupo = {};
    (sessData||[]).forEach(s => { if (s.grupo_id) (clasesByGrupo[s.grupo_id] ??= []).push({
      id: s.id, materia: s.materia || s.name, docente: s.owner?.name || "—", horario: s.horario || [],
    }); });
    const att = {}; // session_id -> student_id -> rec
    (attData||[]).forEach(a => { (att[a.session_id] ??= {})[a.student_id] = a; });

    // Cada Prefectura ve los grupos de su turno y los que aún no tienen turno asignado.
    const mine = (grpData||[]).filter(g => !user.turno || !g.turno || g.turno === user.turno);
    const enriched = mine.map(g => {
      const students = studentsByGrupo[g.id] || [];
      const clases = clasesByGrupo[g.id] || [];
      // Columnas del día: clases programadas ese día o con lista tomada
      const cols = clases
        .filter(c => tieneClase(c.horario, date) || att[c.id])
        .map(c => {
          const b = bloquesDelDia(c.horario, date);
          return { ...c, inicio: inicioDelDia(c.horario, date), fin: b.length ? b[b.length-1].fin : null, tomada: !!att[c.id] };
        })
        .sort((a, b) => (a.inicio || "99").localeCompare(b.inicio || "99") || a.materia.localeCompare(b.materia));
      const counts = { present:0, late:0, excused:0, absent:0, pending:0, total:0 };
      const rows = students.map(st => {
        const cells = {}; let reg = 0, absent = 0, late = 0, excused = 0;
        cols.forEach(c => {
          if (!c.tomada) return;
          counts.total++;
          const rec = att[c.id]?.[st.id];
          if (!rec) { counts.pending++; return; }
          cells[c.id] = { status: rec.status, reason: rec.reason || "" };
          if (counts[rec.status] !== undefined) counts[rec.status]++;
          if (rec.status !== "pending") reg++;
          if (rec.status === "absent") absent++;
          if (rec.status === "late") late++;
          if (rec.status === "excused") excused++;
        });
        const noVino = reg >= 2 && absent === reg;
        return { student: st, cells, reg, absent, late, excused, noVino };
      });
      const regTot = counts.present + counts.late + counts.excused + counts.absent;
      const pct = regTot > 0 ? Math.round(((counts.present + counts.late + counts.excused) / regTot) * 100) : null;
      const risk = pct===null?"pending":pct>=80?"ok":pct>=60?"warning":"danger";
      const dia = {
        cols, rows, counts, pct, risk,
        tomadas: cols.filter(c => c.tomada).length,
        noVino: rows.filter(r => r.noVino).length,
        parcial: rows.filter(r => r.absent > 0 && !r.noVino).length,
        conRetardo: rows.filter(r => r.late > 0).length,
      };
      return { ...g, students, clases, dia };
    });

    setGrupos(enriched);
    setLastUpdate(new Date());
    setLoading(false);
  }

  useEffect(() => {
    (async () => { await loadAll(selectedDate); })();
    const iv = setInterval(() => { loadAll(selectedDate); }, 60000);
    return () => clearInterval(iv);
  }, [selectedDate, user.turno]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = grupos.find(g => g.id === selectedId) || null;

  // Totales del día (cada clase cuenta por separado)
  const G = grupos.reduce((a,g)=>({
    present: a.present+g.dia.counts.present, late: a.late+g.dia.counts.late,
    excused: a.excused+g.dia.counts.excused, absent: a.absent+g.dia.counts.absent,
    pending: a.pending+g.dia.counts.pending, total: a.total+g.dia.counts.total,
  }), {present:0,late:0,excused:0,absent:0,pending:0,total:0});
  const regG = G.present+G.late+G.excused+G.absent;
  const globalPct = regG>0 ? Math.round(((G.present+G.late+G.excused)/regG)*100) : null;
  const noVinoTot  = grupos.reduce((a,g)=>a+g.dia.noVino,0);
  const parcialTot = grupos.reduce((a,g)=>a+g.dia.parcial,0);

  const riskCount = {
    danger:  grupos.filter(g=>g.dia.risk==="danger").length,
    warning: grupos.filter(g=>g.dia.risk==="warning").length,
    ok:      grupos.filter(g=>g.dia.risk==="ok").length,
    pending: grupos.filter(g=>g.dia.risk==="pending").length,
  };

  const qs = search.toLowerCase();
  const displayed = grupos.filter(g => {
    const matchSearch = !qs || g.name.toLowerCase().includes(qs) || g.clases.some(c => c.docente.toLowerCase().includes(qs) || c.materia.toLowerCase().includes(qs));
    const matchRisk = filterRisk==="all" || g.dia.risk===filterRisk;
    return matchSearch && matchRisk;
  });

  // Informe de faltas: una fila por alumno con todas sus clases del día
  const absenceRows = useMemo(() => {
    const rows = [];
    grupos.forEach(g => {
      g.dia.rows.forEach(r => {
        if (!r.absent && !r.late && !r.excused) return;
        const items = g.dia.cols.filter(c => r.cells[c.id] && r.cells[c.id].status !== "present" && r.cells[c.id].status !== "pending")
          .map(c => ({ clase: c, status: r.cells[c.id].status, reason: r.cells[c.id].reason }));
        rows.push({ ...r, grupo: g, items });
      });
    });
    return rows.sort((a,b) => (b.noVino - a.noVino) || (b.absent - a.absent) || a.grupo.name.localeCompare(b.grupo.name) || a.student.name.localeCompare(b.student.name));
  }, [grupos]);

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter',sans-serif",color:C.text}}>
      <GlobalStyles/>
      <Glow top="-15%" right="-5%" color="0,126,103" size="40vw"/>
      <Glow bottom="-10%" left="-5%" color="157,36,73" size="35vw"/>

      <div style={{height:3,background:BRAND.stripe}}/>
      <header style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 14px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
            <BrandMark size={28}/>
            <span className="hide-mobile" style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:16,color:C.text,flexShrink:0}}>AppProf</span>
            <span style={{background:`${C.teal}22`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,letterSpacing:.5,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>PREFECTURA{user.turno?` · ${TURNOS[user.turno].label.toUpperCase()}`:""}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {lastUpdate&&<span className="hide-mobile" style={{fontSize:11,color:C.muted}}>🔄 {lastUpdate.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</span>}
            <span className="hide-mobile" style={{fontSize:13,color:C.muted}}>👤 {user.name}</span>
            <button className="btn" onClick={()=>loadAll(selectedDate)} title="Actualizar"
              style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 10px",fontSize:13,fontFamily:"inherit",fontWeight:600}}>
              🔄
            </button>
            <button className="btn" onClick={onLogout}
              style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:8,padding:"6px 12px",fontSize:12,fontFamily:"inherit"}}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="tabs-scroll" style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 8px"}}>
        <div style={{maxWidth:1400,margin:"0 auto",display:"flex",gap:4,minWidth:"max-content"}}>
          {[["grupos","📚 Grupos"],["ausencias",`🚨 Faltas y retardos${absenceRows.length?` (${absenceRows.length})`:""}`],["reportes","📊 Reportes"]].map(([id,label])=>(
            <button key={id} className="btn" onClick={()=>setTab(id)}
              style={{background:"none",color:tab===id?C.accent:C.muted,borderBottom:tab===id?`2px solid ${C.accent}`:"2px solid transparent",padding:"12px 14px",fontSize:14,fontFamily:"inherit",fontWeight:tab===id?600:400,whiteSpace:"nowrap",transition:"all .2s"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main style={{maxWidth:1400,margin:"0 auto",padding:isMobile?"16px 12px":"20px 16px",position:"relative",zIndex:1}}>

        <div style={{marginBottom:14}}>
          <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:isMobile?18:20,fontWeight:800}}>
            {tab==="grupos" ? "Monitor de asistencia" : tab==="ausencias" ? "Informe de faltas y retardos" : "Reportes de asistencia"}
          </h2>
          {tab==="reportes" ? (
            <p style={{color:C.muted,fontSize:12,marginTop:4}}>Genera el reporte mensual por grupo o el historial de un alumno, y descárgalo en Excel.</p>
          ) : <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <input type="date" className="inp" value={selectedDate} onChange={e=>{ if(e.target.value){ setSelectedDate(e.target.value); setSelectedId(null); } }}
              style={{width:"auto",flex:"0 1 180px",padding:"8px 10px"}}/>
            {selectedDate!==today() && (
              <button className="btn" onClick={()=>{ setSelectedDate(today()); setSelectedId(null); }}
                style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 12px",fontSize:12,fontFamily:"inherit",fontWeight:600}}>
                Hoy
              </button>
            )}
            <span style={{color:C.muted,fontSize:12}}>{fmtDate(selectedDate)} · {grupos.length} grupos</span>
          </div>}
        </div>

        {!loading && tab==="grupos" && !(isMobile && selected) && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:isMobile?"14px":"20px 24px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:isMobile?14:24,flexWrap:"wrap"}}>
              {!isMobile && <Ring pct={globalPct} size={100} stroke={9}/>}
              <div style={{flex:"1 1 260px",minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:1.5,marginBottom:10,display:"flex",justifyContent:"space-between"}}>
                  <span>RESUMEN DEL DÍA</span>
                  {isMobile && <span style={{color:pctColor(globalPct),letterSpacing:0,fontSize:13}}>{globalPct!==null?globalPct+"% asistencia":"—"}</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6,marginBottom:10}}>
                  {[
                    {label:"No vinieron",   v:noVinoTot,  color:C.danger,  icon:"🔴"},
                    {label:"Faltó a algunas",v:parcialTot, color:C.warning, icon:"🟠"},
                    {label:"Faltas (clases)",v:G.absent,   color:C.danger,  icon:"❌"},
                    {label:"Retardos",      v:G.late,     color:C.late,    icon:"🕐"},
                  ].map(st=>(
                    <div key={st.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 2px",textAlign:"center",minWidth:0}}>
                      <div style={{fontSize:16}}>{st.icon}</div>
                      <div style={{fontSize:20,fontWeight:700,color:st.color,fontFamily:"'Sora',sans-serif"}}>{st.v}</div>
                      <div style={{color:C.muted,fontSize:10,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{st.label}</div>
                    </div>
                  ))}
                </div>
                <SegBar counts={G} total={G.total} height={10}/>
              </div>
              {!isMobile && <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:140}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:1}}>GRUPOS POR ESTADO</div>
                {[
                  {label:"Asistencia alta",  count:riskCount.ok,      color:C.success, icon:"🟢"},
                  {label:"Asistencia media", count:riskCount.warning,  color:C.warning, icon:"🟡"},
                  {label:"Asistencia baja",  count:riskCount.danger,   color:C.danger,  icon:"🔴"},
                  {label:"Sin listas",       count:riskCount.pending,  color:C.muted,   icon:"⚪"},
                ].map(r=>(
                  <div key={r.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <span>{r.icon}</span>
                    <span style={{color:C.muted,flex:1}}>{r.label}</span>
                    <span style={{fontWeight:700,color:r.color}}>{r.count}</span>
                  </div>
                ))}
              </div>}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{textAlign:"center",padding:"60px 0",color:C.muted,fontSize:14}}>Cargando...</div>
        ) : tab==="reportes" ? (
          <ViewerReports grupos={grupos}/>
        ) : tab==="ausencias" ? (
          <AbsenceReport rows={absenceRows} selectedDate={selectedDate} search={reportSearch} setSearch={setReportSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter}/>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:(selected&&!isMobile)?"minmax(280px,340px) minmax(0,1fr)":"minmax(0,1fr)",gap:20,alignItems:"start"}}>

            {!(isMobile && selected) && <div style={{minWidth:0}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar grupo, materia o docente..."
                  style={{flex:1,minWidth:0,background:"transparent",border:"none",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                {search&&<button className="btn" onClick={()=>setSearch("")} style={{background:"none",color:C.muted,border:"none",fontSize:15,padding:"0 2px"}}>×</button>}
              </div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                {[["all","Todos",C.accent],["ok","Alta",C.success],["warning","Media",C.warning],["danger","Baja",C.danger],["pending","Sin listas",C.muted]].map(([k,l,color])=>(
                  <button key={k} className="btn chip" onClick={()=>setFilterRisk(k)}
                    style={{background:filterRisk===k?`${color}22`:"transparent",color:filterRisk===k?color:C.muted,borderColor:filterRisk===k?color:C.border,fontSize:11,padding:"4px 10px"}}>
                    {l}
                  </button>
                ))}
              </div>

              {displayed.length===0 ? <Empty icon="📚" msg="Sin grupos"/> : (
                <div style={isMobile?{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}:{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8,maxHeight:"calc(100vh - 340px)",overflowY:"auto",paddingRight:4}}>
                  {displayed.map(g=>(
                    <GroupCard key={g.id} grupo={g} isActive={selectedId===g.id} onClick={()=>{ setSelectedId(g.id); if(isMobile) window.scrollTo({top:0}); }}/>
                  ))}
                </div>
              )}
            </div>}

            {selected && (
              <div style={isMobile?{minWidth:0}:{position:"sticky",top:76,minWidth:0}}>
                <GroupDetail grupo={selected} selectedDate={selectedDate} isMobile={isMobile} onClose={()=>setSelectedId(null)}/>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
