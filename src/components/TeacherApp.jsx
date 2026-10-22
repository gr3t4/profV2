import { useState, useEffect, useRef, useMemo } from "react";
import { sb, fetchAll } from "../lib/supabase";
import { queueAttendance, queueHours, flush, pendingCount, pendingFor, pendingDates, onPendingChange } from "../lib/offlineQueue";
import { C, BRAND, STATUS, TURNOS, today, fmtDate } from "../lib/constants";
import { GlobalStyles, Glow, Toast, Empty, AddStudentInline, BrandMark } from "./Shared";
import JustifyModal from "./JustifyModal";
import ExportModal from "./ExportModal";
import ImportPreviewModal from "./ImportPreviewModal";
import ReportModule from "./ReportModule";
import TutorModal from "./TutorModal";
import MensajeModal from "./MensajeModal";
import MiCuentaModal from "./MiCuentaModal";
import ActividadesModule from "./ActividadesModule";
import CalificacionesModule from "./CalificacionesModule";
import { evalConfig, cargarDatosClase, evaluar, NIVEL } from "../lib/evaluacion";
import ClaseForm from "./ClaseForm";
import { horasDelDia, enCurso, inicioDelDia, resumenHorario, horaMX, nombreClase, tieneClase } from "../lib/horario";
import { buildTutoriaMessage } from "../lib/whatsapp";
import { parseStudentsExcel, downloadStudentsTemplate } from "../lib/excelStudents";
// Orden alfabético en español (acentos y ñ correctos)
const byName = (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });

export default function TeacherApp({ user, onLogout, onProfileChange }) {
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
  const [grupos, setGrupos]             = useState([]);
  const [claseForm, setClaseForm]       = useState(null); // null | {initial: session|null}
  const [toast, setToast]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(false);
  const [lastSaved, setLastSaved]       = useState(null);
  const [pending, setPending]           = useState(() => pendingCount()); // marcas guardadas en el celular sin enviar
  const [online, setOnline]             = useState(() => navigator.onLine !== false);
  const [justifyTarget, setJustifyTarget] = useState(null);
  const [showExport, setShowExport]     = useState(false);
  const [tutorTarget, setTutorTarget]   = useState(null);
  const [mensaje, setMensaje]           = useState(null); // texto del mensaje de faltas
  const [showCuenta, setShowCuenta]     = useState(false);
  const [importPreview, setImportPreview] = useState(null); // rows parsed, pending confirmación
  const [evalDatos, setEvalDatos]       = useState(null); // { sid, att, acts, marks }
  const [evalLoading, setEvalLoading]   = useState(false);
  const [gradesFilter, setGradesFilter] = useState("all");
  const fileRef = useRef();
  const isViewer = user.role === "viewer";

  async function loadSessions() {
    const [{ data }, { data:gs }] = await Promise.all([
      sb.from("sessions").select("*, grupo:grupos(id,name,turno)").eq("owner_id", user.id).order("created_at", { ascending:false }),
      sb.from("grupos").select("id,name,turno").order("name"),
    ]);
    setSessions(data || []);
    setGrupos(gs || []);
  }

  useEffect(() => { (async () => { await loadSessions(); })(); }, []);

  // Sincronización de marcas guardadas sin internet
  useEffect(() => {
    const off = onPendingChange(setPending);
    const sync = async () => {
      if (!pendingCount()) return;
      const r = await flush();
      if (r.sent) { setLastSaved(new Date()); setSaveError(false); }
      if (r.rejected) { setSaveError(true); showToast("❌ No se guardó: " + r.rejected); }
    };
    const goOnline  = () => { setOnline(true); sync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const iv = setInterval(sync, 20000);
    sync();
    return () => { off(); window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); clearInterval(iv); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresca los datos solos: al volver a la pestaña/ventana y cada minuto.
  // Así lo que se registra en otro dispositivo (p. ej. el celular) aparece en la
  // computadora sin recargar la página.
  const live = useRef({});
  live.current = { view, activeSession, selectedDate };
  useEffect(() => {
    let busy = false;
    const refresh = async () => {
      if (busy || document.visibilityState === "hidden" || navigator.onLine === false) return;
      busy = true;
      try {
        await loadSessions();
        const { view: v, activeSession: s, selectedDate: d } = live.current;
        if (v === "attendance" && s) {
          if (s.grupo_id) {
            const { data:studs } = await fetchAll(() => sb.from("students").select("*").eq("grupo_id", s.grupo_id).eq("active", true).order("name").order("id"));
            if (studs && live.current.activeSession?.id === s.id) setStudents(studs.slice().sort(byName));
          }
          const [{ data:attRows }, { data:hoursRows }] = await Promise.all([
            fetchAll(() => sb.from("attendance").select("date").eq("session_id", s.id).order("id")),
            fetchAll(() => sb.from("class_hours").select("date,hours").eq("session_id", s.id).order("date")),
          ]);
          if (live.current.activeSession?.id !== s.id) return;
          const pend = pendingDates(s.id);
          if (attRows) setAllDates([...new Set([...attRows.map(r=>r.date), ...pend.dates])].sort().reverse());
          if (hoursRows) { const hm = {}; hoursRows.forEach(r=>{ hm[r.date]=r.hours; }); Object.assign(hm, pend.hours); setDateHours(hm); if (hm[d]) setClassHours(hm[d]); }
          if (live.current.selectedDate === d) await loadAttendanceForDate(s.id, d);
          await loadEval(s);
        }
      } catch { /* sin conexión: se intenta después */ }
      finally { busy = false; }
    };
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    const iv = setInterval(refresh, 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", refresh); clearInterval(iv); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Datos para calificaciones y alertas de riesgo (asistencia completa + actividades)
  async function loadEval(s) {
    if (!s) return;
    setEvalLoading(true);
    try {
      const d = await cargarDatosClase(s.id);
      if (live.current.activeSession?.id === s.id || !live.current.activeSession) setEvalDatos({ sid: s.id, ...d });
    } catch { /* sin conexión: se conserva lo anterior */ }
    finally { setEvalLoading(false); }
  }

  async function selectSession(s) {
    setActiveSess(s);
    setEvalDatos(null); setGradesFilter("all");
    live.current.activeSession = s;
    loadEval(s);
    // La lista de alumnos es la del grupo (compartida por todas sus materias)
    const { data:studs } = s.grupo_id
      ? await fetchAll(() => sb.from("students").select("*").eq("grupo_id", s.grupo_id).eq("active", true).order("name").order("id"))
      : await sb.from("students").select("*").eq("session_id", s.id).order("created_at");
    setStudents((studs || []).slice().sort(byName));
    const { data:attRows } = await fetchAll(() => sb.from("attendance").select("date").eq("session_id", s.id).order("id"));
    const pend = pendingDates(s.id);
    const dates = [...new Set([...(attRows||[]).map(r=>r.date), ...pend.dates])].sort().reverse();
    setAllDates(dates);
    // Cargar horas por fecha
    const { data:hoursRows } = await fetchAll(() => sb.from("class_hours").select("date,hours").eq("session_id", s.id).order("date"));
    const hm = {}; (hoursRows||[]).forEach(r=>{ hm[r.date]=r.hours; });
    Object.assign(hm, pend.hours);
    setDateHours(hm);
    const d = today(); setSelectedDate(d);
    setClassHours(hm[d] || horasDelDia(s.horario, d) || 1);
    await loadAttendanceForDate(s.id, d);
    setFilter("all"); setSearchQuery(""); setSearchResult(null); setLastSaved(null); setSaveError(false);
    setMainTab("attendance"); setView("attendance");
  }

  async function loadAttendanceForDate(sessionId, date) {
    const { data } = await sb.from("attendance").select("student_id,status,reason").eq("session_id", sessionId).eq("date", date);
    const m = {}; (data||[]).forEach(r => { m[r.student_id] = { status:r.status, reason:r.reason||"" }; });
    Object.assign(m, pendingFor(sessionId, date)); // lo marcado sin internet tiene prioridad
    setAttendance(m);
  }

  async function changeDate(d) {
    setSelectedDate(d);
    setClassHours(dateHours[d] || horasDelDia(activeSession.horario, d) || 1);
    await loadAttendanceForDate(activeSession.id, d);
    setFilter("all");
  }

  // Guarda los registros indicados ({ id: {status, reason} }) para la fecha dada.
  // Primero quedan guardados en el celular y luego se envían a Supabase; si no hay
  // internet se envían solos cuando vuelva la conexión.
  async function persistAttendance(entries, date) {
    const ids = Object.keys(entries);
    if (!ids.length || !activeSession) return;
    queueAttendance(ids.map(id => ({
      session_id: activeSession.id, student_id: id, date,
      status: entries[id].status, reason: entries[id].reason || null,
    })));
    // Primera vez que se registra esta fecha: guardar también las horas y agregarla a la lista
    if (!allDates.includes(date)) {
      const hrs = parseFloat(classHours) || 1;
      queueHours(activeSession.id, date, hrs);
      setDateHours(p => ({...p, [date]: hrs}));
      setAllDates(p => p.includes(date) ? p : [...p, date].sort().reverse());
    }
    setSaving(true);
    const r = await flush();
    setSaving(false);
    if (r.sent) { setLastSaved(new Date()); setSaveError(false); }
    if (r.rejected) { setSaveError(true); showToast("❌ No se guardó: " + r.rejected); }
  }

  // Guarda las horas de clase de la fecha activa (si la fecha ya tiene registros)
  async function persistHours() {
    if (!activeSession || !allDates.includes(selectedDate)) return;
    const hrs = parseFloat(classHours) || 1;
    if (dateHours[selectedDate] === hrs) return;
    queueHours(activeSession.id, selectedDate, hrs);
    setDateHours(p => ({...p, [selectedDate]: hrs}));
    const r = await flush();
    showToast(r.offline ? "📴 Horas guardadas en el celular" : r.rejected ? "❌ " + r.rejected : "💾 Horas guardadas");
  }

  function toggleAtt(id, status) {
    const reason = status === "excused" ? (attendance[id]?.reason || "") : "";
    setAttendance(prev => ({...prev, [id]: { status, reason }}));
    persistAttendance({ [id]: { status, reason } }, selectedDate);
  }
  function markAll(status) {
    const att = {}; students.forEach(s => att[s.id] = { status, reason:"" }); setAttendance(att);
    persistAttendance(att, selectedDate);
    showToast(STATUS[status].icon + " Todos: " + STATUS[status].label);
  }
  function openJustify(student) { setJustifyTarget({ student, date:selectedDate }); }
  function saveJustification(reason) {
    const { student, date } = justifyTarget;
    setAttendance(prev => ({...prev, [student.id]: { status:"excused", reason }}));
    persistAttendance({ [student.id]: { status:"excused", reason } }, date);
    setJustifyTarget(null); showToast("📝 Justificación guardada");
  }

  // Clase creada o editada desde el formulario (grupo, materia, turno y horario)
  function onClaseSaved(saved, isNew, added = 0) {
    setClaseForm(null);
    setSessions(p => isNew ? [saved, ...p] : p.map(x => x.id === saved.id ? saved : x));
    if (saved.grupo && !grupos.some(g => g.id === saved.grupo.id)) setGrupos(p => [...p, saved.grupo].sort((a,b)=>a.name.localeCompare(b.name)));
    else if (saved.grupo) setGrupos(p => p.map(g => g.id === saved.grupo.id ? { ...g, ...saved.grupo } : g));
    if (activeSession?.id === saved.id) {
      setActiveSess(saved);
      if (!allDates.includes(selectedDate)) setClassHours(horasDelDia(saved.horario, selectedDate) || classHours);
    }
    showToast(isNew ? (added ? `✅ Clase creada · ${added} alumnos en el grupo ${saved.grupo?.name||""}` : "✅ Clase creada") : "💾 Clase actualizada");
    if (isNew) selectSession(saved); // abre la clase nueva con la lista del grupo ya cargada
  }
  async function deleteSession(s) {
    if (!window.confirm(`¿Eliminar la clase "${nombreClase(s)}" y toda su asistencia?\nLa lista de alumnos del grupo no se borra.`)) return;
    const { error } = await sb.from("sessions").delete().eq("id", s.id);
    if (error) { showToast("❌ " + error.message); return; }
    setSessions(p => p.filter(x => x.id !== s.id)); showToast("🗑️ Clase eliminada");
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    const rows = await parseStudentsExcel(file);
    if (!rows.length) { showToast("⚠️ Sin nombres detectados en el archivo"); return; }
    setImportPreview(rows);
  }

  async function confirmImport(selectedRows) {
    if (!activeSession.grupo_id) { showToast("⚠️ Primero asigna un grupo a esta clase (✏️)"); return; }
    const existing = students.map(s => s.name.toLowerCase());
    const toInsert = selectedRows.filter(r => !existing.includes(r.name.toLowerCase()));
    if (!toInsert.length) { showToast("ℹ️ Todos ya existen"); setImportPreview(null); return; }
    const { data, error } = await sb.from("students").insert(toInsert.map(r => ({
      grupo_id: activeSession.grupo_id,
      name: r.name,
      tutor_name: r.tutorName || null,
      tutor_phone: r.tutorPhone || null,
    }))).select();
    if (error) { showToast("❌ " + error.message); return; }
    setStudents(p => [...p, ...data].sort(byName));
    setImportPreview(null);
    showToast(`📥 ${data.length} agregados al grupo ${activeSession.grupo?.name || ""}`);
  }
  async function addStudent(name) {
    if (!activeSession.grupo_id) { showToast("⚠️ Primero asigna un grupo a esta clase (✏️)"); return; }
    const { data, error } = await sb.from("students").insert({ grupo_id:activeSession.grupo_id, name:name.trim() }).select().single();
    if (error) { showToast("❌ " + error.message); return; }
    setStudents(p => [...p, data].sort(byName));
  }
  // Baja del grupo: deja de aparecer en todas las materias, pero conserva su historial
  async function removeStudent(id) {
    const st = students.find(x => x.id === id);
    if (!window.confirm(`¿Dar de baja a ${st?.name} del grupo ${activeSession.grupo?.name || ""}?\nDejará de aparecer en todas las materias del grupo. Su asistencia anterior se conserva.`)) return;
    const { error } = await sb.from("students").update({ active:false }).eq("id", id);
    if (error) { showToast("❌ " + error.message); return; }
    setStudents(p => p.filter(s => s.id !== id));
    setAttendance(p => { const a = {...p}; delete a[id]; return a; });
  }

  async function searchStudent(q) {
    const query = q.trim().toLowerCase(); if (!query || !activeSession) { setSearchResult(null); return; }
    const found = students.find(s => s.name.toLowerCase().includes(query));
    if (!found) { setSearchResult({ notFound:true, query:q }); return; }
    const { data } = await fetchAll(() => sb.from("attendance").select("date,status,reason").eq("student_id", found.id).eq("session_id", activeSession.id).order("date", { ascending:false }).order("id"));
    setSearchResult({ student:found, history:data||[] }); setView("student-history");
  }

  async function handleExport(type) {
    showToast("⏳ Generando Excel…");
    try {
      const { data:allAtt } = await fetchAll(() => sb.from("attendance").select("student_id,date,status,reason").eq("session_id", activeSession.id).order("id"));
      const idx = {}; (allAtt||[]).forEach(r => { if (!idx[r.student_id]) idx[r.student_id] = {}; idx[r.student_id][r.date] = { status:r.status, reason:r.reason||"" }; });
      // Lo marcado sin internet también entra en el reporte
      for (const d of allDates) { const p = pendingFor(activeSession.id, d); for (const id in p) { (idx[id] ||= {})[d] = p[id]; } }
      const { exportarAsistencia } = await import("../lib/exportAsistencia");
      const ok = await exportarAsistencia(type, {
        docente: user.name, grupo: activeSession.grupo?.name || "", materia: activeSession.materia || activeSession.name,
        clase: nombreClase(activeSession), selectedDate, dates: [...allDates].sort(), students, attendanceDay: attendance, idx,
      });
      showToast(ok ? "📥 Excel descargado" : "⚠️ Sin alumnos");
    } catch (e) {
      showToast("❌ No se pudo generar el Excel: " + (e?.message || e));
    }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function saveTutor(updated) {
    setStudents(p => p.map(s => s.id === updated.id ? updated : s));
    setTutorTarget(null);
    showToast("📱 Tutor guardado");
  }

  const getStatus = (id) => attendance[id]?.status || "pending";

  // Mensaje de faltas (docente, materia, fecha y alumnos con falta) para copiar
  function generarMensaje() {
    const ausentes = students.filter(s=>getStatus(s.id)==="absent");
    if(!ausentes.length){showToast("⚠️ No hay faltas en esta fecha");return;}
    setMensaje(buildTutoriaMessage({ contactName:"", date:selectedDate, sessionName:nombreClase(activeSession),
      absentStudents:ausentes, totalStudents:students.length, teacherName:user.name }));
  }
  const counts = {
    present: students.filter(s=>getStatus(s.id)==="present").length,
    late:    students.filter(s=>getStatus(s.id)==="late").length,
    excused: students.filter(s=>getStatus(s.id)==="excused").length,
    absent:  students.filter(s=>getStatus(s.id)==="absent").length,
    pending: students.filter(s=>getStatus(s.id)==="pending").length,
  };
  // Calificaciones y riesgo (se recalculan al pasar lista, sin esperar al servidor)
  const evalCfg = useMemo(() => evalConfig(activeSession), [activeSession]);
  const stats = useMemo(() => {
    if (!evalDatos || !activeSession || evalDatos.sid !== activeSession.id) return null;
    const extraAtt = Object.entries(attendance).filter(([, r]) => r?.status).map(([id, r]) => ({ student_id:id, date:selectedDate, status:r.status }));
    const att = evalDatos.att.filter(r => r.date !== selectedDate);
    return evaluar({ students, att, acts: evalDatos.acts, marks: evalDatos.marks, cfg: evalCfg, extraAtt });
  }, [evalDatos, activeSession, students, attendance, selectedDate, evalCfg]);

  async function exportCalificaciones() {
    if (!stats) { showToast("⏳ Aún se están cargando los datos"); return; }
    showToast("⏳ Generando Excel…");
    try {
      const { exportarCalificaciones } = await import("../lib/exportAsistencia");
      await exportarCalificaciones({ docente:user.name, grupo:activeSession.grupo?.name || "", materia:activeSession.materia || activeSession.name,
        clase:nombreClase(activeSession), students, acts:evalDatos.acts, marks:evalDatos.marks, ev:stats, cfg:evalCfg });
      showToast("📥 Excel descargado");
    } catch (e) { showToast("❌ No se pudo generar el Excel: " + (e?.message || e)); }
  }

  function onSessionUpdated(s2) {
    setActiveSess(s2);
    setSessions(p => p.map(x => x.id === s2.id ? s2 : x));
  }

  const filteredStudents = students.filter(s => filter==="all" ? true : filter==="pending" ? getStatus(s.id)==="pending" : getStatus(s.id)===filter);

  const MAIN_TABS = [
    { id:"attendance", label:"📋 Asistencia" },
    { id:"activities", label:"📝 Actividades" },
    { id:"grades",     label:`🎓 Calificaciones${stats && (stats.resumen.reprobando + stats.resumen.riesgo) ? ` ⚠️${stats.resumen.reprobando + stats.resumen.riesgo}` : ""}` },
    { id:"report",     label:"📈 Reporte" },
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Source Sans 3',sans-serif",color:C.text,position:"relative"}}>
      <GlobalStyles/>
      <Glow top="-15%" right="-5%" color="0,126,103" size="40vw"/>
      <Glow bottom="-10%" left="-5%" color="157,36,73" size="35vw"/>
      {toast && <Toast msg={toast}/>}
      {justifyTarget && <JustifyModal student={justifyTarget.student} date={justifyTarget.date} currentReason={attendance[justifyTarget.student.id]?.reason||""} onSave={saveJustification} onClose={()=>setJustifyTarget(null)}/>}
      {showExport && <ExportModal hasMultipleDates={allDates.length>0} onExport={handleExport} onClose={()=>setShowExport(false)}/>}
      {showCuenta && <MiCuentaModal user={user} onNameChanged={n=>{onProfileChange?.({ name:n }); showToast("✅ Nombre actualizado");}} onClose={()=>setShowCuenta(false)}/>}
      {mensaje && activeSession && <MensajeModal initial={mensaje} title={`${nombreClase(activeSession)} · ${fmtDate(selectedDate)}`} onClose={()=>setMensaje(null)}/>}
      {tutorTarget && <TutorModal student={tutorTarget} sessionName={nombreClase(activeSession)} onSave={saveTutor} onClose={()=>setTutorTarget(null)}/>}
      {claseForm && <ClaseForm user={user} grupos={grupos} initial={claseForm.initial} onSaved={onClaseSaved} onClose={()=>setClaseForm(null)}/>}
      {importPreview && <ImportPreviewModal rows={importPreview} existingNames={students.map(s=>s.name)} onConfirm={confirmImport} onClose={()=>setImportPreview(null)}/>}

      <div style={{height:3,background:BRAND.stripe}}/>
      <header style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 14px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:980,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
            {view!=="sessions"&&<button className="btn" onClick={()=>{if(view==="student-history"){setView("attendance");setSearchResult(null);setSearchQuery("");}else{setView("sessions");setActiveSess(null);}}} style={{background:"none",color:C.muted,fontSize:20,padding:"4px 6px",flexShrink:0}}>←</button>}
            <BrandMark size={28}/>
            <span style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:16,color:C.text,flexShrink:0}}>AppProf</span>
            {activeSession&&view!=="sessions"&&<span className="hide-mobile" style={{color:C.muted,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>/ {nombreClase(activeSession)}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {isViewer&&<span className="hide-mobile" style={{background:`${C.warning}22`,color:C.warning,border:`1px solid ${C.warning}44`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>LECTURA</span>}
            <button className="btn" onClick={()=>setShowCuenta(true)} title="Mi cuenta: cambiar nombre o contraseña"
              style={{background:`${C.accent}18`,color:C.text,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 10px",fontSize:12,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,maxWidth:200}}>
              <span>👤</span><span className="hide-mobile" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span><span style={{color:C.muted}}>✏️</span>
            </button>
            <button className="btn" onClick={onLogout} style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:8,padding:"6px 12px",fontSize:12,fontFamily:"inherit"}}>Salir</button>
          </div>
        </div>
      </header>

      {/* Sub-tabs when inside a session */}
      {view!=="sessions"&&view!=="student-history"&&(
        <div className="tabs-scroll" style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 8px"}}>
          <div style={{maxWidth:980,margin:"0 auto",display:"flex",gap:4,minWidth:"max-content"}}>
            {MAIN_TABS.map(t=>(
              <button key={t.id} className="btn" onClick={()=>{setMainTab(t.id); if(t.id==="grades") setGradesFilter("all");}}
                style={{background:"none",color:mainTab===t.id?C.accent:C.muted,borderBottom:mainTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",padding:"12px 12px",fontSize:14,fontFamily:"inherit",fontWeight:mainTab===t.id?600:400,whiteSpace:"nowrap",transition:"all .2s"}}>
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:10,flexWrap:"wrap"}}>
              <div><h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700}}>Mis clases</h2><p style={{color:C.muted,fontSize:13,marginTop:4}}>{fmtDate(today())} · la clase que toca aparece primero</p></div>
              {!isViewer&&<button className="btn" onClick={()=>setClaseForm({initial:null})} style={{background:`linear-gradient(135deg,${C.accent},${C.purple})`,color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>+ Nueva clase</button>}
            </div>
            {sessions.length===0?<Empty icon="🗂️" msg="No hay clases. ¡Crea la primera!"/>:(()=>{
              const d = today(), now = horaMX();
              const rank = (s) => enCurso(s.horario, d, now) ? 0 : tieneClase(s.horario, d) ? 1 : 2;
              const sorted = [...sessions].sort((a,b) => rank(a)-rank(b) || (inicioDelDia(a.horario,d)||"99").localeCompare(inicioDelDia(b.horario,d)||"99") || nombreClase(a).localeCompare(nombreClase(b)));
              return (
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:12}}>
                {sorted.map((s,i)=>{
                  const r = rank(s), turno = s.grupo?.turno || s.turno, res = resumenHorario(s.horario);
                  return (
                  <div key={s.id} className="row-hover" onClick={()=>selectSession(s)} style={{background:r===0?`${C.accent}18`:C.card,border:`1px solid ${r===0?C.accent:C.border}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,animation:`slideIn .3s ease both`,animationDelay:`${i*.05}s`,minWidth:0}}>
                    <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${C.accent}33,${C.purple}22)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:s.grupo?.name?.length>4?11:15,color:C.text,flexShrink:0,textAlign:"center",lineHeight:1.1,padding:2}}>{s.grupo?.name || "📚"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:15,overflowWrap:"anywhere"}}>{s.materia || s.name}
                        {r===0&&<span style={{marginLeft:8,background:C.accent,color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700,verticalAlign:"middle"}}>AHORA</span>}
                        {r===1&&<span style={{marginLeft:8,background:`${C.teal}33`,color:C.teal,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700,verticalAlign:"middle"}}>HOY {inicioDelDia(s.horario,d)}</span>}
                      </div>
                      <div style={{color:C.muted,fontSize:12,marginTop:3,display:"flex",flexWrap:"wrap",gap:"2px 10px"}}>
                        {s.grupo?.name&&<span>👥 Grupo {s.grupo.name}</span>}
                        {turno&&<span style={{color:C.gold}}>{TURNOS[turno].icon} {TURNOS[turno].label}</span>}
                        {res ? <span>🕐 {res}</span> : !isViewer && <span style={{color:C.warning}}>⚠️ Sin horario</span>}
                      </div>
                    </div>
                    {!isViewer&&(
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button className="btn" title="Editar materia y horario" onClick={e=>{e.stopPropagation();setClaseForm({initial:s});}} style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 9px"}}>✏️</button>
                        <button className="btn" title="Eliminar clase" onClick={e=>{e.stopPropagation();deleteSession(s);}} style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:"none",borderRadius:8,padding:"6px 9px"}}>🗑️</button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {view==="attendance"&&activeSession&&mainTab==="attendance"&&(
          <div style={{animation:"fadeUp .4s ease both"}}>
            {/* Date panel */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"16px 18px",marginBottom:16}}>
              <div style={{fontSize:11,color:C.teal,fontWeight:700,letterSpacing:1,marginBottom:12}}>SELECTOR DE FECHA</div>
              {/* Fecha activa + horas + estado de guardado */}
              <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:14,flexWrap:"wrap"}}>
                <div style={{flex:2,minWidth:130}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Fecha</div>
                  <input className="inp" type="date" value={selectedDate} onChange={e=>changeDate(e.target.value)}/>
                </div>
                <div style={{width:100,flexShrink:0}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Horas de clase</div>
                  <input className="inp" type="number" min="0.5" max="12" step="0.5"
                    value={classHours}
                    disabled={isViewer}
                    onChange={e=>setClassHours(e.target.value)}
                    onBlur={persistHours}
                    style={{textAlign:"center"}}/>
                </div>
                {!isViewer&&(()=>{
                  const st = pending>0 && !online ? ["📴 Sin internet · "+pending+" en el celular", C.warning]
                    : pending>0 ? ["⏳ Enviando "+pending+"…", C.teal]
                    : saving ? ["⏳ Guardando…", C.teal]
                    : saveError ? ["⚠️ Error al guardar", C.danger]
                    : lastSaved ? ["✅ Guardado automático", C.teal]
                    : ["💾 Autoguardado activo", C.teal];
                  return (
                    <div title="La asistencia se guarda en el celular y se envía sola en cuanto hay internet"
                      style={{alignSelf:"flex-end",flexShrink:0,borderRadius:10,padding:"10px 14px",fontSize:12,fontWeight:600,whiteSpace:"nowrap",
                        background:`${st[1]}22`,color:st[1],border:`1px solid ${st[1]}55`}}>
                      {st[0]}
                    </div>
                  );
                })()}
              </div>
              {/* Lista desplegable de fechas guardadas */}
              {allDates.length > 0 ? (
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>Fechas guardadas <span style={{background:`${C.accent}22`,color:C.accent,borderRadius:20,padding:"1px 8px",fontSize:11}}>{allDates.length}</span></span>
                    <span style={{color:C.teal,fontWeight:700}}>
                      {Object.values(dateHours).reduce((a,b)=>a+b,0)} hrs totales
                    </span>
                  </div>
                  <select className="inp" value={allDates.includes(selectedDate)?selectedDate:""}
                    onChange={e=>e.target.value&&changeDate(e.target.value)}
                    style={{width:"100%",cursor:"pointer"}}>
                    {!allDates.includes(selectedDate)&&<option value="">— {fmtDate(selectedDate)} (sin registros) —</option>}
                    {allDates.map(d=>(
                      <option key={d} value={d}>{fmtDate(d)} · {dateHours[d]||1}h</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span style={{color:C.muted,fontSize:12,fontStyle:"italic"}}>Sin fechas guardadas aún</span>
              )}
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
            {/* Resumen del día: solo asistencias y faltas */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[{label:"Asistencias",count:counts.present+counts.late,color:C.success,icon:"✅"},{label:"Faltas",count:counts.absent,color:C.danger,icon:"❌"}].map(st=>(
                <div key={st.label} style={{background:C.card,border:`1px solid ${st.color}44`,borderRadius:14,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                  <span style={{fontSize:18}}>{st.icon}</span>
                  <span style={{fontSize:22,fontWeight:700,color:st.color,fontFamily:"'Space Grotesk',sans-serif"}}>{st.count}</span>
                  <span style={{color:C.muted,fontSize:12}}>{st.label}</span>
                </div>
              ))}
            </div>
            {/* Alerta de alumnos en riesgo de reprobar */}
            {stats&&(stats.resumen.reprobando+stats.resumen.riesgo)>0&&(
              <button className="btn" onClick={()=>{setGradesFilter("risk");setMainTab("grades");}}
                style={{width:"100%",textAlign:"left",background:`${C.danger}12`,border:`1px solid ${C.danger}55`,borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,fontFamily:"inherit",color:C.text}}>
                <span style={{fontSize:20}}>⚠️</span>
                <span style={{flex:1,fontSize:13}}>
                  {stats.resumen.reprobando>0&&<b style={{color:C.danger}}>{stats.resumen.reprobando} reprobando</b>}
                  {stats.resumen.reprobando>0&&stats.resumen.riesgo>0&&" · "}
                  {stats.resumen.riesgo>0&&<b style={{color:C.warning}}>{stats.resumen.riesgo} en riesgo</b>}
                  <span style={{color:C.muted}}> por faltas o actividades</span>
                </span>
                <span style={{color:C.accent,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>Ver →</span>
              </button>
            )}
            {/* Toolbar */}
            {!isViewer&&(
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
                <button className="btn" onClick={()=>fileRef.current.click()} style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit"}} title="Importar alumnos a la lista del grupo">📥 Excel</button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelected} style={{display:"none"}}/>
                <button className="btn" onClick={downloadStudentsTemplate} title="Descargar plantilla de ejemplo" style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",fontSize:13,fontFamily:"inherit"}}>📄 Plantilla</button>
                <AddStudentInline onAdd={addStudent}/>
                <div style={{marginLeft:"auto",display:"flex",gap:7,flexWrap:"wrap"}}>
                  <button className="btn" onClick={()=>markAll("present")} style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:9,padding:"8px 11px",fontSize:13}}>✅ Todos</button>
                  <button className="btn" onClick={()=>markAll("late")} style={{background:`${C.late}22`,color:C.late,border:`1px solid ${C.late}44`,borderRadius:9,padding:"8px 11px",fontSize:13}}>🕐 Todos</button>
                  <button className="btn" onClick={()=>markAll("absent")} style={{background:`${C.danger}22`,color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:9,padding:"8px 11px",fontSize:13}}>❌ Todos</button>
                  <button className="btn" onClick={()=>setShowExport(true)} style={{background:`linear-gradient(135deg,${C.purple},${C.accent})`,color:"#fff",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>📦 Exportar</button>
                  <button className="btn" onClick={generarMensaje} title="Mensaje con docente, materia, fecha y alumnos con falta, para copiar"
                    style={{background:`${C.gold}22`,color:C.gold,border:`1.5px solid ${C.gold}66`,borderRadius:9,padding:"8px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
                    📋 Generar mensaje
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
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}}>
                {filteredStudents.map((s,i)=>{
                  const st = getStatus(s.id); const cfg = STATUS[st]; const reason = attendance[s.id]?.reason||"";
                  return(
                    <div key={s.id} className="row-hover" style={{background:C.card,border:`1px solid ${cfg.color}44`,borderRadius:12,padding:"12px 10px",minWidth:0,animation:`slideIn .3s ease both`,animationDelay:`${i*.025}s`}}>
                      {/* Fila superior: avatar + nombre + botones secundarios */}
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,background:cfg.bg,color:cfg.color,flexShrink:0}}>{s.name.charAt(0).toUpperCase()}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:14,lineHeight:1.25,overflowWrap:"anywhere"}}>
                            {stats?.porAlumno[s.id]?.nivel>0&&<span title={`${NIVEL[stats.porAlumno[s.id].nivel].label}: ${stats.porAlumno[s.id].motivos.join(" · ")}`}>{NIVEL[stats.porAlumno[s.id].nivel].icon} </span>}{s.name}
                          </div>
                          <div style={{fontSize:11,color:cfg.color,display:"flex",alignItems:"center",gap:4,marginTop:1}}>
                            <span>{cfg.icon}</span><span>{cfg.label}</span>
                            {st==="excused"&&reason&&<span style={{color:C.muted,marginLeft:4}}>· {reason.length>25?reason.substring(0,25)+"…":reason}</span>}
                          </div>
                        </div>
                        {/* Botones secundarios (historial, datos del tutor, baja) */}
                        <div style={{display:"flex",gap:5,flexShrink:0}}>
                          <button className="btn" onClick={()=>{setSearchQuery(s.name);searchStudent(s.name);}} title="Ver historial" style={{background:`${C.purple}18`,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:8,padding:"6px 8px",fontSize:13}}>📅</button>
                          <button className="btn" onClick={()=>setTutorTarget(s)} title={s.tutor_phone?"Editar tutor":"Agregar tutor"}
                            style={{background:s.tutor_phone?"#25d36622":"transparent",color:s.tutor_phone?"#25d366":C.muted,border:`1.5px solid ${s.tutor_phone?"#25d366":C.border}`,borderRadius:8,padding:"6px 8px",fontSize:13}}>
                            📱
                          </button>
                          {!isViewer&&<button className="btn" title="Dar de baja del grupo" onClick={()=>removeStudent(s.id)} style={{background:"none",color:C.muted,border:"none",padding:"6px 6px",fontSize:14,opacity:.5}}>×</button>}
                        </div>
                      </div>
                      {/* Fila inferior: botones de asistencia — ancho completo */}
                      {!isViewer&&(
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6}}>
                          {[
                            {key:"present", icon:"✅", label:"Presente", color:C.success, onClick:()=>toggleAtt(s.id,"present")},
                            {key:"late",    icon:"🕐", label:"Retardo",  color:C.late,    onClick:()=>toggleAtt(s.id,"late")},
                            {key:"excused", icon:"📝", label:"Justif.",  color:C.excused, onClick:()=>openJustify(s)},
                            {key:"absent",  icon:"❌", label:"Falta",    color:C.danger,  onClick:()=>toggleAtt(s.id,"absent")},
                          ].map(b=>{
                            const on = st===b.key;
                            return (
                              <button key={b.key} className="btn" onClick={b.onClick}
                                style={{background:on?b.color:`${b.color}15`,color:on?"#fff":b.color,border:`1.5px solid ${b.color}66`,borderRadius:8,
                                  padding:"6px 2px",minWidth:0,fontFamily:"inherit",fontWeight:on?700:600,
                                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,lineHeight:1.1}}>
                                <span style={{fontSize:15}}>{b.icon}</span>
                                <span style={{fontSize:11,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{b.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ACTIVIDADES TAB */}
        {view==="attendance"&&activeSession&&mainTab==="activities"&&(
          <ActividadesModule key={activeSession.id} session={activeSession} students={students} isViewer={isViewer} showToast={showToast}
            onDataChange={()=>loadEval(activeSession)} onExport={exportCalificaciones}/>
        )}
        {view==="attendance"&&activeSession&&mainTab==="grades"&&(
          <CalificacionesModule key={activeSession.id+gradesFilter} session={activeSession} students={students} isViewer={isViewer} showToast={showToast}
            stats={stats} cfg={evalCfg} loading={evalLoading} onSessionChange={onSessionUpdated} onExport={exportCalificaciones} initialFilter={gradesFilter}/>
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
                <div><h2 style={{fontFamily:"'Merriweather',serif",fontSize:20,fontWeight:700}}>{searchResult.student.name}</h2><div style={{color:C.muted,fontSize:13,marginTop:3}}>Historial — {nombreClase(activeSession)}</div></div>
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
