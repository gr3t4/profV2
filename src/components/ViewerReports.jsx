import { useState, useMemo } from "react";
import { sb } from "../lib/supabase";
import { C, STATUS, today, fmtDate } from "../lib/constants";
import { Empty } from "./Shared";

// ── Utilidades ───────────────────────────────────────────────────
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function monthRange(ym) {               // "2026-10" -> ["2026-10-01","2026-10-31"]
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`];
}
function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}
function emptyCounts() { return { present:0, late:0, excused:0, absent:0, total:0 }; }
function pctOf(c) {
  const reg = c.present + c.late + c.excused + c.absent;
  return reg > 0 ? Math.round(((c.present + c.late + c.excused) / reg) * 100) : null;
}
function pctColor(p) {
  if (p === null) return C.muted;
  if (p >= 80) return C.success;
  if (p >= 60) return C.warning;
  return C.danger;
}
const safeSheet = (name) => name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

// Trae TODOS los registros de asistencia del rango (Supabase devuelve máx. 1000 por consulta).
async function fetchAttendance({ from, to, sessionIds, studentId }) {
  const rows = [];
  const PAGE = 1000;
  for (let start = 0; ; start += PAGE) {
    let q = sb.from("attendance").select("session_id,student_id,date,status,reason")
      .gte("date", from).lte("date", to).order("date").range(start, start + PAGE - 1);
    if (studentId) q = q.eq("student_id", studentId);
    else if (sessionIds?.length) q = q.in("session_id", sessionIds);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// ── Componentes de presentación ──────────────────────────────────
function Seg({ value, onChange, options }) {
  return (
    <div style={{display:"flex",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:3,gap:3}}>
      {options.map(([k, l]) => (
        <button key={k} className="btn" onClick={() => onChange(k)}
          style={{flex:1,background:value===k?C.accent:"transparent",color:value===k?"#fff":C.muted,borderRadius:8,padding:"8px 10px",fontSize:13,fontWeight:600,fontFamily:"inherit",minHeight:34}}>
          {l}
        </button>
      ))}
    </div>
  );
}

function CountTiles({ c }) {
  const p = pctOf(c);
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:6}}>
      {[
        { label:"Asist.", v: p !== null ? p + "%" : "—", color: pctColor(p), icon:"📊" },
        { label:"Present.", v:c.present, color:C.success, icon:"✅" },
        { label:"Retardos", v:c.late,    color:C.late,    icon:"🕐" },
        { label:"Justif.",  v:c.excused, color:C.excused, icon:"📝" },
        { label:"Faltas",   v:c.absent,  color:C.danger,  icon:"❌" },
      ].map(t => (
        <div key={t.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 2px",textAlign:"center",minWidth:0}}>
          <div style={{fontSize:14}}>{t.icon}</div>
          <div style={{fontSize:18,fontWeight:700,color:t.color,fontFamily:"'Sora',sans-serif"}}>{t.v}</div>
          <div style={{color:C.muted,fontSize:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

const excelBtn = {background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}55`,borderRadius:10,padding:"10px 14px",fontSize:13,fontFamily:"inherit",fontWeight:700,whiteSpace:"nowrap"};
const genBtn   = {background:`linear-gradient(135deg,${C.teal},${C.accent})`,color:"#fff",borderRadius:10,padding:"10px 16px",fontSize:13,fontFamily:"inherit",fontWeight:700,whiteSpace:"nowrap"};
const card     = {background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:12};
const label    = {fontSize:11,color:C.muted,marginBottom:5};

