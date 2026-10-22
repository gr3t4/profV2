import { useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../lib/constants";
import { EVAL_DEFAULT, NIVEL, SIN_RA, etiquetaRA, nuevoIdRA, guardarConfig } from "../lib/evaluacion";
import { Empty } from "./Shared";

// ── Configuración de evaluación de la clase (resultados de aprendizaje y reglas) ──
function ConfigModal({ session, cfg, onSaved, onClose }) {
  const [f, setF] = useState(() => ({ ...cfg, ras: cfg.ras.map(r => ({ ...r })) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setRA = (i, k, v) => setF(p => ({ ...p, ras: p.ras.map((r, j) => j === i ? { ...r, [k]: v } : r) }));
  const addRA = () => setF(p => ({ ...p, ras: [...p.ras, { id: nuevoIdRA(), clave: "", nombre: "" }] }));
  const delRA = (i) => {
    if (!window.confirm("¿Quitar este resultado de aprendizaje? Sus actividades no se borran; quedarán como «Sin RA» hasta que les asignes otro.")) return;
    setF(p => ({ ...p, ras: p.ras.filter((_, j) => j !== i) }));
  };

  async function save() {
    const n = (k, lo, hi) => { const v = Number(String(f[k]).replace(",", ".")); return v >= lo && v <= hi ? v : null; };
    const ras = f.ras.map(r => ({ id: r.id, clave: r.clave.trim(), nombre: r.nombre.trim() })).filter(r => r.clave || r.nombre);
    if (ras.some(r => !r.clave)) { setError("Cada resultado de aprendizaje necesita su clave (por ejemplo 1.1)."); return; }
    if (new Set(ras.map(r => r.clave)).size !== ras.length) { setError("Hay dos resultados de aprendizaje con la misma clave."); return; }
    const out = {
      pct_asistencia: n("pct_asistencia", 0, 100), nota_tarde: n("nota_tarde", 0, 10), aprobatoria: n("aprobatoria", 0, 10),
      asistencia_min: n("asistencia_min", 0, 100), margen_riesgo: n("margen_riesgo", 0, 50), entregas_min: n("entregas_min", 0, 100),
    };
    if (Object.values(out).some(v => v === null)) { setError("Revisa los números: los porcentajes van de 0 a 100 y las calificaciones de 0 a 10."); return; }
    setBusy(true); setError("");
    try { onSaved(await guardarConfig(session.id, { ...out, ras })); }
    catch (e) { setError(e.message); setBusy(false); }
  }

  const lbl = { fontSize:11, color:C.muted, marginBottom:5 };
  const Num = ({ k, label, suf, step = 1 }) => (
    <div key={k} style={{ flex:"1 1 140px", minWidth:0 }}>
      <div style={lbl}>{label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <input className="inp" type="number" step={step} inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)}/>
        {suf && <span style={{ color:C.muted, fontSize:13 }}>{suf}</span>}
      </div>
    </div>
  );

  // Se dibuja directo en <body> para que ninguna animación de la página la desacomode
  return createPortal(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,color:C.text,fontFamily:"Inter,sans-serif",border:`1px solid ${C.border}`,borderRadius:20,padding:22,width:"100%",maxWidth:540,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>⚙️ Evaluación de la clase</div>
        <div style={{color:C.muted,fontSize:12,marginBottom:16}}>Resultados de aprendizaje, cómo se calcula la calificación y cuándo avisar que un alumno está en riesgo.</div>

        <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:C.teal}}>RESULTADOS DE APRENDIZAJE</div>
        {f.ras.length === 0 && <div style={{fontSize:12,color:C.muted,marginBottom:8}}>Agrega los resultados de aprendizaje del programa de la materia (por ejemplo 1.1, 1.2, 2.1).</div>}
        {f.ras.map((r, i) => (
          <div key={r.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <input className="inp" placeholder="1.1" value={r.clave} onChange={e => setRA(i, "clave", e.target.value)} style={{width:70,flexShrink:0,textAlign:"center"}}/>
            <input className="inp" placeholder="Descripción del resultado de aprendizaje" value={r.nombre} onChange={e => setRA(i, "nombre", e.target.value)} style={{flex:1,minWidth:0}}/>
            <button className="btn" onClick={() => delRA(i)} title="Quitar" style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:"none",borderRadius:8,padding:"8px 9px",flexShrink:0}}>🗑️</button>
          </div>
        ))}
        <button className="btn" onClick={addRA} style={{background:`${C.accent}18`,color:C.accent,border:`1px dashed ${C.accent}66`,borderRadius:10,padding:"9px 0",width:"100%",fontSize:13,fontWeight:600,fontFamily:"inherit",marginBottom:18}}>+ Agregar resultado de aprendizaje</button>

        <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:C.teal}}>CALIFICACIÓN</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:6}}>
          {Num({ k:"pct_asistencia", label:"La asistencia vale", suf:"%" })}
          {Num({ k:"nota_tarde", label:"Entrega tarde vale", suf:"/10", step:0.5 })}
          {Num({ k:"aprobatoria", label:"Calificación aprobatoria", step:0.5 })}
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Cada resultado de aprendizaje se califica con el promedio de sus actividades: entregó = 10, tarde = lo que pongas arriba, no entregó = 0, salvo que captures una calificación. Si la asistencia vale más de 0 %, se suma en esa proporción.</div>

        <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:C.teal}}>ALERTAS DE RIESGO</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:6}}>
          {Num({ k:"asistencia_min", label:"Asistencia mínima", suf:"%" })}
          {Num({ k:"margen_riesgo", label:"Avisar antes, con margen de", suf:"pts" })}
          {Num({ k:"entregas_min", label:"Entregas mínimas", suf:"%" })}
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Las faltas justificadas no cuentan como falta. Un alumno queda «reprobando» si su asistencia está bajo el mínimo o si no alcanza la aprobatoria en algún resultado de aprendizaje.</div>

        {error && <div style={{color:C.danger,fontSize:12,marginBottom:10}}>{error}</div>}
        <div style={{display:"flex",gap:10}}>
          <button className="btn" onClick={save} disabled={busy}
            style={{flex:1,background:`linear-gradient(135deg,${C.accent},${C.teal})`,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
            {busy ? "Guardando…" : "💾 Guardar"}
          </button>
          <button className="btn" onClick={() => setF(p => ({ ...EVAL_DEFAULT, ras: p.ras }))} title="Volver a los valores de inicio (no borra los resultados de aprendizaje)"
            style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 12px",fontSize:13,fontFamily:"inherit"}}>Restablecer</button>
          <button className="btn" onClick={onClose}
            style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:14,fontFamily:"inherit"}}>Cancelar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const colorCal = (v, apr) => v === null || v === undefined ? C.muted : v < apr ? C.danger : C.success;

