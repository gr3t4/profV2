import { useState } from "react";
import { sb } from "../lib/supabase";
import { C, TURNOS, today } from "../lib/constants";
import { DIAS, resumenHorario } from "../lib/horario";

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
      onSaved(saved, !editing);
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
                  <input className="inp" style={{marginTop:8}} placeholder="Nombre del grupo, p. ej. 304" value={newGrupo} autoFocus onChange={e => setNewGrupo(e.target.value)}/>
                )}
                <div style={{fontSize:11,color:C.muted,marginTop:5,lineHeight:1.4}}>
                  {grupoId === "new" ? "Después podrás importar la lista de alumnos del grupo." : "La lista de alumnos del grupo es la misma para todas sus materias."}
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
