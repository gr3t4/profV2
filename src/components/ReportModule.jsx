import { useState, useEffect } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { Empty } from "./Shared";
import * as XLSX from "xlsx";

const RISK_ATT = 80; // % asistencia mínima

function RiskBadge({ level }) {
  const cfg = {
    ok:      { label:"Al corriente", color:C.success, icon:"✅" },
    warning: { label:"En riesgo",    color:C.warning,  icon:"⚠️" },
    danger:  { label:"Riesgo alto",  color:C.danger,   icon:"🚨" },
  }[level];
  return (
    <span style={{background:`${cfg.color}18`,color:cfg.color,border:`1px solid ${cfg.color}44`,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700}}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function MiniBar({ value, max=100, color }) {
  const pct = Math.min(100, Math.max(0, (value/max)*100));
  return (
    <div style={{background:C.border,borderRadius:4,height:6,width:"100%",overflow:"hidden"}}>
      <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:4,transition:"width .4s ease"}}/>
    </div>
  );
}

export default function ReportModule({ sessionId, students }) {
  const [report, setReport]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState("name"); // name | att | risk
  const [filter, setFilter]   = useState("all");  // all | ok | warning | danger

  async function buildReport() {
    setLoading(true);

    const { data:attData } = await sb.from("attendance")
      .select("student_id,date,status").eq("session_id", sessionId);

    const rows = students.map(s => {
      const attRows = (attData||[]).filter(a => a.student_id === s.id);
      const total   = attRows.length;
      const present = attRows.filter(a => ["present","late","excused"].includes(a.status)).length;
      const absent  = attRows.filter(a => a.status==="absent").length;
      const attPct  = total > 0 ? Math.round((present/total)*100) : null;
      const risk    = attPct === null ? "ok" : attPct < 60 ? "danger" : attPct < RISK_ATT ? "warning" : "ok";
      return { student:s, attPct, attTotal:total, attPresent:present, attAbsent:absent, risk };
    });

    setReport(rows);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      if (!sessionId || !students.length) {
        setReport([]);
        setLoading(false);
        return;
      }
      await buildReport();
    })();
  }, [sessionId, students]);

  function sorted(rows) {
    const filtered = filter==="all" ? rows : rows.filter(r=>r.risk===filter);
    return [...filtered].sort((a,b) => {
      if (sort==="name")  return a.student.name.localeCompare(b.student.name);
      if (sort==="att")   return (b.attPct??-1)-(a.attPct??-1);
      if (sort==="risk")  return ["danger","warning","ok"].indexOf(a.risk)-["danger","warning","ok"].indexOf(b.risk);
      return 0;
    });
  }

  function exportReport() {
    const header = ["Alumno","% Asistencia","Clases","Faltas","Estado"];
    const rows = sorted(report).map(r => [
      r.student.name,
      r.attPct !== null ? r.attPct+"%" : "—",
      r.attTotal,
      r.attAbsent,
      {ok:"Al corriente",warning:"En riesgo",danger:"Riesgo alto"}[r.risk],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header,...rows]), "Reporte de grupo");
    XLSX.writeFile(wb, "reporte_asistencia_grupo.xlsx");
  }

  const riskCounts = {
    danger:  report.filter(r=>r.risk==="danger").length,
    warning: report.filter(r=>r.risk==="warning").length,
    ok:      report.filter(r=>r.risk==="ok").length,
  };

  const displayed = sorted(report);

  return (
    <div style={{animation:"fadeUp .4s ease both"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:22,fontWeight:700}}>📈 Estadísticas de asistencia</h2>
          <p style={{color:C.muted,fontSize:13,marginTop:4}}>Alumnos con más faltas · Alertas de riesgo</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn" onClick={buildReport}
            style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
            🔄 Actualizar
          </button>
          <button className="btn" onClick={exportReport}
            style={{background:`${C.success}22`,color:C.success,border:`1px solid ${C.success}44`,borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
            📥 Excel
          </button>
        </div>
      </div>

      <div className="grid-stats-3" style={{marginBottom:20}}>
        {[
          {label:"Riesgo alto",  count:riskCounts.danger,  color:C.danger,  icon:"🚨", id:"danger"},
          {label:"En riesgo",    count:riskCounts.warning, color:C.warning, icon:"⚠️", id:"warning"},
          {label:"Al corriente", count:riskCounts.ok,      color:C.success, icon:"✅", id:"ok"},
        ].map(st=>(
          <button key={st.id} className="btn" onClick={()=>setFilter(filter===st.id?"all":st.id)}
            style={{background:filter===st.id?`${st.color}22`:C.card,border:`1px solid ${filter===st.id?st.color:C.border}`,borderRadius:14,padding:"16px 12px",textAlign:"center",transition:"all .2s",width:"100%"}}>
            <div style={{fontSize:24}}>{st.icon}</div>
            <div style={{fontSize:26,fontWeight:700,color:st.color,fontFamily:"'Sora',sans-serif"}}>{st.count}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:2}}>{st.label}</div>
          </button>
        ))}
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 18px",marginBottom:16,display:"flex",gap:20,flexWrap:"wrap",fontSize:12,color:C.muted}}>
        <span>⚠️ Riesgo si: asistencia &lt; {RISK_ATT}%</span>
        <span style={{marginLeft:"auto",color:C.accent}}>Toca una tarjeta para filtrar</span>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{color:C.muted,fontSize:12}}>Ordenar:</span>
        {[["name","Nombre"],["att","Asistencia"],["risk","Riesgo"]].map(([k,l])=>(
          <button key={k} className="btn chip" onClick={()=>setSort(k)}
            style={{background:sort===k?`${C.accent}22`:"transparent",color:sort===k?C.accent:C.muted,borderColor:sort===k?C.accent:C.border}}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>Calculando...</div>
      ) : displayed.length === 0 ? (
        <Empty icon="📊" msg="Sin datos suficientes aún."/>
      ) : (
        <div style={{display:"grid",gap:10}}>
          {displayed.map((r,i) => {
            const attColor = r.attPct===null ? C.muted : r.attPct>=RISK_ATT ? C.success : r.attPct>=60 ? C.warning : C.danger;
            return (
              <div key={r.student.id} style={{background:C.card,border:`1px solid ${r.risk==="danger"?C.danger:r.risk==="warning"?C.warning:C.border}44`,borderRadius:14,padding:"16px 20px",animation:`slideIn .3s ease both`,animationDelay:`${i*.02}s`}}>
                <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <div style={{width:40,height:40,borderRadius:10,background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:C.accent,flexShrink:0}}>
                    {r.student.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:120}}>
                    <div style={{fontWeight:600,fontSize:14}}>{r.student.name}</div>
                    <div style={{marginTop:4}}><RiskBadge level={r.risk}/></div>
                  </div>
                  <div style={{minWidth:160,flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,color:C.muted}}>Asistencia</span>
                      <span style={{fontSize:12,fontWeight:700,color:attColor}}>{r.attPct!==null?r.attPct+"%":"—"}</span>
                    </div>
                    <MiniBar value={r.attPct??0} color={attColor}/>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{r.attPresent}/{r.attTotal} clases · {r.attAbsent} faltas</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
