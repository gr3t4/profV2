import { useState, useEffect, useRef } from "react";
import { sb } from "../lib/supabase";
import { C, STATUS, today, fmtDate } from "../lib/constants";
import { GlobalStyles, Glow, Toast, Empty, AddStudentInline } from "./Shared";
import JustifyModal from "./JustifyModal";
import ExportModal from "./ExportModal";
import ImportPreviewModal from "./ImportPreviewModal";
import ReportModule from "./ReportModule";
import TutorModal from "./TutorModal";
import { sendWhatsApp } from "../lib/whatsapp";
import { parseStudentsExcel, downloadStudentsTemplate } from "../lib/excelStudents";
import * as XLSX from "xlsx";
export default function TeacherApp({ user, onLogout }) {
  const [sessions, setSessions]         = useState([]);
  const [activeSession, setActiveSess]  = useState(null);
  const [view, setView]                 = useState("sessions");
  const [mainTab, setMainTab]           = useState("attendance");
  const [students, setStudents]         = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [attendance, setAttendance]     = useState({});
  const [allDates, setAllDates]         = useState([]);
  const [dateHours, setDateHours]       = useState({}); // { date: hours }
  const [classHours, setClassHours]     = useState(1);  // horas de la fecha activa
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [filter, setFilter]             = useState("all");
  const [showNewSess, setShowNewSess]   = useState(false);
  const [newSessName, setNewSessName]   = useState("");
  const [newSessDate, setNewSessDate]   = useState(today());
  const [toast, setToast]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [justifyTarget, setJustifyTarget] = useState(null);
  const [showExport, setShowExport]     = useState(false);
  const [tutorTarget, setTutorTarget]   = useState(null);
  const [importPreview, setImportPreview] = useState(null); // rows parsed, pending confirmación
  const fileRef = useRef();
  const isViewer = user.role === "viewer";

  async function loadSessions() {
    const { data } = await sb.from("sessions").select("*").eq("owner_id", user.id).order("created_at", { ascending:false });
    setSessions(data || []);
  }

  useEffect(() => { (async () => { await loadSessions(); })(); }, []);

  async function selectSession(s) {
    setActiveSess(s);
    const { data:studs } = await sb.from("students").select("*").eq("session_id", s.id).order("created_at");
    setStudents(studs || []);
    const { data:attRows } = await sb.from("attendance").select("date").eq("session_id", s.id);
    const dates = [...new Set((attRows||[]).map(r=>r.date))].sort().reverse();
    setAllDates(dates);
    // Cargar horas por fecha
    const { data:hoursRows } = await sb.from("class_hours").select("date,hours").eq("session_id", s.id);
    const hm = {}; (hoursRows||[]).forEach(r=>{ hm[r.date]=r.hours; });
    setDateHours(hm);
    const d = today(); setSelectedDate(d);
    setClassHours(hm[d] || 1);
    await loadAttendanceForDate(s.id, d);
    setFilter("all"); setSearchQuery(""); setSearchResult(null);
    setMainTab("attendance"); setView("attendance");
  }

  async function loadAttendanceForDate(sessionId, date) {
    const { data } = await sb.from("attendance").select("student_id,status,reason").eq("session_id", sessionId).eq("date", date);
    const m = {}; (data||[]).forEach(r => { m[r.student_id] = { status:r.status, reason:r.reason||"" }; });
    setAttendance(m);
  }

  async function changeDate(d) {
    setSelectedDate(d);
    setClassHours(dateHours[d] || 1);
    await loadAttendanceForDate(activeSession.id, d);
    setFilter("all");
  }

  async function saveAttendanceForDate() {
    setSaving(true);
    const upserts = students.map(s => ({
      session_id: activeSession.id, student_id: s.id, date: selectedDate,
      status: attendance[s.id]?.status || "pending",
      reason: attendance[s.id]?.reason || null,
    }));
    if (upserts.length > 0) {
      const { error } = await sb.from("attendance").upsert(upserts, { onConflict:"student_id,date" });
      if (error) { showToast("❌ " + error.message); setSaving(false); return; }
    }
    // Guardar horas de esta clase
    const hrs = parseFloat(classHours) || 1;
    await sb.from("class_hours").upsert({ session_id:activeSession.id, date:selectedDate, hours:hrs }, { onConflict:"session_id,date" });
    setDateHours(p => ({...p, [selectedDate]: hrs}));
    const dates = allDates.includes(selectedDate) ? allDates : [...allDates, selectedDate].sort().reverse();
    setAllDates(dates); showToast("💾 Guardado — " + fmtDate(selectedDate)); setSaving(false);
  }

  function toggleAtt(id, status) { setAttendance(prev => ({...prev, [id]: {...(prev[id]||{}), status}})); }
  function markAll(status) {
    const att = {}; students.forEach(s => att[s.id] = { status, reason:"" }); setAttendance(att);
    showToast(STATUS[status].icon + " Todos: " + STATUS[status].label);
  }
  function openJustify(student) { setJustifyTarget({ student, date:selectedDate }); }
  function saveJustification(reason) {
    const id = justifyTarget.student.id;
    setAttendance(prev => ({...prev, [id]: { status:"excused", reason }}));
    setJustifyTarget(null); showToast("📝 Justificación guardada");
  }

  async function createSession() {
    if (!newSessName.trim()) return;
    const { data, error } = await sb.from("sessions").insert({ owner_id:user.id, name:newSessName.trim(), date:newSessDate }).select().single();
    if (error) { showToast("❌ " + error.message); return; }
    setSessions(p => [data,...p]); setShowNewSess(false); setNewSessName(""); setNewSessDate(today()); showToast("✅ Creada");
  }
  async function deleteSession(id) { await sb.from("sessions").delete().eq("id", id); setSessions(p => p.filter(s => s.id !== id)); showToast("🗑️ Eliminada"); }

  async function handleFileSelected(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    const rows = await parseStudentsExcel(file);
    if (!rows.length) { showToast("⚠️ Sin nombres detectados en el archivo"); return; }
    setImportPreview(rows);
  }

  async function confirmImport(selectedRows) {
    const existing = students.map(s => s.name.toLowerCase());
    const toInsert = selectedRows.filter(r => !existing.includes(r.name.toLowerCase()));
    if (!toInsert.length) { showToast("ℹ️ Todos ya existen"); setImportPreview(null); return; }
    const { data, error } = await sb.from("students").insert(toInsert.map(r => ({
      session_id: activeSession.id,
      name: r.name,
      tutor_name: r.tutorName || null,
      tutor_phone: r.tutorPhone || null,
    }))).select();
    if (error) { showToast("❌ " + error.message); return; }
    setStudents(p => [...p, ...data]);
    setImportPreview(null);
    showToast(`📥 ${data.length} importados`);
  }
  async function addStudent(name) {
    const { data, error } = await sb.from("students").insert({ session_id:activeSession.id, name:name.trim() }).select().single();
    if (error) { showToast("❌ " + error.message); return; }
    setStudents(p => [...p, data]);
  }
  async function removeStudent(id) {
    await sb.from("students").delete().eq("id", id);
    setStudents(p => p.filter(s => s.id !== id));
    setAttendance(p => { const a = {...p}; delete a[id]; return a; });
  }

  async function searchStudent(q) {
    const query = q.trim().toLowerCase(); if (!query || !activeSession) { setSearchResult(null); return; }
    const found = students.find(s => s.name.toLowerCase().includes(query));
    if (!found) { setSearchResult({ notFound:true, query:q }); return; }
    const { data } = await sb.from("attendance").select("date,status,reason").eq("student_id", found.id).order("date", { ascending:false });
    setSearchResult({ student:found, history:data||[] }); setView("student-history");
  }

  async function handleExport(type) {
    const sessName = activeSession?.name || "sesion";
    const dateList = [...allDates].sort();
    const { data:allAtt } = await sb.from("attendance").select("student_id,date,status,reason").eq("session_id", activeSession.id);
    const idx = {}; (allAtt||[]).forEach(r => { if (!idx[r.student_id]) idx[r.student_id] = {}; idx[r.student_id][r.date] = { status:r.status, reason:r.reason||"" }; });
    const wb = XLSX.utils.book_new();
    function sheetDate() {
      return XLSX.utils.aoa_to_sheet([["Alumno","Estado","Motivo"], ...students.map(s => { const rec = attendance[s.id]||{}; return [s.name, STATUS[rec.status||"pending"]?.label||"-", rec.reason||""]; })]);
    }
    function sheetFull() {
      const header = ["Alumno",...dateList,"Presencias","Retardos","Justificadas","Faltas","% Asist."];
      const rows = students.map(s => {
        const row = [s.name,...dateList.map(d => STATUS[idx[s.id]?.[d]?.status]?.short||"-")];
        const ps = row.slice(1).filter(x=>x==="P").length, rs = row.slice(1).filter(x=>x==="R").length;
        const js = row.slice(1).filter(x=>x==="J").length, fs = row.slice(1).filter(x=>x==="F").length;
        return [...row, ps, rs, js, fs, dateList.length>0?Math.round(((ps+rs+js)/dateList.length)*100)+"%":"-"];
      });
      return XLSX.utils.aoa_to_sheet([header,...rows]);
    }
    function sheetJustify() {
      const rows = [["Alumno","Fecha","Motivo"]];
      for (const s of students) for (const d of dateList) { const rec = idx[s.id]?.[d]; if (rec?.status==="excused") rows.push([s.name,d,rec.reason||"(sin motivo)"]); }
      if (rows.length===1) rows.push(["Sin faltas justificadas","",""]);
      return XLSX.utils.aoa_to_sheet(rows);
    }
    function sheetsPerStudent() {
      return students.map(s => {
        const rows = [["Fecha","Estado","Motivo"],...dateList.map(d => { const rec = idx[s.id]?.[d]; return [d, STATUS[rec?.status||"pending"]?.label||"-", rec?.status==="excused"?rec.reason||"":""]; })];
        const ps = rows.slice(1).filter(r=>r[1]==="Presente").length, rs = rows.slice(1).filter(r=>r[1]==="Retardo").length;
        const js = rows.slice(1).filter(r=>r[1]==="Justificada").length, fs = rows.slice(1).filter(r=>r[1]==="Ausente").length;
        rows.push([],["RESUMEN","",""],["Presencias",ps,""],["Retardos",rs,""],["Justificadas",js,""],["Faltas",fs,""],["% Asistencia",dateList.length>0?Math.round(((ps+rs+js)/dateList.length)*100)+"%":"-",""]);
        return { name:s.name.substring(0,30), ws:XLSX.utils.aoa_to_sheet(rows) };
      });
    }
    if (type==="date") { XLSX.utils.book_append_sheet(wb,sheetDate(),`Asist_${selectedDate}`); XLSX.writeFile(wb,`asistencia_${sessName}_${selectedDate}.xlsx`); }
    else if (type==="full") { XLSX.utils.book_append_sheet(wb,sheetFull(),"Reporte completo"); XLSX.writeFile(wb,`reporte_${sessName}.xlsx`); }
    else if (type==="justify") { XLSX.utils.book_append_sheet(wb,sheetJustify(),"Justificaciones"); XLSX.writeFile(wb,`justificaciones_${sessName}.xlsx`); }
    else if (type==="student") { const sh = sheetsPerStudent(); if (!sh.length){showToast("⚠️ Sin alumnos");return;} sh.forEach(({name,ws})=>XLSX.utils.book_append_sheet(wb,ws,name)); XLSX.writeFile(wb,`alumnos_${sessName}.xlsx`); }
    else if (type==="all") { XLSX.utils.book_append_sheet(wb,sheetDate(),`Asist_${selectedDate}`); XLSX.utils.book_append_sheet(wb,sheetFull(),"Reporte completo"); XLSX.utils.book_append_sheet(wb,sheetJustify(),"Justificaciones"); sheetsPerStudent().forEach(({name,ws})=>XLSX.utils.book_append_sheet(wb,ws,name)); XLSX.writeFile(wb,`completo_${sessName}.xlsx`); }
    showToast("📥 Excel descargado");
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function saveTutor(updated) {
    setStudents(p => p.map(s => s.id === updated.id ? updated : s));
    setTutorTarget(null);
    showToast("📱 Tutor guardado");
  }

  const getStatus = (id) => attendance[id]?.status || "pending";
  const counts = {
    present: students.filter(s=>getStatus(s.id)==="present").length,
    late:    students.filter(s=>getStatus(s.id)==="late").length,
    excused: students.filter(s=>getStatus(s.id)==="excused").length,
    absent:  students.filter(s=>getStatus(s.id)==="absent").length,
    pending: students.filter(s=>getStatus(s.id)==="pending").length,
  };
  const filteredStudents = students.filter(s => filter==="all" ? true : filter==="pending" ? getStatus(s.id)==="pending" : getStatus(s.id)===filter);

  const MAIN_TABS = [
    { id:"attendance", label:"📋 Asistencia" },
    { id:"report",     label:"📈 Reporte" },
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Source Sans 3',sans-serif",color:C.text,position:"relative"}}>
      <GlobalStyles/>
      <Glow top="-15%" right="-5%" color="59,130,246" size="40vw"/>
      <Glow bottom="-10%" left="-5%" color="139,92,246" size="35vw"/>
      {toast && <Toast msg={toast}/>}
      {justifyTarget && <JustifyModal student={justifyTarget.student} date={justifyTarget.date} currentReason={attendance[justifyTarget.student.id]?.reason||""} onSave={saveJustification} onClose={()=>setJustifyTarget(null)}/>}
      {showExport && <ExportModal hasMultipleDates={allDates.length>0} onExport={handleExport} onClose={()=>setShowExport(false)}/>}
      {tutorTarget && <TutorModal student={tutorTarget} sessionName={activeSession?.name} onSave={saveTutor} onClose={()=>setTutorTarget(null)}/>}
      {importPreview && <ImportPreviewModal rows={importPreview} existingNames={students.map(s=>s.name)} onConfirm={confirmImport} onClose={()=>setImportPreview(null)}/>}

      <div style={{height:3,background:"linear-gradient(90deg,#b71c1c 33%,#1b3a8a 66%,#c8a020 100%)"}}/>
      <header style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 14px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:980,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
            {view!=="sessions"&&<button className="btn" onClick={()=>{if(view==="student-history"){setView("attendance");setSearchResult(null);setSearchQuery("");}else{setView("sessions");setActiveSess(null);}}} style={{background:"none",color:C.muted,fontSize:20,padding:"4px 6px",flexShrink:0}}>←</button>}
            <img src="/dgti-logo.png" alt="CBTIS 179" style={{height:24,objectFit:"contain",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
            <span style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:16,color:C.text,flexShrink:0}}>AppProf</span>
            {activeSession&&view!=="sessions"&&<span className="hide-mobile" style={{color:C.muted,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>/ {activeSession.name}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {isViewer&&<span className="hide-mobile" style={{background:`${C.warning}22`,color:C.warning,border:`1px solid ${C.warning}44`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>LECTURA</span>}
            <span className="hide-mobile" style={{fontSize:12,color:C.muted}}>👤 {user.name}</span>
            <button className="btn" onClick={onLogout} style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:8,padding:"6px 12px",fontSize:12,fontFamily:"inherit"}}>Salir</button>
          </div>
        </div>
      </header>

      {/* Sub-tabs when inside a session */}
      {view!=="sessions"&&view!=="student-history"&&(
        <div className="tabs-scroll" style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 24px"}}>
          <div style={{maxWidth:980,margin:"0 auto",display:"flex",gap:4,minWidth:"max-content"}}>
            {MAIN_TABS.map(t=>(
              <button key={t.id} className="btn" onClick={()=>setMainTab(t.id)}
                style={{background:"none",color:mainTab===t.id?C.accent:C.muted,borderBottom:mainTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",padding:"12px 18px",fontSize:14,fontFamily:"inherit",fontWeight:mainTab===t.id?600:400,transition:"all .2s"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={{maxWidth:980,margin:"0 auto",padding:"20px 14px",position:"relative",zIndex:1}}>

        {/* SESSIONS LIST */}
        {view==="sessions"&&(
          <div style={{animation:"fadeUp .4s ease both"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <div><h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700}}>Mis Sesiones</h2><p style={{color:C.muted,fontSize:13,marginTop:4}}>Selecciona una sesión para comenzar</p></div>
              {!isViewer&&<button className="btn" onClick={()=>setShowNewSess(true)} style={{background:`linear-gradient(135deg,${C.accent},${C.purple})`,color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>+ Nueva Sesión</button>}
            </div>
            {showNewSess&&!isViewer&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:24,marginBottom:20,animation:"fadeUp .3s ease both"}}>
                <h3 style={{marginBottom:16,fontSize:15,fontWeight:600}}>Nueva Sesión</h3>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  <input className="inp" placeholder="Nombre (ej. Matemáticas 3A)" value={newSessName} onChange={e=>setNewSessName(e.target.value)} style={{flex:2,minWidth:200}}/>
                  <input className="inp" type="date" value={newSessDate} onChange={e=>setNewSessDate(e.target.value)} style={{flex:1}}/>
                  <button className="btn" onClick={createSession} style={{background:C.success,color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>Crear</button>
                  <button className="btn" onClick={()=>setShowNewSess(false)} style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px",fontSize:14,fontFamily:"inherit"}}>Cancelar</button>
                </div>
              </div>
            )}
            {sessions.length===0?<Empty icon="🗂️" msg="No hay sesiones. ¡Crea la primera!"/>:(
              <div style={{display:"grid",gap:12}}>
                {sessions.map((s,i)=>(
                  <div key={s.id} className="row-hover" onClick={()=>selectSession(s)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",animation:`slideIn .3s ease both`,animationDelay:`${i*.05}s`}}>
                    <div style={{display:"flex",alignItems:"center",gap:16}}>
                      <div style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${C.accent}22,${C.purple}22)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📚</div>
                      <div><div style={{fontWeight:600,fontSize:15}}>{s.name}</div><div style={{color:C.muted,fontSize:12,marginTop:2}}>📅 {s.date}</div></div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{color:C.accent,fontSize:13}}>Abrir →</span>
                      {!isViewer&&<button className="btn" onClick={e=>{e.stopPropagation();deleteSession(s.id);}} style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:"none",borderRadius:8,padding:"6px 10px"}}>🗑️</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {view==="attendance"&&activeSession&&mainTab==="attendance"&&(
          <div style={{animation:"fadeUp .4s ease both"}}>
            {/* Date panel */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"16px 18px",marginBottom:16}}>
              <div style={{fontSize:11,color:C.teal,fontWeight:700,letterSpacing:1,marginBottom:12}}>SELECTOR DE FECHA</div>
              {/* Fecha activa + horas + guardar */}
              <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:14,flexWrap:"wrap"}}>
                <div style={{flex:2,minWidth:130}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Fecha</div>
                  <input className="inp" type="date" value={selectedDate} onChange={e=>changeDate(e.target.value)}/>
                </div>
                <div style={{width:100,flexShrink:0}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Horas de clase</div>
                  <input className="inp" type="number" min="0.5" max="12" step="0.5"
                    value={classHours}
                    onChange={e=>setClassHours(e.target.value)}
                    style={{textAlign:"center"}}/>
                </div>
                {!isViewer&&<button className="btn" onClick={saveAttendanceForDate} disabled={saving}
                  style={{background:`linear-gradient(135deg,${C.teal},${C.accent})`,color:"#fff",borderRadius:10,
                    padding:"10px 18px",fontSize:13,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0,alignSelf:"flex-end"}}>
                  {saving?"Guardando...":"💾 Guardar"}
                </button>}
              </div>
              {/* Lista de fechas guardadas */}
              {allDates.length > 0 && (
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>Fechas guardadas <span style={{background:`${C.accent}22`,color:C.accent,borderRadius:20,padding:"1px 8px",fontSize:11}}>{allDates.length}</span></span>
                    <span style={{color:C.teal,fontWeight:700}}>
                      {Object.values(dateHours).reduce((a,b)=>a+b,0)} hrs totales
                    </span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingRight:2}}>
                    {allDates.map(d=>(
                      <button key={d} className="btn" onClick={()=>changeDate(d)} style={{
                        background:d===selectedDate?`${C.accent}22`:"transparent",
                        color:d===selectedDate?C.accent:C.muted,
                        border:`1px solid ${d===selectedDate?C.accent:C.border}`,
                        borderRadius:8,padding:"8px 14px",fontSize:13,fontFamily:"inherit",
                        fontWeight:d===selectedDate?700:400,
                        textAlign:"left",width:"100%",
                        display:"flex",alignItems:"center",justifyContent:"space-between",
                      }}>
                        <span>{fmtDate(d)}</span>
                        <span style={{fontSize:11,color:C.teal,fontWeight:600}}>
                          {dateHours[d]||1}h
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {allDates.length===0&&<span style={{color:C.muted,fontSize:12,fontStyle:"italic"}}>Sin fechas guardadas aún</span>}
            </div>
            {/* Search */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 18px",marginBottom:20}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:18}}>🔍</span>
                <input className="inp" placeholder="Buscar alumno y ver su historial..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchStudent(searchQuery)} style={{flex:1,background:"transparent",border:"none",padding:0,fontSize:14}}/>
                <button className="btn" onClick={()=>searchStudent(searchQuery)} style={{background:`${C.purple}22`,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:8,padding:"7px 16px",fontSize:13,fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>Ver historial</button>
                {searchQuery&&<button className="btn" onClick={()=>{setSearchQuery("");setSearchResult(null);}} style={{background:"none",color:C.muted,border:"none",fontSize:18,padding:"0 4px"}}>×</button>}
              </div>
              {searchResult?.notFound&&<div style={{color:C.warning,fontSize:12,marginTop:8,paddingLeft:28}}>⚠️ No se encontró alumno</div>}
            </div>
            {/* Stats */}
            <div className="grid-stats-5" style={{marginBottom:18}}>
              {[{label:"Presentes",count:counts.present,color:C.success,icon:"✅"},{label:"Retardos",count:counts.late,color:C.late,icon:"🕐"},{label:"Justificadas",count:counts.excused,color:C.excused,icon:"📝"},{label:"Ausentes",count:counts.absent,color:C.danger,icon:"❌"},{label:"Pendientes",count:counts.pending,color:C.muted,icon:"⏳"}].map(st=>(
                <div key={st.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 10px",textAlign:"center"}}>
                  <div style={{fontSize:20}}>{st.icon}</div>
                  <div style={{fontSize:22,fontWeight:700,color:st.color,fontFamily:"'Space Grotesk',sans-serif"}}>{st.count}</div>
                  <div style={{color:C.muted,fontSize:11}}>{st.label}</div>
                </div>
              ))}
            </div>
            {/* Resumen de horas del período */}
            {allDates.length > 0 && (()=>{
              const totalHrs = Object.values(dateHours).reduce((a,b)=>a+b,0);
              const hrsHoy = dateHours[selectedDate] || classHours || 1;
              return (
                <div style={{background:C.card,border:`1px solid ${C.teal}44`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",gap:16,flexWrap:"wrap"}}>
                  <div style={{textAlign:"center",flex:1}}>
                    <div style={{fontSize:20,fontWeight:800,color:C.teal}}>{totalHrs}</div>
                    <div style={{fontSize:11,color:C.muted}}>hrs totales período</div>
                  </div>
                  <div style={{textAlign:"center",flex:1}}>
                    <div style={{fontSize:20,fontWeight:800,color:C.accent}}>{allDates.length}</div>
                    <div style={{fontSize:11,color:C.muted}}>clases registradas</div>
                  </div>
                  <div style={{textAlign:"center",flex:1}}>
                    <div style={{fontSize:20,fontWeight:800,color:C.purple}}>{hrsHoy}</div>
                    <div style={{fontSize:11,color:C.muted}}>hrs esta clase</div>
                  </div>
                </div>
              );
            })()}
            {/* Progress bar */}
            {students.length>0&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 20px",marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:12}}>
                  <span style={{color:C.muted}}>Progreso — {fmtDate(selectedDate)}</span>
                  <span style={{color:C.accent,fontWeight:600}}>{students.length-counts.pending}/{students.length}</span>
                </div>
                <div style={{background:C.border,borderRadius:6,height:8,overflow:"hidden",display:"flex"}}>
                  {[{v:counts.present,c:C.success},{v:counts.late,c:C.late},{v:counts.excused,c:C.excused},{v:counts.absent,c:C.danger}].map((seg,i)=>(
                    <div key={i} style={{height:"100%",width:`${(seg.v/Math.max(students.length,1))*100}%`,background:seg.c,transition:"width .4s ease"}}/>
                  ))}
                </div>
              </div>
            )}
            {/* Toolbar */}
            {!isViewer&&(
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
                <button className="btn" onClick={()=>fileRef.current.click()} style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>📥 Excel</button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelected} style={{display:"none"}}/>
                <button className="btn" onClick={downloadStudentsTemplate} title="Descargar plantilla de ejemplo" style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",fontSize:13,fontFamily:"inherit"}}>📄 Plantilla</button>
                <AddStudentInline onAdd={addStudent}/>
                <div style={{marginLeft:"auto",display:"flex",gap:7,flexWrap:"wrap"}}>
                  <button className="btn" onClick={()=>markAll("present")} style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:9,padding:"8px 11px",fontSize:13}}>✅ Todos</button>
                  <button className="btn" onClick={()=>markAll("late")} style={{background:`${C.late}22`,color:C.late,border:`1px solid ${C.late}44`,borderRadius:9,padding:"8px 11px",fontSize:13}}>🕐 Todos</button>
                  <button className="btn" onClick={()=>markAll("absent")} style={{background:`${C.danger}22`,color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:9,padding:"8px 11px",fontSize:13}}>❌ Todos</button>
                  <button className="btn" onClick={()=>setShowExport(true)} style={{background:`linear-gradient(135deg,${C.purple},${C.accent})`,color:"#fff",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>📦 Exportar</button>
                  <button className="btn" onClick={()=>{
                    const ausentes = students.filter(s=>getStatus(s.id)==="absent"&&s.tutor_phone);
                    if(!ausentes.length){showToast("⚠️ Sin ausentes con tutor registrado");return;}
                    ausentes.forEach(s=>sendWhatsApp({student:s,date:selectedDate,sessionName:activeSession.name,status:"absent",reason:""}));
                    showToast(`📲 ${ausentes.length} mensajes abiertos`);
                  }} style={{background:"#25d36622",color:"#25d366",border:"1.5px solid #25d36666",borderRadius:9,padding:"8px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
                    📲 Avisar ausentes
                  </button>
                </div>
              </div>
            )}
            {/* Filter chips */}
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {[["all","Todos",C.accent],["present","Presentes",C.success],["late","Retardos",C.late],["excused","Justificadas",C.excused],["absent","Ausentes",C.danger],["pending","Pendientes",C.muted]].map(([f,l,color])=>(
                <button key={f} className="btn chip" onClick={()=>setFilter(f)} style={{background:filter===f?`${color}22`:"transparent",color:filter===f?color:C.muted,borderColor:filter===f?color:C.border}}>{l}</button>
              ))}
            </div>
            {/* Student list */}
            {students.length===0?<Empty icon="👥" msg="No hay alumnos. Importa un Excel o agrégalos manualmente."/>:(
              <div style={{display:"grid",gap:8}}>
                {filteredStudents.map((s,i)=>{
                  const st = getStatus(s.id); const cfg = STATUS[st]; const reason = attendance[s.id]?.reason||"";
                  return(
                    <div key={s.id} className="row-hover" style={{background:C.card,border:`1px solid ${cfg.color}44`,borderRadius:12,padding:"12px 14px",animation:`slideIn .3s ease both`,animationDelay:`${i*.025}s`}}>
                      {/* Fila superior: avatar + nombre + botones secundarios */}
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,background:cfg.bg,color:cfg.color,flexShrink:0}}>{s.name.charAt(0).toUpperCase()}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                          <div style={{fontSize:11,color:cfg.color,display:"flex",alignItems:"center",gap:4,marginTop:1}}>
                            <span>{cfg.icon}</span><span>{cfg.label}</span>
                            {st==="excused"&&reason&&<span style={{color:C.muted,marginLeft:4}}>· {reason.length>25?reason.substring(0,25)+"…":reason}</span>}
                          </div>
                        </div>
                        {/* Botones secundarios (historial, tutor, whatsapp) */}
                        <div style={{display:"flex",gap:5,flexShrink:0}}>
                          <button className="btn" onClick={()=>{setSearchQuery(s.name);searchStudent(s.name);}} title="Ver historial" style={{background:`${C.purple}18`,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:8,padding:"6px 8px",fontSize:13}}>📅</button>
                          <button className="btn" onClick={()=>setTutorTarget(s)} title={s.tutor_phone?"Editar tutor":"Agregar tutor"}
                            style={{background:s.tutor_phone?"#25d36622":"transparent",color:s.tutor_phone?"#25d366":C.muted,border:`1.5px solid ${s.tutor_phone?"#25d366":C.border}`,borderRadius:8,padding:"6px 8px",fontSize:13}}>
                            📱
                          </button>
                          {s.tutor_phone&&(st==="absent"||st==="late"||st==="excused")&&(
                            <button className="btn" onClick={()=>{
                              const ok=sendWhatsApp({student:s,date:selectedDate,sessionName:activeSession.name,status:st,reason:attendance[s.id]?.reason||""});
                              if(!ok)showToast("⚠️ Sin teléfono");else showToast("📲 Abriendo WhatsApp...");
                            }} style={{background:"#25d36622",color:"#25d366",border:"1.5px solid #25d36666",borderRadius:8,padding:"6px 8px",fontSize:13}}>
                              📲
                            </button>
                          )}
                          {!isViewer&&<button className="btn" onClick={()=>removeStudent(s.id)} style={{background:"none",color:C.muted,border:"none",padding:"6px 6px",fontSize:14,opacity:.5}}>×</button>}
                        </div>
                      </div>
                      {/* Fila inferior: botones de asistencia — ancho completo */}
                      {!isViewer&&(
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                          <button className="btn" onClick={()=>toggleAtt(s.id,"present")} style={{background:st==="present"?C.success:`${C.success}15`,color:st==="present"?"#fff":C.success,border:`1.5px solid ${C.success}66`,borderRadius:8,padding:"8px 4px",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>✅ Presente</button>
                          <button className="btn" onClick={()=>toggleAtt(s.id,"late")} style={{background:st==="late"?C.late:`${C.late}15`,color:st==="late"?"#fff":C.late,border:`1.5px solid ${C.late}66`,borderRadius:8,padding:"8px 4px",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>🕐 Retardo</button>
                          <button className="btn" onClick={()=>openJustify(s)} style={{background:st==="excused"?C.excused:`${C.excused}15`,color:st==="excused"?"#fff":C.excused,border:`1.5px solid ${C.excused}66`,borderRadius:8,padding:"8px 4px",fontSize:12,fontWeight:st==="excused"?700:600,fontFamily:"inherit"}}>📝 Justif.</button>
                          <button className="btn" onClick={()=>toggleAtt(s.id,"absent")} style={{background:st==="absent"?C.danger:`${C.danger}15`,color:st==="absent"?"#fff":C.danger,border:`1.5px solid ${C.danger}66`,borderRadius:8,padding:"8px 4px",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>❌ Ausente</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* REPORT TAB */}
        {view==="attendance"&&activeSession&&mainTab==="report"&&(
          <ReportModule sessionId={activeSession.id} students={students}/>
        )}

        {/* STUDENT HISTORY */}
        {view==="student-history"&&searchResult?.student&&(
          <div style={{animation:"fadeUp .4s ease both"}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"28px",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:24}}>
                <div style={{width:62,height:62,borderRadius:16,background:`linear-gradient(135deg,${C.accent}33,${C.purple}33)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:700,color:C.accent}}>{searchResult.student.name.charAt(0).toUpperCase()}</div>
                <div><h2 style={{fontFamily:"'Merriweather',serif",fontSize:20,fontWeight:700}}>{searchResult.student.name}</h2><div style={{color:C.muted,fontSize:13,marginTop:3}}>Historial — {activeSession?.name}</div></div>
              </div>
              {(()=>{
                const total=searchResult.history.length, pres=searchResult.history.filter(h=>h.status==="present").length;
                const late=searchResult.history.filter(h=>h.status==="late").length, exc=searchResult.history.filter(h=>h.status==="excused").length;
                const aus=searchResult.history.filter(h=>h.status==="absent").length, pct=total>0?Math.round(((pres+late+exc)/total)*100):0;
                return(
                  <div className="grid-stats-6" style={{marginBottom:24}}>
                    {[{label:"Clases",v:total,color:C.accent,icon:"📅"},{label:"Presencias",v:pres,color:C.success,icon:"✅"},{label:"Retardos",v:late,color:C.late,icon:"🕐"},{label:"Justificadas",v:exc,color:C.excused,icon:"📝"},{label:"Faltas",v:aus,color:C.danger,icon:"❌"},{label:"% Asist.",v:pct+"%",color:pct>=80?C.success:pct>=60?C.warning:C.danger,icon:"📊"}].map(st=>(
                      <div key={st.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
                        <div>{st.icon}</div>
                        <div style={{fontSize:18,fontWeight:700,color:st.color,fontFamily:"'Space Grotesk',sans-serif",marginTop:4}}>{st.v}</div>
                        <div style={{color:C.muted,fontSize:10,marginTop:2}}>{st.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {searchResult.history.length===0?<Empty icon="📭" msg="Sin registros guardados"/>:(
                <>
                  <div style={{fontSize:11,color:C.muted,fontWeight:700,letterSpacing:1,marginBottom:10}}>LÍNEA DE TIEMPO</div>
                  <div style={{display:"grid",gap:8,maxHeight:400,overflowY:"auto"}}>
                    {searchResult.history.map((h,i)=>{
                      const cfg = STATUS[h.status]||STATUS.pending;
                      return(
                        <div key={h.date} style={{background:C.surface,border:`1px solid ${cfg.color}33`,borderRadius:10,padding:"12px 16px",animation:`slideIn .25s ease both`,animationDelay:`${i*.04}s`}}>
                          <div style={{display:"flex",alignItems:"center",gap:14}}>
                            <div style={{fontSize:18}}>{cfg.icon}</div>
                            <div style={{flex:1}}><div style={{fontWeight:500,fontSize:13}}>{fmtDate(h.date)}</div><div style={{fontSize:11,color:C.muted}}>{h.date}</div></div>
                            <div style={{fontSize:12,fontWeight:600,color:cfg.color,background:`${cfg.color}18`,border:`1px solid ${cfg.color}44`,borderRadius:6,padding:"3px 12px"}}>{cfg.label}</div>
                          </div>
                          {h.status==="excused"&&h.reason&&(
                            <div style={{marginTop:8,marginLeft:32,background:`${C.excused}11`,border:`1px solid ${C.excused}33`,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.excused}}>
                              <span style={{fontWeight:600}}>Motivo: </span>{h.reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <button className="btn" onClick={()=>{setView("attendance");setSearchResult(null);setSearchQuery("");}} style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"10px 20px",fontSize:14,fontFamily:"inherit"}}>← Volver</button>
          </div>
        )}
      </main>
    </div>
  );
}
