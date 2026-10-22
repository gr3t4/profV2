import { useState } from "react";
import { sb } from "../lib/supabase";
import { C, fmtDate } from "../lib/constants";
import { EVAL_DEFAULT, NIVEL } from "../lib/evaluacion";
import { Empty } from "./Shared";


// ── Configuración de evaluación de la clase ──
function ConfigModal({ session, cfg, onSaved, onClose }) {
  const [f, setF] = useState(() => ({ ...cfg, parciales: cfg.parciales.map(p => ({ ...p })) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setP = (i, k, v) => setF(p => ({ ...p, parciales: p.parciales.map((x, j) => j === i ? { ...x, [k]: v } : x) }));

  async function save() {
    const n = (k, lo, hi) => { const v = Number(String(f[k]).replace(",", ".")); return v >= lo && v <= hi ? v : null; };
    const out = {
      pct_asistencia: n("pct_asistencia", 0, 100), nota_tarde: n("nota_tarde", 0, 10), aprobatoria: n("aprobatoria", 0, 10),
      asistencia_min: n("asistencia_min", 0, 100), margen_riesgo: n("margen_riesgo", 0, 50), entregas_min: n("entregas_min", 0, 100),
      parciales: f.parciales.map(p => ({ inicio: p.inicio || "", fin: p.fin || "" })),
    };
    if (Object.values(out).some(v => v === null)) { setError("Revisa los números: los porcentajes van de 0 a 100 y las calificaciones de 0 a 10."); return; }
    if (out.parciales.some(p => p.inicio && p.fin && p.inicio > p.fin)) { setError("En algún parcial la fecha de inicio es posterior a la de fin."); return; }
    setBusy(true); setError("");
    const { data, error: e } = await sb.from("sessions").update({ eval_config: out }).eq("id", session.id).select("*, grupo:grupos(id,name,turno)").single();
    setBusy(false);
    if (e) { setError(e.message); return; }
    onSaved(data);
  }

  const lbl = { fontSize:11, color:C.muted, marginBottom:5 };
  const Num = ({ k, label, suf, step = 1 }) => (
    <div style={{ flex:"1 1 140px", minWidth:0 }}>
      <div style={lbl}>{label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <input className="inp" type="number" step={step} inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)}/>
        {suf && <span style={{ color:C.muted, fontSize:13 }}>{suf}</span>}
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:22,width:"100%",maxWidth:520,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>⚙️ Evaluación de la clase</div>
        <div style={{color:C.muted,fontSize:12,marginBottom:16}}>Cómo se calcula la calificación y cuándo avisar que un alumno está en riesgo.</div>

        <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:C.teal}}>CALIFICACIÓN</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:6}}>
          {Num({ k:"pct_asistencia", label:"La asistencia vale", suf:"%" })}
          {Num({ k:"nota_tarde", label:"Entrega tarde vale", suf:"/10", step:0.5 })}
          {Num({ k:"aprobatoria", label:"Calificación aprobatoria", step:0.5 })}
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Actividades: entregó = 10, tarde = lo que pongas arriba, no entregó = 0, salvo que captures una calificación. Si la asistencia vale 0 %, la calificación es solo el promedio de actividades.</div>

        <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:C.teal}}>ALERTAS DE RIESGO</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:6}}>
          {Num({ k:"asistencia_min", label:"Asistencia mínima", suf:"%" })}
          {Num({ k:"margen_riesgo", label:"Avisar antes, con margen de", suf:"pts" })}
          {Num({ k:"entregas_min", label:"Entregas mínimas", suf:"%" })}
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Las faltas justificadas no cuentan como falta. Con asistencia mínima de 80 % y margen de 5, se avisa desde 84 % y se marca reprobando bajo 80 %.</div>

        <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:C.teal}}>FECHAS DE LOS PARCIALES <span style={{color:C.muted,fontWeight:400}}>(opcional)</span></div>
        {f.parciales.map((p, i) => (
          <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
            <div style={{width:70,fontSize:13,fontWeight:600}}>Parcial {i + 1}</div>
            <input className="inp" type="date" value={p.inicio} onChange={e => setP(i, "inicio", e.target.value)} style={{flex:"1 1 130px"}}/>
            <input className="inp" type="date" value={p.fin} onChange={e => setP(i, "fin", e.target.value)} style={{flex:"1 1 130px"}}/>
          </div>
        ))}
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Sirven para tomar la asistencia de cada parcial. Si las dejas vacías se usa la asistencia de todo el periodo.</div>

        {error && <div style={{color:C.danger,fontSize:12,marginBottom:10}}>{error}</div>}
        <div style={{display:"flex",gap:10}}>
          <button className="btn" onClick={save} disabled={busy}
            style={{flex:1,background:`linear-gradient(135deg,${C.accent},${C.teal})`,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
            {busy ? "Guardando…" : "💾 Guardar"}
          </button>
          <button className="btn" onClick={() => setF({ ...EVAL_DEFAULT, parciales: f.parciales })} title="Volver a los valores de inicio"
            style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 12px",fontSize:13,fontFamily:"inherit"}}>Restablecer</button>
          <button className="btn" onClick={onClose}
            style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:14,fontFamily:"inherit"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function CalificacionesModule({ session, students, isViewer, showToast, stats, cfg, loading, onSessionChange, onExport, initialFilter }) {
  const [vista, setVista]   = useState("final"); // 0,1,2 | "final"
  const [filtro, setFiltro] = useState(initialFilter || "all"); // all | risk
  const [config, setConfig] = useState(false);

  if (loading && !stats) return <div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>Calculando calificaciones…</div>;
  if (!stats) return <Empty icon="🎓" msg="No se pudieron cargar los datos. Revisa tu internet."/>;

  const { porAlumno, resumen, actsPorParcial } = stats;
  const sinActs = actsPorParcial.every(l => l.length === 0);
  const apr = Number(cfg.aprobatoria);
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
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>Aprobatoria {apr} · asistencia mínima {cfg.asistencia_min}%{Number(cfg.pct_asistencia) ? ` · asistencia vale ${cfg.pct_asistencia}%` : ""}</div>
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

      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
        {[[0,"Parcial 1"],[1,"Parcial 2"],[2,"Parcial 3"],["final","Final"]].map(([k, l]) => (
          <button key={k} className="btn chip" onClick={() => setVista(k)}
            style={{background:vista===k?`${C.accent}22`:"transparent",color:vista===k?C.accent:C.muted,borderColor:vista===k?C.accent:C.border}}>
            {l}{k !== "final" && <span style={{opacity:.7}}> ({actsPorParcial[k].length})</span>}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
        {[["all","Todos"],["risk","⚠️ Solo en riesgo"]].map(([k, l]) => (
          <button key={k} className="btn chip" onClick={() => setFiltro(k)}
            style={{background:filtro===k?`${C.warning}22`:"transparent",color:filtro===k?C.warning:C.muted,borderColor:filtro===k?C.warning:C.border}}>{l}</button>
        ))}
      </div>

      {sinActs && <div style={{background:`${C.gold}14`,border:`1px solid ${C.gold}55`,borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:13}}>
        Aún no hay actividades. Regístralas en <b>📝 Actividades</b> (indicando su parcial y su valor) para calcular calificaciones. Las alertas por asistencia ya funcionan.
      </div>}

      {lista.length === 0 ? <Empty icon="🎉" msg={filtro === "risk" ? "Ningún alumno en riesgo" : "Sin alumnos"}/> : (
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}}>
          {lista.map(s => {
            const e = porAlumno[s.id];
            const niv = NIVEL[e.nivel];
            const p = vista === "final" ? null : e.parciales[vista];
            const cal = vista === "final" ? e.final : p.cal;
            const asis = vista === "final" ? e.asist : p.asis;
            return (
              <div key={s.id} style={{background:C.card,border:`1px solid ${e.nivel ? niv.color + "66" : C.border}`,borderRadius:12,padding:"10px 12px",minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,overflowWrap:"anywhere"}}>{e.nivel ? <span title={niv.label}>{niv.icon} </span> : null}{s.name}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                      <span style={{color: asis.pct !== null && asis.pct < Number(cfg.asistencia_min) ? C.danger : C.muted}}>📋 Asistencia {asis.pct === null ? "—" : Math.round(asis.pct) + "%"}{asis.faltas ? ` · ${asis.faltas} falta${asis.faltas === 1 ? "" : "s"}` : ""}</span>
                      <span>📝 {vista === "final" ? (e.totCalif ? `${e.totEnt}/${e.totCalif} entregadas` : "sin actividades") : (p.calificadas ? `${p.entregadas}/${p.calificadas} entregadas` : "sin actividades")}</span>
                      {vista !== "final" && p.promAct !== null && Number(cfg.pct_asistencia) > 0 && <span>Prom. act. {p.promAct}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0,minWidth:52}}>
                    <div style={{fontSize:22,fontWeight:800,color: cal === null ? C.muted : cal < apr ? C.danger : C.success,fontFamily:"'Space Grotesk',sans-serif"}}>{cal === null ? "—" : cal.toFixed(1)}</div>
                    <div style={{fontSize:10,color:C.muted}}>{vista === "final" ? "Final" : `P${vista + 1}`}</div>
                  </div>
                </div>
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
      {cfg.parciales.some(p => p.inicio || p.fin) && (
        <div style={{fontSize:11,color:C.muted,marginTop:12}}>
          {cfg.parciales.map((p, i) => (p.inicio || p.fin) ? `P${i + 1}: ${p.inicio ? fmtDate(p.inicio) : "…"} – ${p.fin ? fmtDate(p.fin) : "…"}` : null).filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
