import { useState, useEffect, useRef } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { Empty, Toast } from "./Shared";
import * as XLSX from "xlsx";

// ─── helpers ────────────────────────────────────────────────────
function gradeColor(g) {
  if (g === null || g === undefined || g === "") return C.muted;
  const n = parseFloat(g);
  if (n >= 90) return C.success;
  if (n >= 70) return C.warning;
  return C.danger;
}

function calcFinal(activities, grades) {
  let total = 0, weight = 0;
  for (const act of activities) {
    const val = parseFloat(grades?.[act.id]);
    if (!isNaN(val)) { total += val * (act.weight / 100); weight += act.weight; }
  }
  if (weight === 0) return null;
  return Math.round((total / weight) * weight * 10) / 10;
}

// ─── SubjectModal — crear/editar período ────────────────────────
function SubjectModal({ subject, onSave, onClose }) {
  const [name, setName] = useState(subject?.name || "");
  const [error, setError] = useState("");

  function save() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    onSave({ name: name.trim(), period: "" });
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.purple}55`,borderRadius:20,padding:28,width:"100%",maxWidth:420,boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
          <div style={{width:46,height:46,borderRadius:14,background:`${C.purple}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📅</div>
          <div style={{fontWeight:700,fontSize:16,color:C.text}}>{subject ? "Editar período" : "Nuevo período"}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Nombre del período</div>
            <input className="inp" placeholder="Ej. Parcial 1, Parcial 2, Final..." value={name} autoFocus
              onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}/>
          </div>
          {error && <div style={{color:C.danger,fontSize:12}}>{error}</div>}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button className="btn" onClick={save}
              style={{flex:1,background:`linear-gradient(135deg,${C.purple},${C.accent})`,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>
              Guardar
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

// ─── ActivityModal — agregar actividad con peso ──────────────────
function ActivityModal({ onSave, onClose, usedWeight }) {
  const [name, setName]     = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError]   = useState("");

  function save() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 100) { setError("Peso debe ser entre 1 y 100"); return; }
    if (usedWeight + w > 100) { setError(`Solo quedan ${100 - usedWeight}% disponibles`); return; }
    onSave({ name: name.trim(), weight: w });
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.teal}55`,borderRadius:20,padding:28,width:"100%",maxWidth:400,boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
          <div style={{width:46,height:46,borderRadius:14,background:`${C.teal}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📝</div>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:C.text}}>Nueva actividad</div>
            <div style={{color:C.muted,fontSize:12,marginTop:2}}>Peso disponible: {100-usedWeight}%</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Nombre de la actividad</div>
            <input className="inp" placeholder="Ej. Examen parcial" value={name} autoFocus onChange={e=>setName(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Porcentaje (%)</div>
            <input className="inp" type="number" min="1" max="100" placeholder="Ej. 30" value={weight} onChange={e=>setWeight(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}/>
          </div>
          {error && <div style={{color:C.danger,fontSize:12}}>{error}</div>}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button className="btn" onClick={save}
              style={{flex:1,background:`linear-gradient(135deg,${C.teal},${C.accent})`,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>
              Agregar
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

// ─── GradesModule principal ──────────────────────────────────────
export default function GradesModule({ user, sessionId, students }) {
  const [subjects, setSubjects]       = useState([]);
  const [activeSubj, setActiveSubj]   = useState(null);
  const [activities, setActivities]   = useState([]);
  const [grades, setGrades]           = useState({});
  const [toast, setToast]             = useState(null);
  const [saving, setSaving]           = useState(false);
  const [showSubjModal, setShowSubjModal]   = useState(false);
  const [editSubj, setEditSubj]             = useState(null);
  const [showActModal, setShowActModal]     = useState(false);
  const fileRef = useRef();
  const isViewer = user.role === "viewer";

  useEffect(() => { if (sessionId) loadSubjects(); }, [sessionId]);
  useEffect(() => { if (activeSubj) { loadActivities(activeSubj.id); } }, [activeSubj]);

  async function loadSubjects() {
    const { data } = await sb.from("subjects").select("*").eq("session_id", sessionId).order("created_at");
    setSubjects(data || []);
    if (data?.length && !activeSubj) setActiveSubj(data[0]);
  }

  async function loadActivities(subjectId) {
    const { data: acts } = await sb.from("activities").select("*").eq("subject_id", subjectId).order("created_at");
    setActivities(acts || []);
    if (acts?.length && students.length) {
      const { data: gr } = await sb.from("grades").select("student_id,activity_id,score").eq("subject_id", subjectId);
      const map = {};
      for (const g of (gr || [])) {
        if (!map[g.student_id]) map[g.student_id] = {};
        map[g.student_id][g.activity_id] = g.score;
      }
      setGrades(map);
    } else {
      setGrades({});
    }
  }

  async function createSubject(data) {
    const { data: row, error } = await sb.from("subjects").insert({ session_id: sessionId, owner_id: user.id, ...data }).select().single();
    if (error) { showT("❌ " + error.message); return; }
    setSubjects(p => [...p, row]);
    setActiveSubj(row);
    setShowSubjModal(false);
    showT("✅ Período creado");
  }

  async function updateSubject(data) {
    const { error } = await sb.from("subjects").update(data).eq("id", editSubj.id);
    if (error) { showT("❌ " + error.message); return; }
    const updated = { ...editSubj, ...data };
    setSubjects(p => p.map(s => s.id === editSubj.id ? updated : s));
    if (activeSubj?.id === editSubj.id) setActiveSubj(updated);
    setEditSubj(null);
    showT("✅ Período actualizado");
  }

  async function deleteSubject(id) {
    if (!window.confirm("¿Eliminar este período y todas sus calificaciones?")) return;
    await sb.from("subjects").delete().eq("id", id);
    const remaining = subjects.filter(s => s.id !== id);
    setSubjects(remaining);
    if (activeSubj?.id === id) { setActiveSubj(remaining[0] || null); setActivities([]); setGrades({}); }
    showT("🗑️ Eliminada");
  }

  async function addActivity(data) {
    const { data: row, error } = await sb.from("activities").insert({ subject_id: activeSubj.id, ...data }).select().single();
    if (error) { showT("❌ " + error.message); return; }
    setActivities(p => [...p, row]);
    setShowActModal(false);
    showT("✅ Actividad agregada");
  }

  async function deleteActivity(id) {
    await sb.from("activities").delete().eq("id", id);
    setActivities(p => p.filter(a => a.id !== id));
    // clean local grades
    setGrades(prev => {
      const g = { ...prev };
      for (const sid in g) { const s = { ...g[sid] }; delete s[id]; g[sid] = s; }
      return g;
    });
    showT("🗑️ Actividad eliminada");
  }

  function setGradeLocal(studentId, activityId, value) {
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [activityId]: value }
    }));
  }

  async function saveGrades() {
    if (!activeSubj || !activities.length) return;
    setSaving(true);
    const upserts = [];
    for (const s of students) {
      for (const act of activities) {
        const score = grades[s.id]?.[act.id];
        if (score !== undefined && score !== "") {
          upserts.push({
            subject_id: activeSubj.id,
            activity_id: act.id,
            student_id: s.id,
            score: parseFloat(score) || 0,
          });
        }
      }
    }
    if (upserts.length) {
      const { error } = await sb.from("grades").upsert(upserts, { onConflict: "subject_id,activity_id,student_id" });
      if (error) { showT("❌ " + error.message); setSaving(false); return; }
    }
    showT("💾 Calificaciones guardadas");
    setSaving(false);
  }

  async function importGrades(e) {
    const file = e.target.files[0]; if (!file || !activeSubj || !activities.length) return;
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1 });
    // Espera: Alumno | Act1 | Act2 | ... (misma estructura que exportGrades)
    const header = rows[0] || [];
    let matched = 0;
    const newGrades = { ...grades };
    for (const row of rows.slice(1)) {
      const name = String(row[0]||"").trim().toLowerCase();
      const student = students.find(s => s.name.toLowerCase() === name);
      if (!student) continue;
      if (!newGrades[student.id]) newGrades[student.id] = {};
      activities.forEach((act, idx) => {
        const val = parseFloat(row[idx+1]);
        if (!isNaN(val)) newGrades[student.id][act.id] = val;
      });
      matched++;
    }
    setGrades(newGrades);
    showT(`📥 ${matched} alumnos importados`);
    e.target.value = "";
  }

  function exportGrades() {
    if (!activeSubj || !activities.length) return;
    const header = ["Alumno", ...activities.map(a => `${a.name} (${a.weight}%)`), "Final"];
    const rows = students.map(s => {
      const final = calcFinal(activities, grades[s.id]);
      return [s.name, ...activities.map(a => grades[s.id]?.[a.id] ?? ""), final ?? ""];
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), activeSubj.name.substring(0,31));
    XLSX.writeFile(wb, `calificaciones_${activeSubj.name}.xlsx`);
    showT("📥 Excel descargado");
  }

  function showT(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  const usedWeight = activities.reduce((a, b) => a + b.weight, 0);

  return (
    <div style={{animation:"fadeUp .4s ease both"}}>
      {toast && <Toast msg={toast}/>}
      {showSubjModal && <SubjectModal onSave={createSubject} onClose={()=>setShowSubjModal(false)}/>}
      {editSubj && <SubjectModal subject={editSubj} onSave={updateSubject} onClose={()=>setEditSubj(null)}/>}
      {showActModal && <ActivityModal usedWeight={usedWeight} onSave={addActivity} onClose={()=>setShowActModal(false)}/>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700}}>📊 Calificaciones</h2>
          <p style={{color:C.muted,fontSize:13,marginTop:4}}>Crea períodos (Parcial 1, Final…) y registra calificaciones por alumno</p>
        </div>
        {!isViewer && (
          <button className="btn" onClick={()=>setShowSubjModal(true)}
            style={{background:`linear-gradient(135deg,${C.purple},${C.accent})`,color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>
            + Nuevo período
          </button>
        )}
      </div>

      {subjects.length === 0 ? (
        <Empty icon="📅" msg="Sin períodos. Crea el primero para empezar (ej. Parcial 1)."/>
      ) : (
        <>
          {/* Subject tabs */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20,borderBottom:`1px solid ${C.border}`,paddingBottom:12}}>
            {subjects.map(s => (
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:4}}>
                <button className="btn" onClick={()=>setActiveSubj(s)}
                  style={{background:activeSubj?.id===s.id?`${C.purple}33`:`${C.purple}0d`,color:activeSubj?.id===s.id?C.purple:C.muted,border:`1px solid ${activeSubj?.id===s.id?C.purple:C.border}`,borderRadius:10,padding:"7px 16px",fontSize:13,fontWeight:activeSubj?.id===s.id?700:400,fontFamily:"inherit",transition:"all .15s"}}>
                  {s.name}
                  {s.period && <span style={{color:C.muted,fontSize:11,marginLeft:6}}>· {s.period}</span>}
                </button>
                {!isViewer && activeSubj?.id===s.id && (
                  <>
                    <button className="btn" onClick={()=>setEditSubj(s)} title="Editar período"
                      style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 8px",fontSize:12}}>✏️</button>
                    <button className="btn" onClick={()=>deleteSubject(s.id)} title="Eliminar período"
                      style={{background:"none",color:C.danger,border:`1px solid ${C.danger}33`,borderRadius:8,padding:"5px 8px",fontSize:12}}>🗑️</button>
                  </>
                )}
              </div>
            ))}
          </div>

          {activeSubj && (
            <>
              {/* Activities header */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 22px",marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.teal,letterSpacing:1}}>ACTIVIDADES / RUBROS</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:4}}>
                      Peso total: <span style={{color:usedWeight===100?C.success:usedWeight>100?C.danger:C.warning,fontWeight:700}}>{usedWeight}%</span>
                      {usedWeight < 100 && <span style={{color:C.muted}}> — quedan {100-usedWeight}%</span>}
                    </div>
                  </div>
                  {!isViewer && (
                    <button className="btn" onClick={()=>setShowActModal(true)} disabled={usedWeight>=100}
                      style={{background:usedWeight>=100?`${C.muted}22`:`${C.teal}22`,color:usedWeight>=100?C.muted:C.teal,border:`1px solid ${usedWeight>=100?C.border:`${C.teal}44`}`,borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
                      + Actividad
                    </button>
                  )}
                </div>
                {/* Weight bar */}
                <div style={{background:C.border,borderRadius:6,height:8,overflow:"hidden",display:"flex",marginBottom:10}}>
                  {activities.map((a, i) => (
                    <div key={a.id} title={`${a.name}: ${a.weight}%`}
                      style={{height:"100%",width:`${a.weight}%`,background:[C.accent,C.purple,C.teal,C.success,C.warning,C.late,C.excused][i%7],transition:"width .3s ease"}}/>
                  ))}
                </div>
                {activities.length === 0 ? (
                  <p style={{color:C.muted,fontSize:13,fontStyle:"italic"}}>Sin actividades aún. Agrega una para ingresar calificaciones.</p>
                ) : (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {activities.map((a, i) => (
                      <div key={a.id} style={{display:"flex",alignItems:"center",gap:6,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",fontSize:12}}>
                        <div style={{width:10,height:10,borderRadius:3,background:[C.accent,C.purple,C.teal,C.success,C.warning,C.late,C.excused][i%7],flexShrink:0}}/>
                        <span style={{color:C.text}}>{a.name}</span>
                        <span style={{color:C.muted}}>({a.weight}%)</span>
                        {!isViewer && (
                          <button className="btn" onClick={()=>deleteActivity(a.id)}
                            style={{background:"none",color:C.danger,border:"none",padding:"0 2px",fontSize:12,opacity:.6}}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grades table */}
              {activities.length > 0 && students.length > 0 && (
                <>
                  <div className="overflow-x" style={{borderRadius:16,border:`1px solid ${C.border}`,marginBottom:16}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'DM Sans',sans-serif",fontSize:13}}>
                      <thead>
                        <tr style={{background:C.surface}}>
                          <th style={{padding:"12px 16px",textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:1,minWidth:160,borderBottom:`1px solid ${C.border}`}}>ALUMNO</th>
                          {activities.map(a => (
                            <th key={a.id} style={{padding:"12px 10px",textAlign:"center",color:C.teal,fontWeight:700,fontSize:11,letterSpacing:.5,minWidth:110,borderBottom:`1px solid ${C.border}`}}>
                              <div>{a.name}</div>
                              <div style={{color:C.muted,fontWeight:400,fontSize:10,marginTop:2}}>{a.weight}%</div>
                            </th>
                          ))}
                          <th style={{padding:"12px 10px",textAlign:"center",color:C.gold,fontWeight:700,fontSize:11,letterSpacing:.5,minWidth:90,borderBottom:`1px solid ${C.border}`}}>FINAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, i) => {
                          const final = calcFinal(activities, grades[s.id]);
                          return (
                            <tr key={s.id} style={{background:i%2===0?C.card:C.surface,transition:"background .15s"}}
                              onMouseEnter={e=>e.currentTarget.style.background=`${C.accent}0a`}
                              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.card:C.surface}>
                              <td style={{padding:"10px 16px",color:C.text,fontWeight:500,borderBottom:`1px solid ${C.border}33`}}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <div style={{width:28,height:28,borderRadius:8,background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.accent,flexShrink:0}}>
                                    {s.name.charAt(0).toUpperCase()}
                                  </div>
                                  {s.name}
                                </div>
                              </td>
                              {activities.map(a => (
                                <td key={a.id} style={{padding:"6px 8px",textAlign:"center",borderBottom:`1px solid ${C.border}33`}}>
                                  {isViewer ? (
                                    <span style={{color:gradeColor(grades[s.id]?.[a.id]),fontWeight:600}}>
                                      {grades[s.id]?.[a.id] ?? "—"}
                                    </span>
                                  ) : (
                                    <input
                                      type="number" min="0" max="100" step="0.1"
                                      value={grades[s.id]?.[a.id] ?? ""}
                                      onChange={e => setGradeLocal(s.id, a.id, e.target.value)}
                                      style={{width:70,background:"transparent",border:`1px solid ${C.border}`,color:gradeColor(grades[s.id]?.[a.id]),borderRadius:8,padding:"5px 8px",fontSize:13,textAlign:"center",fontFamily:"inherit",fontWeight:600,outline:"none"}}
                                      onFocus={e=>e.target.style.borderColor=C.accent}
                                      onBlur={e=>e.target.style.borderColor=C.border}
                                    />
                                  )}
                                </td>
                              ))}
                              <td style={{padding:"10px 8px",textAlign:"center",borderBottom:`1px solid ${C.border}33`}}>
                                <span style={{color:gradeColor(final),fontWeight:700,fontSize:14,background:`${gradeColor(final)}18`,border:`1px solid ${gradeColor(final)}44`,borderRadius:8,padding:"4px 12px"}}>
                                  {final !== null ? final : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  {!isViewer && (
                    <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
                      <button className="btn" onClick={()=>fileRef.current.click()}
                        style={{background:`${C.teal}22`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>
                        📤 Importar Excel
                      </button>
                      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importGrades} style={{display:"none"}}/>
                      <button className="btn" onClick={exportGrades}
                        style={{background:`${C.purple}22`,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>
                        📥 Exportar Excel
                      </button>
                      <button className="btn" onClick={saveGrades} disabled={saving}
                        style={{background:`linear-gradient(135deg,${C.teal},${C.accent})`,color:"#fff",borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:600,fontFamily:"inherit",boxShadow:`0 4px 16px ${C.teal}33`}}>
                        {saving ? "Guardando..." : "💾 Guardar calificaciones"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {activities.length > 0 && students.length === 0 && (
                <Empty icon="👥" msg="No hay alumnos en esta sesión aún."/>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