export default function CalificacionesModule({ session, students, isViewer, showToast, stats, cfg, loading, onSessionChange, onExport, initialFilter }) {
  const [vista, setVista]   = useState("todos"); // "todos" | id de RA
  const [filtro, setFiltro] = useState(initialFilter || "all"); // all | risk
  const [config, setConfig] = useState(false);

  if (loading && !stats) return <div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>Calculando calificaciones…</div>;
  if (!stats) return <Empty icon="🎓" msg="No se pudieron cargar los datos. Revisa tu internet."/>;

  const { porAlumno, resumen, grupos } = stats;
  const apr = Number(cfg.aprobatoria);
  const grupoSel = grupos.find(g => g.id === vista) || null;
  const lista = students.filter(s => filtro === "all" || (porAlumno[s.id]?.nivel || 0) > 0)
    .sort((a, b) => filtro === "risk" ? (porAlumno[b.id].nivel - porAlumno[a.id].nivel) || a.name.localeCompare(b.name, "es") : 0);
  const bien = students.length - resumen.reprobando - resumen.riesgo;

  return (
    <div style={{animation:"fadeUp .3s ease both"}}>
      {config && <ConfigModal session={session} cfg={cfg} onClose={() => setConfig(false)}
        onSaved={s => { setConfig(false); onSessionChange(s); showToast("💾 Evaluación actualizada"); }}/>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div>
          <div style={{fontWeight:800,fontSize:18}}>Calificaciones</div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>Por resultado de aprendizaje · aprobatoria {apr} · asistencia mínima {cfg.asistencia_min}%</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn" onClick={onExport} style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:10,padding:"9px 12px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>📥 Excel</button>
          {!isViewer && <button className="btn" onClick={() => setConfig(true)} style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 12px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>⚙️ Configurar</button>}
        </div>
      </div>

      {/* Resumen de riesgo */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}}>
        {[[2, resumen.reprobando], [1, resumen.riesgo], [0, bien]].map(([n, v]) => (
          <button key={n} className="btn" onClick={() => setFiltro(n > 0 ? "risk" : "all")}
            style={{background:C.card,border:`1px solid ${NIVEL[n].color}55`,borderRadius:12,padding:"10px 4px",textAlign:"center",minWidth:0,fontFamily:"inherit"}}>
            <div style={{fontSize:22,fontWeight:800,color:NIVEL[n].color}}>{v}</div>
            <div style={{fontSize:11,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{NIVEL[n].icon} {NIVEL[n].label}</div>
          </button>
        ))}
      </div>

      {cfg.ras.length === 0 && (
        <div style={{background:`${C.gold}14`,border:`1px solid ${C.gold}55`,borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:13}}>
          Registra los <b>resultados de aprendizaje</b> de la materia en <b>⚙️ Configurar</b> y luego asigna cada actividad a su RA en <b>📝 Actividades</b>. Las alertas por asistencia ya funcionan.
        </div>
      )}

      {grupos.length > 0 && (
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
          {[{ id:"todos", label:"Todos los RA" }, ...grupos.map(g => ({ id:g.id, label:etiquetaRA(g.ra), n:g.acts.length, title:g.ra?.nombre }))].map(t => (
            <button key={t.id} className="btn chip" onClick={() => setVista(t.id)} title={t.title || ""}
              style={{background:vista===t.id?`${C.accent}22`:"transparent",color:vista===t.id?C.accent:C.muted,borderColor:vista===t.id?C.accent:C.border}}>
              {t.label}{t.n !== undefined && <span style={{opacity:.7}}> ({t.n})</span>}
            </button>
          ))}
        </div>
      )}
      {grupoSel?.ra?.nombre && <div style={{fontSize:12,color:C.text,marginBottom:8,padding:"6px 10px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}><b>{etiquetaRA(grupoSel.ra)}</b> · {grupoSel.ra.nombre}</div>}
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
        {[["all","Todos"],["risk","⚠️ Solo en riesgo"]].map(([k, l]) => (
          <button key={k} className="btn chip" onClick={() => setFiltro(k)}
            style={{background:filtro===k?`${C.warning}22`:"transparent",color:filtro===k?C.warning:C.muted,borderColor:filtro===k?C.warning:C.border}}>{l}</button>
        ))}
      </div>

      {lista.length === 0 ? <Empty icon="🎉" msg={filtro === "risk" ? "Ningún alumno en riesgo" : "Sin alumnos"}/> : (
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}}>
          {lista.map(s => {
            const e = porAlumno[s.id];
            const niv = NIVEL[e.nivel];
            const p = grupoSel ? e.cals[grupoSel.id] : null;
            return (
              <div key={s.id} style={{background:C.card,border:`1px solid ${e.nivel ? niv.color + "66" : C.border}`,borderRadius:12,padding:"10px 12px",minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,overflowWrap:"anywhere"}}>{e.nivel ? <span title={niv.label}>{niv.icon} </span> : null}{s.name}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                      <span style={{color: e.asist.pct !== null && e.asist.pct < Number(cfg.asistencia_min) ? C.danger : C.muted}}>📋 Asistencia {e.asist.pct === null ? "—" : Math.round(e.asist.pct) + "%"}{e.asist.faltas ? ` · ${e.asist.faltas} falta${e.asist.faltas === 1 ? "" : "s"}` : ""}</span>
                      <span>📝 {p ? (p.calificadas ? `${p.entregadas}/${p.calificadas} entregadas` : "sin registro") : (e.totCalif ? `${e.totEnt}/${e.totCalif} entregadas` : "sin actividades")}</span>
                    </div>
                  </div>
                  {p && (
                    <div style={{textAlign:"center",flexShrink:0,minWidth:52}}>
                      <div style={{fontSize:22,fontWeight:800,color:colorCal(p.cal, apr),fontFamily:"'Space Grotesk',sans-serif"}}>{p.cal === null ? "—" : p.cal.toFixed(1)}</div>
                      <div style={{fontSize:10,color:C.muted}}>{etiquetaRA(grupoSel.ra)}</div>
                    </div>
                  )}
                </div>
                {!p && grupos.length > 0 && (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                    {grupos.map(g => {
                      const c = e.cals[g.id]?.cal ?? null;
                      return (
                        <span key={g.id} title={g.ra?.nombre || "Actividades sin resultado de aprendizaje"}
                          style={{fontSize:12,borderRadius:8,padding:"3px 8px",border:`1px solid ${colorCal(c, apr)}55`,background:`${colorCal(c, apr)}12`,whiteSpace:"nowrap"}}>
                          <span style={{color:C.muted}}>{g.id === SIN_RA ? "Sin RA" : g.ra.clave}</span>{" "}
                          <b style={{color:colorCal(c, apr)}}>{c === null ? "—" : c.toFixed(1)}</b>
                        </span>
                      );
                    })}
                  </div>
                )}
                {e.motivos.length > 0 && (
                  <div style={{marginTop:6,fontSize:11,color:niv.color,display:"flex",gap:6,flexWrap:"wrap"}}>
                    {e.motivos.map((m, i) => <span key={i} style={{background:`${niv.color}14`,border:`1px solid ${niv.color}33`,borderRadius:6,padding:"2px 6px"}}>{m}</span>)}
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
