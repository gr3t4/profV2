import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { C, STATUS, fmtDate } from "../lib/constants";
import { GlobalStyles, Empty } from "./Shared";

function pctColor(p) {
  if (p === null) return C.muted;
  if (p >= 80) return C.success;
  if (p >= 60) return C.warning;
  return C.danger;
}

export default function ParentView({ token }) {
  const [state, setState] = useState({ loading: true, error: false, studentName: "", sessionName: "", rows: [] });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await sb.rpc("get_parent_attendance", { p_token: token });
      if (!active) return;
      if (error || !data || data.length === 0) {
        setState({ loading: false, error: true, studentName: "", sessionName: "", rows: [] });
        return;
      }
      const rows = data.filter(r => r.att_date).sort((a, b) => b.att_date.localeCompare(a.att_date));
      setState({
        loading: false, error: false,
        studentName: data[0].student_name, sessionName: data[0].session_name,
        rows,
      });
    })();
    return () => { active = false; };
  }, [token]);

  const total = state.rows.length;
  const counts = { present: 0, late: 0, excused: 0, absent: 0 };
  state.rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
  const pct = total > 0 ? Math.round(((counts.present + counts.late + counts.excused) / total) * 100) : null;

  return (
    <div style={{minHeight:"100vh",width:"100%",background:C.bg,fontFamily:"Inter,sans-serif",position:"relative"}}>
      <GlobalStyles/>
      <div style={{maxWidth:520,margin:"0 auto",padding:"clamp(20px,5vw,32px) clamp(16px,5vw,24px)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#007a5e,#005a44)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 10px"}}>👨‍🏫</div>
          <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:20,color:C.text,fontWeight:800,margin:0}}>AppProf</h1>
          <div style={{color:C.muted,fontSize:12,marginTop:4}}>Consulta de asistencia para padres/tutores</div>
        </div>

        {state.loading && (
          <div style={{textAlign:"center",padding:"60px 0",color:C.muted,fontSize:14}}>Cargando...</div>
        )}

        {!state.loading && state.error && (
          <Empty icon="🔒" msg="Este link no es válido o ya no está disponible. Contacta a la institución si crees que es un error."/>
        )}

        {!state.loading && !state.error && (
          <>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:20,marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:17,color:C.text}}>{state.studentName}</div>
              <div style={{color:C.muted,fontSize:13,marginTop:2}}>{state.sessionName}</div>

              <div style={{display:"flex",alignItems:"center",gap:16,marginTop:18}}>
                <div style={{fontSize:34,fontWeight:800,fontFamily:"'Sora',sans-serif",color:pctColor(pct)}}>
                  {pct !== null ? `${pct}%` : "—"}
                </div>
                <div style={{flex:1}}>
                  <div style={{color:C.muted,fontSize:12,marginBottom:6}}>Asistencia general</div>
                  <div style={{display:"flex",gap:10,fontSize:12,flexWrap:"wrap"}}>
                    <span style={{color:C.success}}>✅ {counts.present}</span>
                    <span style={{color:C.late}}>🕐 {counts.late}</span>
                    <span style={{color:C.excused}}>📝 {counts.excused}</span>
                    <span style={{color:C.danger}}>❌ {counts.absent}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{fontSize:12,color:C.muted,marginBottom:8,letterSpacing:.5}}>HISTORIAL</div>
            {total === 0 ? (
              <Empty icon="📋" msg="Todavía no hay registros de asistencia."/>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {state.rows.map((r, i) => {
                  const st = STATUS[r.status] || STATUS.pending;
                  return (
                    <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
                      padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                      <div>
                        <div style={{fontSize:13,color:C.text,fontWeight:600}}>{fmtDate(r.att_date)}</div>
                        {r.reason && <div style={{fontSize:12,color:C.muted,marginTop:2}}>{r.reason}</div>}
                      </div>
                      <span style={{background:st.bg,color:st.color,borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div style={{marginTop:28,textAlign:"center",fontSize:11,color:C.muted}}>AppProf v4 · Solo lectura</div>
      </div>
    </div>
  );
}
