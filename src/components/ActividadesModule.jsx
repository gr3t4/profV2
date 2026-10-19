import { useEffect, useState } from "react";
import { sb, fetchAll } from "../lib/supabase";
import { C, today, fmtDate } from "../lib/constants";
import { Empty } from "./Shared";

// Control de actividades / productos de una clase: qué alumnos entregaron.
const ST = {
  delivered: { label:"Entregó",    short:"✓", icon:"✅", color:C.success },
  late:      { label:"Tarde",      short:"T", icon:"🕐", color:C.late },
  missing:   { label:"No entregó", short:"✗", icon:"❌", color:C.danger },
};

function ActividadForm({ initial, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [due, setDue]     = useState(initial?.due_date || today());
  const [desc, setDesc]   = useState(initial?.description || "");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!title.trim()) { setError("Escribe el nombre de la actividad"); return; }
    setBusy(true); setError("");
    const err = await onSave({ title: title.trim(), due_date: due || null, description: desc.trim() || null });
    setBusy(false);
    if (err) setError(err);
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:22,width:"100%",maxWidth:440,boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{fontWeight:700,fontSize:17,marginBottom:14}}>{initial ? "✏️ Editar actividad" : "📝 Nueva actividad"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Actividad / producto</div>
            <input className="inp" autoFocus placeholder="Ej. Práctica 3: diagramas de flujo" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Fecha de entrega</div>
            <input className="inp" type="date" value={due} onChange={e=>setDue(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Descripción (opcional)</div>
            <textarea className="inp" rows={3} placeholder="Instrucciones, criterios, etc." value={desc} onChange={e=>setDesc(e.target.value)} style={{resize:"vertical"}}/>
          </div>
          {error && <div style={{color:C.danger,fontSize:12}}>{error}</div>}
          <div style={{display:"flex",gap:10}}>
            <button className="btn" onClick={save} disabled={busy}
              style={{flex:1,background:`linear-gradient(135deg,${C.accent},${C.teal})`,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
              {busy ? "Guardando…" : initial ? "💾 Guardar" : "✅ Crear actividad"}
            </button>
            <button className="btn" onClick={onClose}
              style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",fontSize:14,fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActividadesModule({ session, students, isViewer, showToast, sessionLabel }) {
  const [acts, setActs]       = useState([]);
  const [marks, setMarks]     = useState({});   // activity_id -> { student_id: status }
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId]   = useState(null);
  const [form, setForm]       = useState(null); // null | { initial }
  const [filter, setFilter]   = useState("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: a } = await sb.from("activities").select("*").eq("session_id", session.id)
        .order("due_date", { ascending:false, nullsFirst:false }).order("created_at", { ascending:false });
      const ids = (a || []).map(x => x.id);
      const m = {};
      if (ids.length) {
        const { data: mk } = await fetchAll(() => sb.from("activity_marks").select("activity_id,student_id,status").in("activity_id", ids).order("id"));
        (mk || []).forEach(r => { (m[r.activity_id] ??= {})[r.student_id] = r.status; });
      }
      if (!alive) return;
      setActs(a || []); setMarks(m); setLoading(false);
    })();
    return () => { alive = false; };
  }, [session.id]);

  const countsOf = (id) => {
    const mm = marks[id] || {};
    const c = { delivered:0, late:0, missing:0, pending:0 };
    students.forEach(s => { c[mm[s.id] || "pending"]++; });
    return c;
  };

  async function saveActivity(fields) {
    if (form.initial) {
      const { data, error } = await sb.from("activities").update(fields).eq("id", form.initial.id).select().single();
      if (error) return error.message;
      setActs(p => p.map(a => a.id === data.id ? data : a));
      showToast("💾 Actividad actualizada");
    } else {
      const { data, error } = await sb.from("activities").insert({ ...fields, session_id: session.id }).select().single();
      if (error) return error.message;
      setActs(p => [data, ...p]);
      setOpenId(data.id);
      showToast("✅ Actividad creada");
    }
    setForm(null);
    return null;
  }

  async function deleteActivity(a) {
    if (!window.confirm(`¿Eliminar la actividad "${a.title}" y sus entregas registradas?`)) return;
    const { error } = await sb.from("activities").delete().eq("id", a.id);
    if (error) { showToast("❌ " + error.message); return; }
    setActs(p => p.filter(x => x.id !== a.id));
    if (openId === a.id) setOpenId(null);
    showToast("🗑️ Actividad eliminada");
  }

  // Marca (o quita, si se toca la misma opción) la entrega de uno o varios alumnos
  async function setMark(actId, studentIds, status) {
    const prev = { ...(marks[actId] || {}) };
    const next = { ...prev };
    studentIds.forEach(id => { if (status) next[id] = status; else delete next[id]; });
    setMarks(p => ({ ...p, [actId]: next }));
    const { error } = status
      ? await sb.from("activity_marks").upsert(studentIds.map(id => ({ activity_id: actId, student_id: id, status, updated_at: new Date().toISOString() })), { onConflict:"activity_id,student_id" })
      : await sb.from("activity_marks").delete().eq("activity_id", actId).in("student_id", studentIds);
    if (error) {
      setMarks(p => ({ ...p, [actId]: prev }));
      showToast("❌ No se guardó: " + (error.message.includes("fetch") ? "sin internet" : error.message));
    }
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const ordered = [...acts].sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "") || a.created_at.localeCompare(b.created_at));
    const header = ["Alumno", ...ordered.map(a => `${a.title}${a.due_date ? ` (${a.due_date.slice(8,10)}/${a.due_date.slice(5,7)})` : ""}`), "Entregadas", "Tarde", "No entregadas", "% Entrega"];
    const rows = students.map(s => {
      let d = 0, l = 0, m = 0;
      const cells = ordered.map(a => {
        const st = marks[a.id]?.[s.id];
        if (st === "delivered") d++; else if (st === "late") l++; else if (st === "missing") m++;
        return st ? ST[st].short : "-";
      });
      return [s.name, ...cells, d, l, m, ordered.length ? Math.round(((d + l) / ordered.length) * 100) + "%" : "-"];
    });
    const ws = XLSX.utils.aoa_to_sheet([[`Actividades — ${sessionLabel}`], [], header, ...rows, [], ["✓ entregó · T entregó tarde · ✗ no entregó · - sin registro"]]);
    ws["!cols"] = [{ wch:36 }, ...ordered.map(() => ({ wch:14 })), { wch:11 }, { wch:7 }, { wch:14 }, { wch:10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actividades");
    XLSX.writeFile(wb, `actividades_${sessionLabel.replace(/[^\p{L}\p{N}]+/gu, "_")}.xlsx`);
    showToast("📥 Excel descargado");
  }

  const open = acts.find(a => a.id === openId) || null;
  const openMarks = open ? (marks[open.id] || {}) : {};
  const filtered = !open ? [] : students.filter(s => filter === "all" || (openMarks[s.id] || "pending") === filter);

  if (loading) return <div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>Cargando actividades…</div>;

  // ── Detalle de una actividad ──
  if (open) {
    const c = countsOf(open.id);
    const total = students.length || 1;
    return (
      <div style={{animation:"fadeUp .3s ease both"}}>
        {form && <ActividadForm initial={form.initial} onSave={saveActivity} onClose={() => setForm(null)}/>}
        <button className="btn" onClick={() => { setOpenId(null); setFilter("all"); }}
          style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,fontFamily:"inherit",marginBottom:12}}>
          ← Todas las actividades
        </button>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 18px",marginBottom:14}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:18,overflowWrap:"anywhere"}}>{open.title}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:3}}>📅 Entrega: {open.due_date ? fmtDate(open.due_date) : "sin fecha"}</div>
              {open.description && <div style={{fontSize:13,marginTop:8,color:C.text,whiteSpace:"pre-wrap"}}>{open.description}</div>}
            </div>
            {!isViewer && <button className="btn" title="Editar" onClick={() => setForm({ initial: open })} style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 9px",flexShrink:0}}>✏️</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6,marginTop:14}}>
            {[["delivered",c.delivered],["late",c.late],["missing",c.missing],["pending",c.pending]].map(([k,v]) => (
              <div key={k} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 2px",textAlign:"center",minWidth:0}}>
                <div style={{fontSize:20,fontWeight:700,color:k==="pending"?C.muted:ST[k].color}}>{v}</div>
                <div style={{fontSize:10,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{k==="pending"?"Sin registro":ST[k].label}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.border,borderRadius:6,height:8,overflow:"hidden",display:"flex",marginTop:10}}>
            {[["delivered"],["late"],["missing"]].map(([k]) => <div key={k} style={{width:`${(c[k]/total)*100}%`,background:ST[k].color}}/>)}
          </div>
        </div>

        {!isViewer && (
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
            <button className="btn" onClick={() => setMark(open.id, students.filter(s => !openMarks[s.id]).map(s => s.id), "delivered")}
              style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:9,padding:"8px 12px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>✅ Pendientes → Entregó</button>
            <button className="btn" onClick={() => setMark(open.id, students.filter(s => !openMarks[s.id]).map(s => s.id), "missing")}
              style={{background:`${C.danger}22`,color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:9,padding:"8px 12px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>❌ Pendientes → No entregó</button>
          </div>
        )}
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
          {[["all","Todos",C.accent],["delivered","Entregó",C.success],["late","Tarde",C.late],["missing","No entregó",C.danger],["pending","Sin registro",C.muted]].map(([k,l,color]) => (
            <button key={k} className="btn chip" onClick={() => setFilter(k)}
              style={{background:filter===k?`${color}22`:"transparent",color:filter===k?color:C.muted,borderColor:filter===k?color:C.border}}>{l}</button>
          ))}
        </div>

        {filtered.length === 0 ? <Empty icon="👥" msg="Sin alumnos en este filtro"/> : (
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}}>
            {filtered.map(s => {
              const st = openMarks[s.id];
              const cfg = st ? ST[st] : null;
              return (
                <div key={s.id} style={{background:C.card,border:`1px solid ${cfg ? cfg.color + "55" : C.border}`,borderRadius:12,padding:"10px 12px",minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:isViewer?0:8}}>
                    <div style={{flex:1,minWidth:0,fontWeight:600,fontSize:14,overflowWrap:"anywhere"}}>{s.name}</div>
                    <span style={{fontSize:11,fontWeight:700,color:cfg?cfg.color:C.muted,flexShrink:0}}>{cfg ? `${cfg.icon} ${cfg.label}` : "⏳ Sin registro"}</span>
                  </div>
                  {!isViewer && (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6}}>
                      {Object.entries(ST).map(([k, b]) => {
                        const on = st === k;
                        return (
                          <button key={k} className="btn" onClick={() => setMark(open.id, [s.id], on ? null : k)}
                            style={{background:on?b.color:`${b.color}15`,color:on?"#fff":b.color,border:`1.5px solid ${b.color}66`,borderRadius:8,padding:"7px 2px",fontSize:12,fontWeight:on?700:600,fontFamily:"inherit",minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {b.icon} {b.label}
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
    );
  }

  // ── Lista de actividades ──
  return (
    <div style={{animation:"fadeUp .3s ease both"}}>
      {form && <ActividadForm initial={form.initial} onSave={saveActivity} onClose={() => setForm(null)}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div>
          <div style={{fontWeight:800,fontSize:18}}>Actividades</div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>{acts.length} registrada{acts.length===1?"":"s"} · {students.length} alumnos</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {acts.length > 0 && <button className="btn" onClick={exportXlsx} style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:10,padding:"9px 12px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>📥 Excel</button>}
          {!isViewer && <button className="btn" onClick={() => setForm({ initial:null })} style={{background:`linear-gradient(135deg,${C.accent},${C.purple})`,color:"#fff",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>+ Nueva actividad</button>}
        </div>
      </div>

      {acts.length === 0 ? <Empty icon="📝" msg="Aún no hay actividades. Registra la primera para llevar el control de entregas."/> : (
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:10}}>
          {acts.map(a => {
            const c = countsOf(a.id);
            const total = students.length || 1;
            const vencida = a.due_date && a.due_date < today();
            return (
              <div key={a.id} className="row-hover" onClick={() => setOpenId(a.id)}
                style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 14px",cursor:"pointer",minWidth:0}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,overflowWrap:"anywhere"}}>{a.title}</div>
                    <div style={{fontSize:12,color:vencida?C.warning:C.muted,marginTop:2}}>📅 {a.due_date ? fmtDate(a.due_date) : "Sin fecha"}{vencida && c.pending ? " · vencida" : ""}</div>
                  </div>
                  {!isViewer && (
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button className="btn" title="Editar" onClick={e => { e.stopPropagation(); setForm({ initial:a }); }} style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"5px 8px"}}>✏️</button>
                      <button className="btn" title="Eliminar" onClick={e => { e.stopPropagation(); deleteActivity(a); }} style={{background:"rgba(239,68,68,0.1)",color:C.danger,border:"none",borderRadius:8,padding:"5px 8px"}}>🗑️</button>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:12,fontSize:12,marginTop:8,flexWrap:"wrap"}}>
                  <span style={{color:C.success}}>✅ {c.delivered}</span>
                  <span style={{color:C.late}}>🕐 {c.late}</span>
                  <span style={{color:C.danger}}>❌ {c.missing}</span>
                  {c.pending > 0 && <span style={{color:C.muted}}>⏳ {c.pending} sin registro</span>}
                </div>
                <div style={{background:C.border,borderRadius:6,height:6,overflow:"hidden",display:"flex",marginTop:8}}>
                  {["delivered","late","missing"].map(k => <div key={k} style={{width:`${(c[k]/total)*100}%`,background:ST[k].color}}/>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
