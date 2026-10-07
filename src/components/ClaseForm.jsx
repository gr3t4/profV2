import { useState } from "react";
import { sb } from "../lib/supabase";
import { C, TURNOS, today } from "../lib/constants";
import { DIAS, resumenHorario } from "../lib/horario";
import { parseStudentsExcel, downloadStudentsTemplate } from "../lib/excelStudents";

// Alta / edición de una clase: grupo (lista compartida), materia, turno y horario.
export default function ClaseForm({ user, grupos, initial, onSaved, onClose }) {
  const editing = !!initial;
  const [grupoId, setGrupoId]   = useState(initial?.grupo_id || (grupos[0]?.id ?? "new"));
  const [newGrupo, setNewGrupo] = useState("");
  const [materia, setMateria]   = useState(initial?.materia || "");
  const grupoSel = grupos.find(g => g.id === grupoId);
  const [turno, setTurno]       = useState(initial?.grupo?.turno || grupoSel?.turno || "matutino");
  const [horario, setHorario]   = useState(() => (initial?.horario?.length ? initial.horario : [{ dia:1, inicio:"07:00", fin:"07:50" }]));
  const [busy, setBusy]         = useState(false);
  const [roster, setRoster]     = useState(null);   // alumnos leídos del Excel para el grupo nuevo
  const [rosterFile, setRosterFile] = useState("");
  const [error, setError]       = useState("");

  function pickGrupo(id) {
    setGrupoId(id);
    const g = grupos.find(x => x.id === id);
    if (g?.turno) setTurno(g.turno);
  }
  const setBloque = (i, k, v) => setHorario(h => h.map((b, j) => j === i ? { ...b, [k]: k === "dia" ? Number(v) : v } : b));
  const addBloque = () => setHorario(h => {
    const last = h[h.length - 1];
    return [...h, last ? { ...last, dia: Math.min(6, Number(last.dia) + 1) } : { dia:1, inicio:"07:00", fin:"07:50" }];
  });
  const delBloque = (i) => setHorario(h => h.filter((_, j) => j !== i));

  async function pickRoster(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const rows = (await parseStudentsExcel(file)).filter(r => r.name?.trim());
      if (!rows.length) { setError("No se encontraron nombres en el archivo"); return; }
      setRoster(rows); setRosterFile(file.name);
    } catch { setError("No se pudo leer el archivo. Usa un Excel (.xlsx) con los nombres en la primera columna."); }
  }

  async function save() {
    setError("");
    const mat = materia.trim();
    if (!mat) { setError("Escribe el nombre de la materia"); return; }
    if (!editing && grupoId === "new" && !newGrupo.trim()) { setError("Escribe el nombre del grupo (p. ej. 304)"); return; }
    const bloques = horario.filter(b => b.inicio && b.fin);
    if (bloques.some(b => b.fin <= b.inicio)) { setError("En el horario, la hora de fin debe ser después de la de inicio"); return; }

    setBusy(true);
    try {
      // 1. Grupo
      let grupo = editing ? initial.grupo : grupoSel;
      if (!editing && grupoId === "new") {
        const name = newGrupo.trim();
        const dup = grupos.find(g => g.name.trim().toLowerCase() === name.toLowerCase());
        if (dup) { grupo = dup; }
        else {
          const { data, error:e } = await sb.from("grupos").insert({ name, turno, created_by:user.id }).select().single();
          if (e) throw new Error(e.code === "23505" ? `El grupo ${name} ya existe: elígelo de la lista` : e.message);
          grupo = data;
        }
      }
      if (!grupo) throw new Error("Elige un grupo");

      // 2. Clase
      const fields = { name:`${grupo.name} ${mat}`, materia:mat, horario:bloques, grupo_id:grupo.id, turno };
      let saved;
      if (editing) {
        const { data, error:e } = await sb.from("sessions").update(fields).eq("id", initial.id).select("*, grupo:grupos(id,name,turno)").single();
        if (e) throw e; saved = data;
      } else {
        const { data, error:e } = await sb.from("sessions").insert({ ...fields, owner_id:user.id, date:today() }).select("*, grupo:grupos(id,name,turno)").single();
        if (e) throw e; saved = data;
      }

      // 3. Turno del grupo (lo comparten todas sus materias)
      if (grupo.turno !== turno) {
        const { error:e } = await sb.from("grupos").update({ turno }).eq("id", grupo.id);
        if (!e) saved = { ...saved, grupo: { ...saved.grupo, turno } };
      }
      // 4. Lista del grupo desde el Excel (solo agrega los nombres que no estén ya)
      let added = 0;
      if (!editing && roster?.length) {
        const { data:ex } = await sb.from("students").select("name").eq("grupo_id", grupo.id);
        const have = new Set((ex || []).map(x => x.name.trim().toLowerCase()));
        const seen = new Set();
        const toInsert = roster.filter(r => { const k = r.name.trim().toLowerCase(); if (have.has(k) || seen.has(k)) return false; seen.add(k); return true; })
          .map(r => ({ grupo_id: grupo.id, name: r.name.trim(), tutor_name: r.tutorName || null, tutor_phone: r.tutorPhone || null }));
        if (toInsert.length) {
          const { data:ins, error:e } = await sb.from("students").insert(toInsert).select("id");
          if (e) throw new Error("La clase se creó, pero no se pudo cargar la lista: " + e.message);
          added = ins?.length || 0;
        }
      }
      onSaved(saved, !editing, added);
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  }

  const lbl = { fontSize:11, color:C.muted, marginBottom:5 };
  const resumen = resumenHorario(horario);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:22,width:"100%",maxWidth:500,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{fontWeight:700,fontSize:17,color:C.text,marginBottom:16}}>{editing ? "✏️ Editar clase" : "📚 Nueva clase"}</div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Grupo */}
          <div>
            <div style={lbl}>Grupo</div>
            {editing ? (
              <div className="inp" style={{opacity:.8}}>{initial.grupo?.name || "—"} <span style={{color:C.muted,fontSize:12}}>(el grupo no se cambia en una clase con asistencia)</span></div>
            ) : (
              <>
                <select className="inp" value={grupoId} onChange={e => pickGrupo(e.target.value)} style={{cursor:"pointer"}}>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.name}{g.turno ? ` · ${TURNOS[g.turno].label}` : ""}</option>)}
                  <option value="new">➕ Nuevo grupo…</option>
                </select>
                {grupoId === "new" && (
                  <>
                    <input className="inp" style={{marginTop:8}} placeholder="Nombre del grupo, p. ej. 304" value={newGrupo} autoFocus onChange={e => setNewGrupo(e.target.value)}/>
                    {roster ? (
                      <div style={{marginTop:8,background:`${C.success}14`,border:`1px solid ${C.success}55`,borderRadius:10,padding:"9px 12px",display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,minWidth:0,fontSize:12}}>
                          <div style={{color:C.success,fontWeight:700}}>✅ {roster.length} alumnos listos para el grupo</div>
                          <div style={{color:C.muted,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rosterFile} · {roster.slice(0,3).map(r=>r.name).join(", ")}{roster.length>3?"…":""}</div>
                        </div>
                        <button className="btn" onClick={() => { setRoster(null); setRosterFile(""); }} style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px",fontSize:12,fontFamily:"inherit",flexShrink:0}}>Quitar</button>
                      </div>
                    ) : (
                      <div style={{display:"flex",gap:8,marginTop:8}}>
                        <label className="btn" style={{flex:1,background:`${C.accent}18`,color:C.accent,border:`1px dashed ${C.accent}88`,borderRadius:10,padding:"10px 8px",fontSize:13,fontWeight:600,textAlign:"center",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          📥 Subir lista del grupo (Excel)
                          <input type="file" accept=".xlsx,.xls,.csv" onChange={pickRoster} style={{display:"none"}}/>
                        </label>
                        <button className="btn" onClick={downloadStudentsTemplate} title="Descargar plantilla" style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 10px",fontSize:12,fontFamily:"inherit"}}>📄 Plantilla</button>
                      </div>
                    )}
                  </>
                )}
                <div style={{fontSize:11,color:C.muted,marginTop:5,lineHeight:1.4}}>
                  {grupoId === "new" ? "La lista se carga al crear el grupo y la verán todas sus materias. También puedes subirla después." : "La lista de alumnos del grupo ya está cargada y es la misma para todas sus materias."}
                </div>
              </>
            )}
          </div>

          {/* Materia */}
          <div>
            <div style={lbl}>Materia</div>
            <input className="inp" placeholder="Ej. Programación básica" value={materia} onChange={e => setMateria(e.target.value)}/>
          </div>

          {/* Turno */}
          <div>
            <div style={lbl}>Turno del grupo (Prefectura que lo revisa)</div>
            <div style={{display:"flex",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:3,gap:3}}>
              {Object.entries(TURNOS).map(([k, t]) => (
                <button key={k} className="btn" onClick={() => setTurno(k)}
                  style={{flex:1,background:turno===k?C.gold:"transparent",color:turno===k?"#1a1200":C.muted,borderRadius:8,padding:"8px 6px",fontSize:13,fontWeight:turno===k?700:500,fontFamily:"inherit",minHeight:36}}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horario */}
          <div>
            <div style={{...lbl,display:"flex",justifyContent:"space-between"}}><span>Horario</span><span style={{color:C.teal}}>{resumen}</span></div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {horario.map((b, i) => (
                <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:8,display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) 34px",gap:6,alignItems:"center"}}>
                  <select className="inp" value={b.dia} onChange={e => setBloque(i, "dia", e.target.value)} style={{gridColumn:"1 / 3",padding:"8px 8px",cursor:"pointer"}}>
                    {DIAS.map(d => <option key={d.n} value={d.n}>{d.largo}</option>)}
                  </select>
                  <button className="btn" onClick={() => delBloque(i)} title="Quitar" style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,padding:0,minHeight:36}}>×</button>
                  <label style={{fontSize:10,color:C.muted,display:"flex",flexDirection:"column",gap:3,minWidth:0}}>De
                    <input className="inp" type="time" value={b.inicio} onChange={e => setBloque(i, "inicio", e.target.value)} style={{padding:"8px 6px",minWidth:0}}/>
                  </label>
                  <label style={{fontSize:10,color:C.muted,display:"flex",flexDirection:"column",gap:3,minWidth:0}}>A
                    <input className="inp" type="time" value={b.fin} onChange={e => setBloque(i, "fin", e.target.value)} style={{padding:"8px 6px",minWidth:0}}/>
                  </label>
                </div>
              ))}
            </div>
            <button className="btn" onClick={addBloque}
              style={{marginTop:8,background:`${C.accent}18`,color:C.accent,border:`1px dashed ${C.accent}66`,borderRadius:10,padding:"8px 0",width:"100%",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
              + Agregar día
            </button>
            <div style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.4}}>Con el horario la app calcula las horas de cada clase (bloques de 50 min) y te muestra primero la clase que toca.</div>
          </div>

          {error && <div style={{color:C.danger,fontSize:12}}>{error}</div>}

          <div style={{display:"flex",gap:10}}>
            <button className="btn" onClick={save} disabled={busy}
              style={{flex:1,background:`linear-gradient(135deg,${C.accent},${C.teal})`,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
              {busy ? "Guardando…" : editing ? "💾 Guardar cambios" : "✅ Crear clase"}
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
