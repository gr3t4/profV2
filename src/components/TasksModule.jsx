import { useState, useEffect, useRef } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { Empty, Toast } from "./Shared";
import * as XLSX from "xlsx";

const SUB_STATUS = {
  pending:  { label:"Pendiente", icon:"⏳", color:"#7d8590" },
  on_time:  { label:"A tiempo",  icon:"✅", color:"#2e7d4f" },
  late:     { label:"Tarde",     icon:"🕐", color:"#b84a00" },
  missing:  { label:"No entregó",icon:"❌", color:"#b71c1c" },
};

function TaskModal({ task, subjects, onSave, onClose }) {
  const [title, setTitle]       = useState(task?.title || "");
  const [desc, setDesc]         = useState(task?.description || "");
  const [due, setDue]           = useState(task?.due_date || "");
  const [max, setMax]           = useState(task?.max_score ?? 100);
  const [subjectId, setSubjectId] = useState(task?.subject_id || "");
  const [err, setErr]           = useState("");

  function save() {
    if (!title.trim()) { setErr("El título es requerido"); return; }
    onSave({ title:title.trim(), description:desc.trim(), due_date:due||null, max_score:parseFloat(max)||100, subject_id:subjectId||null });
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.gold}44`,borderRadius:20,padding:28,width:"100%",maxWidth:440,boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
          <div style={{width:46,height:46,borderRadius:14,background:`${C.gold}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📋</div>
          <div style={{fontWeight:700,fontSize:16,color:C.text}}>{task ? "Editar tarea" : "Nueva tarea"}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:5}}>Título</div><input className="inp" placeholder="Ej. Tarea 1 — Ecuaciones" value={title} autoFocus onChange={e=>setTitle(e.target.value)}/></div>
          {subjects.length > 0 && (
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Materia (opcional)</div>
              <select className="inp" value={subjectId} onChange={e=>setSubjectId(e.target.value)} style={{cursor:"pointer"}}>
                <option value="">— Sin materia —</option>
                {subjects.map(s=><option key={s.id} value={s.id}>{s.name}{s.period?` (${s.period})`:""}</option>)}
              </select>
            </div>
          )}
          <div><div style={{fontSize:11,color:C.muted,marginBottom:5}}>Descripción (opcional)</div><textarea className="inp" placeholder="Instrucciones..." value={desc} onChange={e=>setDesc(e.target.value)} style={{minHeight:60,resize:"vertical"}}/></div>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}><div style={{fontSize:11,color:C.muted,marginBottom:5}}>Fecha límite</div><input className="inp" type="date" value={due} onChange={e=>setDue(e.target.value)}/></div>
            <div style={{width:100}}><div style={{fontSize:11,color:C.muted,marginBottom:5}}>Puntaje máx.</div><input className="inp" type="number" min="1" max="100" value={max} onChange={e=>setMax(e.target.value)}/></div>
          </div>
          {err && <div style={{color:C.danger,fontSize:12}}>{err}</div>}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button className="btn" onClick={save} style={{flex:1,background:`linear-gradient(135deg,${C.gold},#a07010)`,color:"#000",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>Guardar</button>
            <button className="btn" onClick={onClose} style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",fontSize:14,fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TasksModule({ user, sessionId, students }) {
  const [tasks, setTasks]           = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [subs, setSubs]             = useState({});
  const [subjects, setSubjects]     = useState([]);
  const [toast, setToast]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editTask, setEditTask]     = useState(null);
  const fileRef = useRef();
  const isViewer = user.role === "viewer";

  useEffect(() => { if (sessionId) loadTasks(); }, [sessionId]);
  useEffect(() => { if (activeTask) loadSubs(activeTask.id); }, [activeTask]);

  async function loadTasks() {
    const [{ data: taskData }, { data: subjData }] = await Promise.all([
      sb.from("tasks").select("*").eq("session_id", sessionId).order("created_at", { ascending:false }),
      sb.from("subjects").select("id,name,period").eq("session_id", sessionId),
    ]);
    setTasks(taskData || []);
    setSubjects(subjData || []);
    if (taskData?.length) setActiveTask(taskData[0]);
  }

  async function loadSubs(taskId) {
    const { data } = await sb.from("task_submissions").select("student_id,status,score,notes").eq("task_id", taskId);
    const m = {};
    (data||[]).forEach(r => { m[r.student_id] = { status:r.status, score:r.score??'', notes:r.notes||'' }; });
    setSubs(m);
  }

  async function createTask(data) {
    const { data:row, error } = await sb.from("tasks").insert({ session_id:sessionId, owner_id:user.id, ...data }).select().single();
    if (error) { showT("❌ "+error.message); return; }
    setTasks(p => [row,...p]); setActiveTask(row); setShowModal(false); showT("✅ Tarea creada");
  }

  async function updateTask(data) {
    const { error } = await sb.from("tasks").update(data).eq("id", editTask.id);
    if (error) { showT("❌ "+error.message); return; }
    const updated = {...editTask,...data};
    setTasks(p => p.map(t => t.id===editTask.id ? updated : t));
    if (activeTask?.id===editTask.id) setActiveTask(updated);
    setEditTask(null); showT("✅ Actualizada");
  }

  async function deleteTask(id) {
    if (!window.confirm("¿Eliminar esta tarea?")) return;
    await sb.from("tasks").delete().eq("id", id);
    const rest = tasks.filter(t => t.id!==id);
    setTasks(rest); setActiveTask(rest[0]||null); showT("🗑️ Eliminada");
  }

  function setSubLocal(studentId, field, value) {
    setSubs(prev => ({ ...prev, [studentId]: { ...(prev[studentId]||{}), [field]:value } }));
  }

  async function saveSubs() {
    if (!activeTask) return;
    setSaving(true);
    const upserts = students
      .filter(s => subs[s.id]?.status && subs[s.id].status !== "pending")
      .map(s => ({
        task_id: activeTask.id,
        student_id: s.id,
        status: subs[s.id].status,
        score: subs[s.id].score !== '' ? parseFloat(subs[s.id].score) : null,
        notes: subs[s.id].notes || null,
        updated_at: new Date().toISOString(),
      }));
    if (upserts.length) {
      const { error } = await sb.from("task_submissions").upsert(upserts, { onConflict:"task_id,student_id" });
      if (error) { showT("❌ "+error.message); setSaving(false); return; }
    }
    showT("💾 Guardado"); setSaving(false);
  }

  function markAll(status) {
    const m = {};
    students.forEach(s => { m[s.id] = { ...(subs[s.id]||{}), status }; });
    setSubs(m); showT(SUB_STATUS[status].icon+" Todos: "+SUB_STATUS[status].label);
  }

  async function importFromExcel(e) {
    const file = e.target.files[0]; if (!file || !activeTask) return;
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1 });
    // Espera columnas: Nombre | Estado | Calificación | Notas
    let matched = 0;
    const newSubs = { ...subs };
    for (const row of rows.slice(1)) {
      const name = String(row[0]||"").trim().toLowerCase();
      const statusRaw = String(row[1]||"").trim().toLowerCase();
      const score = row[2] !== undefined ? parseFloat(row[2]) : undefined;
      const notes = row[3] ? String(row[3]).trim() : "";
      const student = students.find(s => s.name.toLowerCase() === name);
      if (!student) continue;
      const statusMap = { "a tiempo":"on_time","tarde":"late","no entregó":"missing","no entrego":"missing","pendiente":"pending" };
      const status = statusMap[statusRaw] || "pending";
      newSubs[student.id] = { status, score:isNaN(score)?'':score, notes };
      matched++;
    }
    setSubs(newSubs);
    showT(`📥 ${matched} alumnos importados`);
    e.target.value = "";
  }

  function exportToExcel() {
    if (!activeTask) return;
    const header = ["Alumno","Estado","Calificación","Notas"];
    const rows = students.map(s => {
      const sub = subs[s.id] || {};
      return [s.name, SUB_STATUS[sub.status||"pending"]?.label||"Pendiente", sub.score??'', sub.notes||''];
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header,...rows]), activeTask.title.substring(0,31));
    XLSX.writeFile(wb, `tareas_${activeTask.title}.xlsx`);
    showT("📥 Excel descargado");
  }

  function showT(msg) { setToast(msg); setTimeout(()=>setToast(null), 3000); }

  const counts = activeTask ? {
    on_time: students.filter(s=>subs[s.id]?.status==="on_time").length,
    late:    students.filter(s=>subs[s.id]?.status==="late").length,
    missing: students.filter(s=>subs[s.id]?.status==="missing").length,
    pending: students.filter(s=>!subs[s.id]?.status||subs[s.id].status==="pending").length,
  } : {};

  return (
    <div style={{animation:"fadeUp .4s ease both"}}>
      {toast && <Toast msg={toast}/>}
      {showModal && <TaskModal subjects={subjects} onSave={createTask} onClose={()=>setShowModal(false)}/>}
      {editTask && <TaskModal task={editTask} subjects={subjects} onSave={updateTask} onClose={()=>setEditTask(null)}/>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:22,fontWeight:700}}>📋 Tareas</h2>
          <p style={{color:C.muted,fontSize:13,marginTop:4}}>Registro de entregas y calificaciones por actividad</p>
        </div>
        {!isViewer && (
          <button className="btn" onClick={()=>setShowModal(true)}
            style={{background:`linear-gradient(135deg,${C.gold},#a07010)`,color:"#000",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
            + Nueva tarea
          </button>
        )}
      </div>

      {tasks.length === 0 ? <Empty icon="📋" msg="Sin tareas. Crea la primera."/> : (
        <>
          {/* Task selector — lista vertical */}
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
            {tasks.map(t => {
              const isActive = activeTask?.id===t.id;
              const subj = subjects.find(s=>s.id===t.subject_id);
              return (
                <div key={t.id} style={{
                  background:isActive?`${C.gold}11`:C.card,
                  border:`1px solid ${isActive?C.gold:C.border}`,
                  borderLeft:`3px solid ${isActive?C.gold:C.border}`,
                  borderRadius:12, transition:"all .15s",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}}
                    onClick={()=>setActiveTask(t)}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:isActive?700:500,fontSize:14,color:isActive?C.gold:C.text,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {t.title}
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap",fontSize:11,color:C.muted}}>
                        {t.due_date&&<span>📅 {t.due_date}</span>}
                        {subj&&<span style={{color:C.accent}}>📚 {subj.name}</span>}
                        <span>🎯 {t.max_score}pts</span>
                      </div>
                    </div>
                    {!isViewer && isActive && (
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        <button className="btn" onClick={e=>{e.stopPropagation();setEditTask(t);}}
                          style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 8px",fontSize:12}}>✏️</button>
                        <button className="btn" onClick={e=>{e.stopPropagation();deleteTask(t.id);}}
                          style={{background:"none",color:C.danger,border:`1px solid ${C.danger}33`,borderRadius:8,padding:"5px 8px",fontSize:12}}>🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {activeTask && (
            <>
              {/* Stats */}
              <div className="grid-stats-3" style={{marginBottom:16}}>
                {[
                  {label:"A tiempo", count:counts.on_time, color:C.success, icon:"✅"},
                  {label:"Tarde",    count:counts.late,    color:C.late,    icon:"🕐"},
                  {label:"No entregó",count:counts.missing,color:C.danger,  icon:"❌"},
                  {label:"Pendiente",count:counts.pending, color:C.muted,   icon:"⏳"},
                  {label:"Puntaje máx.",count:activeTask.max_score, color:C.gold, icon:"🏆"},
                  {label:"Alumnos",  count:students.length,color:C.accent,  icon:"👥"},
                ].map(st=>(
                  <div key={st.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 10px",textAlign:"center"}}>
                    <div style={{fontSize:18}}>{st.icon}</div>
                    <div style={{fontSize:20,fontWeight:700,color:st.color,fontFamily:"'Sora',sans-serif"}}>{st.count}</div>
                    <div style={{color:C.muted,fontSize:11,marginTop:2}}>{st.label}</div>
                  </div>
                ))}
              </div>

              {/* Toolbar */}
              {!isViewer && (
                <div className="toolbar" style={{marginBottom:14}}>
                  <button className="btn" onClick={()=>fileRef.current.click()}
                    style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
                    📥 Importar Excel
                  </button>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importFromExcel} style={{display:"none"}}/>
                  <button className="btn" onClick={exportToExcel}
                    style={{background:`${C.purple}22`,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
                    📤 Exportar Excel
                  </button>
                  <div className="toolbar-right">
                    {["on_time","late","missing"].map(s=>(
                      <button key={s} className="btn" onClick={()=>markAll(s)}
                        style={{background:`${SUB_STATUS[s].color}22`,color:SUB_STATUS[s].color,border:`1px solid ${SUB_STATUS[s].color}44`,borderRadius:9,padding:"7px 11px",fontSize:12,fontFamily:"inherit"}}>
                        {SUB_STATUS[s].icon} Todos
                      </button>
                    ))}
                    <button className="btn" onClick={saveSubs} disabled={saving}
                      style={{background:`linear-gradient(135deg,${C.teal},${C.accent})`,color:"#fff",borderRadius:10,padding:"8px 18px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
                      {saving?"Guardando...":"💾 Guardar"}
                    </button>
                  </div>
                </div>
              )}

              {/* Student list */}
              {students.length === 0 ? <Empty icon="👥" msg="Sin alumnos en esta sesión."/> : (
                <div style={{display:"grid",gap:8}}>
                  {students.map((s,i) => {
                    const sub = subs[s.id] || {};
                    const st = sub.status || "pending";
                    const cfg = SUB_STATUS[st];
                    return (
                      <div key={s.id} style={{background:C.card,border:`1px solid ${cfg.color}33`,borderRadius:12,padding:"12px 16px",animation:`slideIn .3s ease both`,animationDelay:`${i*.02}s`}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                          {/* Avatar + name */}
                          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:140}}>
                            <div style={{width:34,height:34,borderRadius:9,background:`${cfg.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:cfg.color,flexShrink:0}}>
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{fontWeight:500,fontSize:14}}>{s.name}</div>
                              <div style={{fontSize:11,color:cfg.color,marginTop:1}}>{cfg.icon} {cfg.label}</div>
                            </div>
                          </div>

                        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",justifyContent:"flex-end"}}>
                          {Object.entries(SUB_STATUS).filter(([k])=>k!=="pending").map(([k,v])=>(
                            <button key={k} className="btn" onClick={()=>setSubLocal(s.id,"status",k)}
                              style={{background:st===k?v.color:"transparent",color:st===k?"#fff":v.color,border:`1.5px solid ${v.color}66`,borderRadius:8,padding:"6px 10px",fontSize:12,fontFamily:"inherit",fontWeight:st===k?700:400,minHeight:34}}>
                              {v.icon} <span className="hide-mobile">{v.label}</span>
                            </button>
                          ))}
                        </div>

                          {/* Score */}
                          {!isViewer && (
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <input type="number" min="0" max={activeTask.max_score} step="0.5"
                                value={sub.score??''}
                                onChange={e=>setSubLocal(s.id,"score",e.target.value)}
                                placeholder="Cal."
                                style={{width:70,background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"5px 8px",fontSize:13,textAlign:"center",fontFamily:"inherit",outline:"none"}}
                                onFocus={e=>e.target.style.borderColor=C.gold}
                                onBlur={e=>e.target.style.borderColor=C.border}
                              />
                              <span style={{color:C.muted,fontSize:11}}>/{activeTask.max_score}</span>
                            </div>
                          )}
                          {isViewer && sub.score !== undefined && sub.score !== '' && (
                            <span style={{color:C.gold,fontWeight:700,fontSize:14}}>{sub.score}/{activeTask.max_score}</span>
                          )}
                        </div>

                        {/* Notes */}
                        {!isViewer && (
                          <input className="inp" placeholder="Notas (opcional)..." value={sub.notes||''}
                            onChange={e=>setSubLocal(s.id,"notes",e.target.value)}
                            style={{marginTop:8,fontSize:12,padding:"6px 10px",background:"transparent",borderColor:`${C.border}88`}}
                          />
                        )}
                        {isViewer && sub.notes && (
                          <div style={{marginTop:6,fontSize:12,color:C.muted,paddingLeft:44}}>{sub.notes}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
