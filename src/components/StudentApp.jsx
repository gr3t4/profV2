import { useState, useEffect, useRef } from "react";
import { sb } from "../lib/supabase";
import { C, fmtDate } from "../lib/constants";
import { GlobalStyles, Toast, Empty } from "./Shared";

const STATUS_COLORS = {
  present: { label:"Presente",    icon:"✅", color:C.success },
  absent:  { label:"Ausente",     icon:"❌", color:C.danger  },
  late:    { label:"Retardo",     icon:"🕐", color:C.late    },
  excused: { label:"Justificada", icon:"📝", color:C.excused },
  pending: { label:"Sin reg.",    icon:"⏳", color:C.muted   },
};

const TASK_ST = {
  pending: { label:"Pendiente",  icon:"⏳", color:C.muted   },
  on_time: { label:"A tiempo",   icon:"✅", color:C.success },
  late:    { label:"Tarde",      icon:"🕐", color:C.late    },
  missing: { label:"No entregó", icon:"❌", color:C.danger  },
};

async function requestNotifPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied")  return "denied";
  return await Notification.requestPermission();
}
function sendNotif(title, body) {
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon:"/pwa-192x192.png", vibrate:[200,100,200] });
}

// ── Tarjeta de tarea ─────────────────────────────────────────────
function TaskCard({ task, submission }) {
  const sub = submission || {};
  const st  = TASK_ST[sub.status || "pending"];
  const overdue = task.due_date && new Date(task.due_date+"T23:59:59") < new Date() && !sub.status;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${st.color}`,borderRadius:12,padding:"12px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:14,color:C.text,marginBottom:3,wordBreak:"break-word"}}>{task.title}</div>
          {task.description && <div style={{fontSize:12,color:C.muted,marginBottom:6,lineHeight:1.5,wordBreak:"break-word"}}>{task.description}</div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:C.muted}}>
            {task.due_date && <span style={{color:overdue?C.danger:C.muted}}>📅 {fmtDate(task.due_date)}{overdue?" · Vencida":""}</span>}
            <span>🎯 Máx: {task.max_score}</span>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,minWidth:80}}>
          <div style={{background:`${st.color}18`,color:st.color,border:`1px solid ${st.color}44`,borderRadius:20,padding:"3px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>
            {st.icon} {st.label}
          </div>
          {sub.score != null && <div style={{fontSize:13,fontWeight:700,color:C.text,marginTop:4}}>{sub.score}/{task.max_score}</div>}
          {sub.notes && <div style={{fontSize:11,color:C.muted,marginTop:3,maxWidth:120,wordBreak:"break-word"}}>💬 {sub.notes}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Tareas agrupadas por materia ─────────────────────────────────
function TasksBySubject({ tasks, subs, subjects }) {
  const [openSubj, setOpenSubj] = useState(null);

  if (subjects.length === 0) {
    return tasks.length === 0
      ? <Empty icon="📋" msg="No hay tareas asignadas aún"/>
      : <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {tasks.map(t=><TaskCard key={t.id} task={t} submission={subs.find(s=>s.task_id===t.id)}/>)}
        </div>;
  }

  const bySubject = {};
  subjects.forEach(s=>{ bySubject[s.id]=[]; });
  const general = [];
  tasks.forEach(t=>{
    if (t.subject_id && bySubject[t.subject_id]) bySubject[t.subject_id].push(t);
    else general.push(t);
  });
  const sections = [
    ...subjects.map(s=>({ id:s.id, name:s.name, period:s.period, tasks:bySubject[s.id]||[] })),
    ...(general.length>0?[{ id:"general", name:"General", period:null, tasks:general }]:[]),
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {sections.map(sec=>{
        const pending = sec.tasks.filter(t=>{ const sub=subs.find(s=>s.task_id===t.id); return !sub||sub.status==="pending"; }).length;
        const isOpen = openSubj===sec.id;
        return (
          <div key={sec.id} style={{background:C.card,border:`1px solid ${isOpen?C.accent:C.border}`,borderRadius:14,overflow:"hidden",transition:"border-color .2s"}}>
            <div onClick={()=>setOpenSubj(isOpen?null:sec.id)} style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:isOpen?`${C.accent}0d`:"transparent"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                <span style={{fontSize:20,flexShrink:0}}>📚</span>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sec.name}</div>
                  {sec.period&&<div style={{fontSize:11,color:C.muted}}>{sec.period}</div>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                {pending>0&&<span style={{background:`${C.warning}22`,color:C.warning,border:`1px solid ${C.warning}44`,borderRadius:20,padding:"2px 7px",fontSize:11,fontWeight:700}}>{pending}</span>}
                <span style={{color:C.muted,fontSize:12}}>{sec.tasks.length}t</span>
                <span style={{color:C.muted,fontSize:14,display:"inline-block",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
              </div>
            </div>
            {isOpen&&(
              <div style={{padding:"0 12px 12px",display:"flex",flexDirection:"column",gap:8,borderTop:`1px solid ${C.border}`}}>
                {sec.tasks.length===0
                  ? <div style={{textAlign:"center",padding:"16px 0",color:C.muted,fontSize:13}}>Sin tareas</div>
                  : sec.tasks.map(t=><TaskCard key={t.id} task={t} submission={subs.find(s=>s.task_id===t.id)}/>)
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Fila de asistencia ───────────────────────────────────────────
function AttRow({ date, status, reason }) {
  const st = STATUS_COLORS[status]||STATUS_COLORS.pending;
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:`1px solid ${C.border}22`}}>
      <span style={{fontSize:18,flexShrink:0}}>{st.icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:C.text,fontWeight:500}}>{fmtDate(date)}</div>
        {reason&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>📝 {reason}</div>}
      </div>
      <span style={{background:`${st.color}18`,color:st.color,border:`1px solid ${st.color}44`,borderRadius:20,padding:"3px 8px",fontSize:11,fontWeight:600,flexShrink:0}}>{st.label}</span>
    </div>
  );
}

// ── Calificación por materia ─────────────────────────────────────
function GradeCard({ subject, activities, grades }) {
  const [open, setOpen] = useState(false);
  const weighted = activities.reduce((acc,act)=>{ const g=grades.find(g=>g.activity_id===act.id); if(g) acc+=(g.score*act.weight)/100; return acc; },0);
  const totalWeight = activities.reduce((a,b)=>a+b.weight,0);
  const avg = totalWeight>0?Math.round(weighted):null;
  const color = avg===null?C.muted:avg>=80?C.success:avg>=60?C.warning:C.danger;
  return (
    <div style={{background:C.card,border:`1px solid ${open?C.accent:C.border}`,borderRadius:12,overflow:"hidden",transition:"border-color .2s"}}>
      <div onClick={()=>setOpen(p=>!p)} style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <span style={{fontSize:20,flexShrink:0}}>📊</span>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{subject.name}</div>
            {subject.period&&<div style={{fontSize:11,color:C.muted}}>{subject.period}</div>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:800,color}}>{avg!==null?avg:"—"}</div>
            <div style={{fontSize:10,color:C.muted}}>promedio</div>
          </div>
          <span style={{color:C.muted,fontSize:14,display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
        </div>
      </div>
      {open&&activities.length>0&&(
        <div style={{padding:"10px 16px 14px",borderTop:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:8}}>
          {activities.map(act=>{
            const g=grades.find(g=>g.activity_id===act.id);
            const sc=g?g.score:null;
            const c=sc===null?C.muted:sc>=80?C.success:sc>=60?C.warning:C.danger;
            return (
              <div key={act.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span style={{color:C.muted,fontSize:13,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{act.name} <span style={{fontSize:11}}>({act.weight}%)</span></span>
                <span style={{fontWeight:700,color:c,fontSize:14,flexShrink:0}}>{sc!==null?sc:"—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── App principal ────────────────────────────────────────────────
export default function StudentApp({ user, onLogout }) {
  const [tab, setTab]             = useState("tasks");
  const [student, setStudent]     = useState(null);
  const [session, setSession]     = useState(null);
  const [tasks, setTasks]         = useState([]);
  const [subs, setSubs]           = useState([]);
  const [attendance, setAtt]      = useState([]);
  const [subjects, setSubjects]   = useState([]);
  const [activities, setActs]     = useState([]);
  const [grades, setGrades]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [notifPerm, setNotifPerm] = useState(Notification?.permission||"default");
  const [joinCode, setJoinCode]   = useState("");
  const [joinName, setJoinName]   = useState(user.name||"");
  const [joining, setJoining]     = useState(false);
  const [joinErr, setJoinErr]     = useState("");
  const studentRef = useRef(null);
  const sessionRef = useRef(null);

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(null),2800); }

  async function askNotifPermission(){
    const r=await requestNotifPermission(); setNotifPerm(r);
    if(r==="granted") showToast("🔔 Notificaciones activadas");
    else if(r==="denied") showToast("🔕 Bloqueadas en el navegador");
  }

  useEffect(()=>{ loadStudentData(); },[]);

  async function loadStudentData(){
    setLoading(true);
    const { data:stu } = await sb.from("students").select("*, session:sessions(id,name,date,owner:users(name))").eq("user_id",user.id).maybeSingle();
    if(!stu){ setLoading(false); return; }
    setStudent(stu); setSession(stu.session);
    studentRef.current=stu; sessionRef.current=stu.session;
    await loadSessionData(stu.session.id,stu.id);
    setLoading(false);
  }

  async function loadSessionData(sid,stid){
    const [{ data:taskData },{ data:subData },{ data:attData },{ data:subjData }] = await Promise.all([
      sb.from("tasks").select("*").eq("session_id",sid).order("created_at",{ascending:false}),
      sb.from("task_submissions").select("*").eq("student_id",stid),
      sb.from("attendance").select("date,status,reason").eq("session_id",sid).eq("student_id",stid).order("date",{ascending:false}),
      sb.from("subjects").select("*").eq("session_id",sid),
    ]);
    setTasks(taskData||[]); setSubs(subData||[]); setAtt(attData||[]);
    const subjIds=(subjData||[]).map(s=>s.id);
    if(subjIds.length>0){
      const [{ data:actData },{ data:gradeData }] = await Promise.all([
        sb.from("activities").select("*").in("subject_id",subjIds),
        sb.from("grades").select("*").in("subject_id",subjIds).eq("student_id",stid),
      ]);
      setSubjects(subjData||[]); setActs(actData||[]); setGrades(gradeData||[]);
    } else { setSubjects([]); }
  }

  useEffect(()=>{
    if(!session) return;
    const ch = sb.channel(`tasks-${session.id}`)
      .on("postgres_changes",{ event:"INSERT",schema:"public",table:"tasks",filter:`session_id=eq.${session.id}` },(payload)=>{
        const t=payload.new;
        setTasks(prev=>prev.find(x=>x.id===t.id)?prev:[t,...prev]);
        showToast("📋 Nueva tarea: "+t.title);
        sendNotif("📋 Nueva tarea",`${t.title}${t.due_date?" · "+fmtDate(t.due_date):""}`);
      }).subscribe();
    return ()=>{ sb.removeChannel(ch); };
  },[session?.id]);

  async function joinWithCode(){
    setJoinErr(""); setJoining(true);
    const code=joinCode.trim().toUpperCase(), name=joinName.trim();
    if(!code){ setJoinErr("Ingresa el código"); setJoining(false); return; }
    if(!name){ setJoinErr("Ingresa tu nombre"); setJoining(false); return; }
    const { data:sess } = await sb.from("sessions").select("id,name,owner:users(name)").eq("join_code",code).maybeSingle();
    if(!sess){ setJoinErr("Código incorrecto o expirado"); setJoining(false); return; }
    const { data:ex } = await sb.from("students").select("id").eq("user_id",user.id).maybeSingle();
    if(ex){ setJoinErr("Ya estás unido a una sesión"); setJoining(false); return; }
    const { data:newStu,error } = await sb.from("students").insert({ session_id:sess.id,name,user_id:user.id }).select("*, session:sessions(id,name,date,owner:users(name))").single();
    if(error){ setJoinErr("Error: "+error.message); setJoining(false); return; }
    setStudent(newStu); setSession(newStu.session);
    studentRef.current=newStu; sessionRef.current=newStu.session;
    await loadSessionData(newStu.session.id,newStu.id);
    showToast("✅ ¡Te uniste a "+sess.name+"!"); setJoining(false);
  }

  const attCounts = attendance.reduce((acc,a)=>{ acc[a.status]=(acc[a.status]||0)+1; return acc; },{});
  const attPct = attendance.length>0 ? Math.round(((attCounts.present||0)+(attCounts.late||0)+(attCounts.excused||0))/attendance.length*100) : null;

  const TABS = [
    { id:"tasks",      label:"Tareas",         icon:"📋" },
    { id:"attendance", label:"Asistencia",     icon:"📅" },
    { id:"grades",     label:"Calificaciones", icon:"📊" },
  ];

  if(loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <GlobalStyles/>
      <span style={{color:C.muted,fontFamily:"Inter,sans-serif",fontSize:14}}>Cargando...</span>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",width:"100%",background:C.bg,fontFamily:"'Inter',sans-serif",color:C.text,boxSizing:"border-box"}}>
      <GlobalStyles/>
      {toast&&<Toast msg={toast}/>}

      {/* Header */}
      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${C.accent}33,${C.purple}33)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:C.accent,flexShrink:0}}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
            <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session?session.name:"Sin grupo"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          {"Notification" in window&&(
            <button onClick={askNotifPermission} className="btn" style={{background:notifPerm==="granted"?`${C.success}22`:`${C.warning}18`,color:notifPerm==="granted"?C.success:C.warning,border:`1px solid ${notifPerm==="granted"?C.success:C.warning}44`,borderRadius:8,padding:"6px 10px",fontSize:14}}>
              {notifPerm==="granted"?"🔔":"🔕"}
            </button>
          )}
          <button onClick={onLogout} className="btn" style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}>Salir</button>
        </div>
      </header>

      {/* Sin sesión */}
      {!student ? (
        <div style={{padding:"24px 16px 80px",width:"100%",boxSizing:"border-box",maxWidth:440,margin:"0 auto"}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"24px 20px"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:44,marginBottom:10}}>🔑</div>
              <div style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:700,color:C.text}}>Unirse a una sesión</div>
              <div style={{fontSize:13,color:C.muted,marginTop:6}}>Ingresa el código que te dio tu docente</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={{fontSize:11,color:C.muted,marginBottom:5,letterSpacing:.5}}>TU NOMBRE</div>
                <input className="inp" placeholder="Nombre completo" value={joinName} onChange={e=>setJoinName(e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:11,color:C.muted,marginBottom:5,letterSpacing:.5}}>CÓDIGO DE SESIÓN</div>
                <input className="inp" placeholder="AB12CD" value={joinCode}
                  onChange={e=>setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={e=>e.key==="Enter"&&joinWithCode()} maxLength={6}
                  style={{textAlign:"center",fontFamily:"'Sora',monospace",fontSize:"clamp(18px,7vw,26px)",fontWeight:800,letterSpacing:"clamp(3px,2vw,7px)"}}/>
              </div>
              {joinErr&&<div style={{background:`${C.danger}18`,border:`1px solid ${C.danger}44`,borderRadius:8,padding:"10px 14px",color:C.danger,fontSize:13,textAlign:"center"}}>{joinErr}</div>}
              <button className="btn" onClick={joinWithCode} disabled={joining} style={{background:`linear-gradient(135deg,${C.accent},#005a44)`,color:"#fff",borderRadius:10,padding:"13px 0",fontSize:15,fontWeight:700,fontFamily:"inherit",border:"none",opacity:joining?.7:1}}>
                {joining?"Uniéndose...":"Unirse →"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <main style={{padding:"12px 12px 80px",width:"100%",boxSizing:"border-box",maxWidth:680,margin:"0 auto"}}>

          {/* Banner notificaciones */}
          {notifPerm!=="granted"&&notifPerm!=="denied"&&"Notification" in window&&(
            <div style={{background:`${C.warning}14`,border:`1px solid ${C.warning}44`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <span style={{fontSize:12,color:C.warning,flex:1}}>🔔 Activa notificaciones para nuevas tareas</span>
              <button className="btn" onClick={askNotifPermission} style={{background:`${C.warning}22`,color:C.warning,border:`1px solid ${C.warning}44`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap"}}>Activar</button>
            </div>
          )}

          {/* Info grupo */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:24,flexShrink:0}}>🏫</span>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.name}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:1}}>👤 {session.owner?.name}</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:14}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className="btn" style={{
                flex:1,padding:"10px 4px",background:"none",
                color:tab===t.id?C.text:C.muted,
                borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
                fontSize:12,fontFamily:"inherit",fontWeight:tab===t.id?600:400,
                border:"none",borderBottomWidth:2,borderBottomStyle:"solid",
                cursor:"pointer",transition:"all .2s",
              }}>
                <div style={{fontSize:16}}>{t.icon}</div>
                <div style={{fontSize:11,marginTop:2}}>{t.label}</div>
              </button>
            ))}
          </div>

          {/* TAREAS */}
          {tab==="tasks"&&<TasksBySubject tasks={tasks} subs={subs} subjects={subjects}/>}

          {/* ASISTENCIA */}
          {tab==="attendance"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
                {[
                  {label:"Presentes",val:attCounts.present||0,color:C.success,icon:"✅"},
                  {label:"Retardos", val:attCounts.late||0,   color:C.late,   icon:"🕐"},
                  {label:"Justif.",  val:attCounts.excused||0,color:C.excused,icon:"📝"},
                  {label:"Ausencias",val:attCounts.absent||0, color:C.danger, icon:"❌"},
                ].map(s=>(
                  <div key={s.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
                    <div style={{fontSize:20}}>{s.icon}</div>
                    <div style={{fontSize:22,fontWeight:800,color:s.color,marginTop:3}}>{s.val}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {attPct!==null&&(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:13,color:C.muted}}>Asistencia general</span>
                  <span style={{fontSize:20,fontWeight:800,color:attPct>=80?C.success:attPct>=60?C.warning:C.danger}}>{attPct}%</span>
                </div>
              )}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                {attendance.length===0
                  ? <Empty icon="📅" msg="Sin registros de asistencia"/>
                  : attendance.map((a,i)=><AttRow key={i} date={a.date} status={a.status} reason={a.reason}/>)
                }
              </div>
            </div>
          )}

          {/* CALIFICACIONES */}
          {tab==="grades"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {subjects.length===0
                ? <Empty icon="📊" msg="No hay materias registradas aún"/>
                : subjects.map(subj=>(
                    <GradeCard key={subj.id} subject={subj}
                      activities={activities.filter(a=>a.subject_id===subj.id)}
                      grades={grades.filter(g=>g.subject_id===subj.id)}/>
                  ))
              }
            </div>
          )}

        </main>
      )}
    </div>
  );
}