// ── Reporte mensual ──────────────────────────────────────────────
function MonthlyReport({ sessions }) {
  const [month, setMonth]   = useState(today().slice(0, 7));
  const [groupId, setGroup] = useState("all");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [result, setResult] = useState(null); // { month, groups:[{session, dates, rows:[{student, c, byDate}] , c}] }
  const [sortBy, setSortBy] = useState("absent");

  async function generate() {
    setBusy(true); setError("");
    try {
      const [from, to] = monthRange(month);
      const groups = groupId === "all" ? sessions : sessions.filter(s => s.id === groupId);
      const att = await fetchAttendance({ from, to, sessionIds: groups.map(g => g.id) });
      const byStudent = {};
      att.forEach(a => { (byStudent[a.student_id] ??= {})[a.date] = a; });
      const out = groups.map(g => {
        const dates = [...new Set(att.filter(a => a.session_id === g.id).map(a => a.date))].sort();
        const gc = emptyCounts();
        const rows = g.students.map(st => {
          const c = emptyCounts();
          const byDate = byStudent[st.id] || {};
          Object.values(byDate).forEach(a => { if (c[a.status] !== undefined) { c[a.status]++; gc[a.status]++; } });
          return { student: st, c, byDate };
        });
        return { session: g, dates, rows, c: gc };
      });
      setResult({ month, groups: out });
    } catch (e) {
      setError("No se pudo generar: " + (e.message || e));
    }
    setBusy(false);
  }

  const total = useMemo(() => {
    if (!result) return null;
    return result.groups.reduce((a, g) => ({
      present:a.present+g.c.present, late:a.late+g.c.late, excused:a.excused+g.c.excused, absent:a.absent+g.c.absent, total:0,
    }), emptyCounts());
  }, [result]);

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const resumen = [["Reporte mensual de asistencia — " + monthLabel(result.month)], [],
      ["Grupo","Docente","Alumno","Presencias","Retardos","Justificadas","Faltas","Clases registradas","% Asistencia"]];
    result.groups.forEach(g => g.rows.forEach(r => {
      const reg = r.c.present + r.c.late + r.c.excused + r.c.absent;
      const p = pctOf(r.c);
      resumen.push([g.session.name, g.session.ownerName, r.student.name, r.c.present, r.c.late, r.c.excused, r.c.absent, reg, p === null ? "—" : p / 100]);
    }));
    const ws = XLSX.utils.aoa_to_sheet(resumen);
    for (let i = 3; i < resumen.length; i++) {
      const cell = ws[XLSX.utils.encode_cell({ r:i, c:8 })];
      if (cell && typeof cell.v === "number") cell.z = "0%";
    }
    ws["!cols"] = [{wch:30},{wch:28},{wch:36},{wch:11},{wch:10},{wch:12},{wch:8},{wch:12},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws, "Resumen");

    const used = new Set(["Resumen"]);
    result.groups.forEach(g => {
      const header = ["Alumno", ...g.dates.map(d => d.slice(8, 10) + "/" + d.slice(5, 7)), "P", "R", "J", "F", "% Asist."];
      const rows = g.rows.map(r => {
        const p = pctOf(r.c);
        return [r.student.name, ...g.dates.map(d => STATUS[r.byDate[d]?.status]?.short || "-"),
          r.c.present, r.c.late, r.c.excused, r.c.absent, p === null ? "—" : p + "%"];
      });
      const sh = XLSX.utils.aoa_to_sheet([[g.session.name + " — " + g.session.ownerName + " — " + monthLabel(result.month)], [], header, ...rows,
        [], ["P = presente · R = retardo · J = justificada · F = falta · - = sin registro"]]);
      sh["!cols"] = [{wch:36}, ...g.dates.map(() => ({wch:6})), {wch:4},{wch:4},{wch:4},{wch:4},{wch:9}];
      let name = safeSheet(g.session.name), k = 2;
      while (used.has(name)) name = safeSheet(g.session.name).slice(0, 28) + " " + k++;
      used.add(name);
      XLSX.utils.book_append_sheet(wb, sh, name);
    });
    XLSX.writeFile(wb, `reporte_mensual_${result.month}.xlsx`);
  }

  const sorter = {
    absent: (a, b) => b.c.absent - a.c.absent || a.student.name.localeCompare(b.student.name),
    pct:    (a, b) => (pctOf(a.c) ?? 101) - (pctOf(b.c) ?? 101),
    name:   (a, b) => a.student.name.localeCompare(b.student.name),
  }[sortBy];

  return (
    <div>
      <div style={card}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:"1 1 150px"}}>
            <div style={label}>Mes</div>
            <input type="month" className="inp" value={month} onChange={e => { if (e.target.value) { setMonth(e.target.value); setResult(null); } }}/>
          </div>
          <div style={{flex:"2 1 200px",minWidth:0}}>
            <div style={label}>Grupo</div>
            <select className="inp" value={groupId} onChange={e => { setGroup(e.target.value); setResult(null); }}>
              <option value="all">Todos los grupos ({sessions.length})</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name} — {s.ownerName}</option>)}
            </select>
          </div>
          <button className="btn" onClick={generate} disabled={busy} style={{...genBtn,flex:"1 1 140px"}}>
            {busy ? "Generando…" : "📊 Generar reporte"}
          </button>
        </div>
        {error && <div style={{color:C.danger,fontSize:12,marginTop:8}}>{error}</div>}
      </div>

      {!result ? (
        <Empty icon="📅" msg="Elige el mes y el grupo, y toca «Generar reporte»."/>
      ) : (
        <>
          <div style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15}}>Reporte de {monthLabel(result.month)}</div>
                <div style={{color:C.muted,fontSize:12,marginTop:2}}>
                  {result.groups.length} grupo{result.groups.length===1?"":"s"} · {result.groups.reduce((a,g)=>a+g.rows.length,0)} alumnos
                </div>
              </div>
              <button className="btn" onClick={exportXlsx} style={excelBtn}>📥 Descargar Excel</button>
            </div>
            <CountTiles c={total}/>
          </div>

          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.muted}}>Ordenar:</span>
            {[["absent","Más faltas"],["pct","Menor asistencia"],["name","Nombre"]].map(([k,l]) => (
              <button key={k} className="btn chip" onClick={() => setSortBy(k)}
                style={{background:sortBy===k?`${C.accent}22`:"transparent",color:sortBy===k?C.accent:C.muted,borderColor:sortBy===k?C.accent:C.border}}>{l}</button>
            ))}
          </div>

          {result.groups.map(g => (
            <div key={g.session.id} style={{...card,padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,overflowWrap:"anywhere"}}>{g.session.name}</div>
                  <div style={{color:C.muted,fontSize:11,marginTop:2}}>👤 {g.session.ownerName} · {g.dates.length} clase{g.dates.length===1?"":"s"} registradas</div>
                </div>
                <div style={{fontWeight:800,fontSize:16,color:pctColor(pctOf(g.c)),flexShrink:0}}>{pctOf(g.c) ?? "—"}{pctOf(g.c)!==null&&"%"}</div>
              </div>
              {g.dates.length === 0 ? (
                <div style={{padding:"14px",color:C.muted,fontSize:12}}>Sin registros de asistencia en este mes.</div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)"}}>
                  <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) repeat(4,30px) 46px",gap:4,padding:"6px 14px",fontSize:10,color:C.muted,fontWeight:700,background:C.surface}}>
                    <span>ALUMNO</span><span style={{textAlign:"center"}}>✅</span><span style={{textAlign:"center"}}>🕐</span><span style={{textAlign:"center"}}>📝</span><span style={{textAlign:"center"}}>❌</span><span style={{textAlign:"right"}}>%</span>
                  </div>
                  {[...g.rows].sort(sorter).map(r => {
                    const p = pctOf(r.c);
                    return (
                      <div key={r.student.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) repeat(4,30px) 46px",gap:4,padding:"8px 14px",fontSize:12,borderTop:`1px solid ${C.border}66`,alignItems:"center"}}>
                        <span style={{overflowWrap:"anywhere"}}>{r.student.name}</span>
                        <span style={{textAlign:"center",color:C.success}}>{r.c.present}</span>
                        <span style={{textAlign:"center",color:C.late}}>{r.c.late}</span>
                        <span style={{textAlign:"center",color:C.excused}}>{r.c.excused}</span>
                        <span style={{textAlign:"center",color:C.danger,fontWeight:r.c.absent?700:400}}>{r.c.absent}</span>
                        <span style={{textAlign:"right",fontWeight:700,color:pctColor(p)}}>{p===null?"—":p+"%"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Reporte por alumno ───────────────────────────────────────────
function StudentReport({ sessions }) {
  const [query, setQuery]   = useState("");
  const [picked, setPicked] = useState(null);   // { student, session }
  const [mode, setMode]     = useState("month"); // month | range
  const [month, setMonth]   = useState(today().slice(0, 7));
  const [from, setFrom]     = useState(today().slice(0, 7) + "-01");
  const [to, setTo]         = useState(today());
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [result, setResult] = useState(null);

  const allStudents = useMemo(() => sessions.flatMap(s => s.students.map(st => ({ student: st, session: s }))), [sessions]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return allStudents.filter(x => x.student.name.toLowerCase().includes(q)).slice(0, 12);
  }, [query, allStudents]);

  function pick(x) { setPicked(x); setQuery(""); setResult(null); }

  async function generate() {
    const [f, t] = mode === "month" ? monthRange(month) : [from, to];
    if (f > t) { setError("La fecha inicial es posterior a la final"); return; }
    setBusy(true); setError("");
    try {
      const rows = await fetchAttendance({ from: f, to: t, studentId: picked.student.id });
      const c = emptyCounts();
      rows.forEach(r => { if (c[r.status] !== undefined) c[r.status]++; });
      setResult({ from: f, to: t, rows: rows.slice().reverse(), c, label: mode === "month" ? monthLabel(month) : `${fmtDate(f)} – ${fmtDate(t)}` });
    } catch (e) {
      setError("No se pudo generar: " + (e.message || e));
    }
    setBusy(false);
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const { student, session } = picked;
    const p = pctOf(result.c);
    const data = [
      ["Reporte de asistencia por alumno"], [],
      ["Alumno", student.name], ["Grupo", session.name], ["Docente", session.ownerName], ["Periodo", result.label], [],
      ["Presencias", result.c.present], ["Retardos", result.c.late], ["Justificadas", result.c.excused], ["Faltas", result.c.absent],
      ["% Asistencia", p === null ? "—" : p + "%"], [],
      ["Fecha", "Estado", "Motivo"],
      ...result.rows.slice().reverse().map(r => [r.date, STATUS[r.status]?.label || r.status, r.reason || ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{wch:16},{wch:36},{wch:40}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alumno");
    const slug = student.name.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40);
    XLSX.writeFile(wb, `reporte_${slug}_${result.from}_a_${result.to}.xlsx`);
  }

  return (
    <div>
      <div style={card}>
        <div style={label}>Alumno</div>
        {picked ? (
          <div style={{display:"flex",alignItems:"center",gap:10,background:C.surface,border:`1px solid ${C.accent}66`,borderRadius:10,padding:"10px 12px"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,overflowWrap:"anywhere"}}>{picked.student.name}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:2}}>📚 {picked.session.name} · 👤 {picked.session.ownerName}</div>
            </div>
            <button className="btn" onClick={() => { setPicked(null); setResult(null); }}
              style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",fontSize:12,fontFamily:"inherit",flexShrink:0}}>Cambiar</button>
          </div>
        ) : (
          <>
            <input className="inp" placeholder="Escribe al menos 2 letras del nombre…" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off"/>
            {matches.length > 0 && (
              <div style={{marginTop:6,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                {matches.map(x => (
                  <button key={x.student.id} className="btn" onClick={() => pick(x)}
                    style={{display:"block",width:"100%",textAlign:"left",background:C.surface,color:C.text,borderBottom:`1px solid ${C.border}`,padding:"9px 12px",fontFamily:"inherit"}}>
                    <div style={{fontSize:13,fontWeight:600}}>{x.student.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>📚 {x.session.name} · 👤 {x.session.ownerName}</div>
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && matches.length === 0 && <div style={{fontSize:12,color:C.warning,marginTop:6}}>⚠️ No se encontró ningún alumno</div>}
          </>
        )}

        {picked && (
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>
            <Seg value={mode} onChange={m => { setMode(m); setResult(null); }} options={[["month","Por mes"],["range","Por fechas"]]}/>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
              {mode === "month" ? (
                <div style={{flex:"1 1 150px"}}>
                  <div style={label}>Mes</div>
                  <input type="month" className="inp" value={month} onChange={e => { if (e.target.value) { setMonth(e.target.value); setResult(null); } }}/>
                </div>
              ) : (
                <>
                  <div style={{flex:"1 1 130px"}}>
                    <div style={label}>Desde</div>
                    <input type="date" className="inp" value={from} onChange={e => { if (e.target.value) { setFrom(e.target.value); setResult(null); } }}/>
                  </div>
                  <div style={{flex:"1 1 130px"}}>
                    <div style={label}>Hasta</div>
                    <input type="date" className="inp" value={to} onChange={e => { if (e.target.value) { setTo(e.target.value); setResult(null); } }}/>
                  </div>
                </>
              )}
              <button className="btn" onClick={generate} disabled={busy} style={{...genBtn,flex:"1 1 140px"}}>
                {busy ? "Generando…" : "📊 Generar reporte"}
              </button>
            </div>
          </div>
        )}
        {error && <div style={{color:C.danger,fontSize:12,marginTop:8}}>{error}</div>}
      </div>

      {!picked ? (
        <Empty icon="🧑‍🎓" msg="Busca un alumno para ver su reporte de asistencia."/>
      ) : result && (
        <>
          <div style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15}}>Periodo: {result.label}</div>
                <div style={{color:C.muted,fontSize:12,marginTop:2}}>{result.rows.length} clase{result.rows.length===1?"":"s"} registradas</div>
              </div>
              <button className="btn" onClick={exportXlsx} style={excelBtn}>📥 Descargar Excel</button>
            </div>
            <CountTiles c={result.c}/>
          </div>
          {result.rows.length === 0 ? <Empty icon="📭" msg="Sin registros en este periodo"/> : (
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:6}}>
              {result.rows.map(r => {
                const cfg = STATUS[r.status] || STATUS.pending;
                return (
                  <div key={r.date + r.session_id} style={{background:C.card,border:`1px solid ${cfg.color}22`,borderLeft:`3px solid ${cfg.color}`,borderRadius:10,padding:"10px 12px",minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{flex:1,fontSize:13,fontWeight:500}}>{fmtDate(r.date)}</div>
                      <span style={{background:`${cfg.color}18`,color:cfg.color,border:`1px solid ${cfg.color}44`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700,flexShrink:0}}>{cfg.icon} {cfg.label}</span>
                    </div>
                    {r.status === "excused" && r.reason && <div style={{fontSize:11,color:C.muted,marginTop:4}}>📝 {r.reason}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Pestaña de reportes ──────────────────────────────────────────
export default function ViewerReports({ sessions }) {
  const [kind, setKind] = useState("month");
  return (
    <div style={{animation:"fadeUp .3s ease both"}}>
      <div style={{marginBottom:12}}>
        <Seg value={kind} onChange={setKind} options={[["month","📅 Reporte mensual"],["student","🧑‍🎓 Por alumno"]]}/>
      </div>
      {kind === "month" ? <MonthlyReport sessions={sessions}/> : <StudentReport sessions={sessions}/>}
    </div>
  );
}
