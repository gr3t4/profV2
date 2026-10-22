import { useState } from "react";
import { C } from "../lib/constants";
import { AVISO_VERSION, RESPONSABLE, CONTACTO, DOMICILIO } from "../lib/privacidad";

const H = ({ children }) => <div style={{fontWeight:700,fontSize:14,color:C.teal,margin:"16px 0 6px"}}>{children}</div>;
const P = ({ children }) => <p style={{fontSize:13,lineHeight:1.55,color:C.text,margin:"0 0 8px"}}>{children}</p>;
const L = ({ items }) => <ul style={{fontSize:13,lineHeight:1.55,color:C.text,margin:"0 0 8px",paddingLeft:20}}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;

function fechaLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day:"numeric", month:"long", year:"numeric" });
}

export function TextoAviso() {
  const contacto = CONTACTO || "el correo que la institución o el docente te indique";
  return (
    <div>
      <P><b>Aviso de privacidad integral de AppProf</b> · Última actualización: {fechaLarga(AVISO_VERSION)}</P>

      <H>1. ¿Quién es responsable de tus datos?</H>
      <P>{RESPONSABLE}{DOMICILIO ? `, con domicilio en ${DOMICILIO}` : ""}, es responsable del tratamiento de los datos personales que se registran en AppProf, en coordinación con la institución educativa donde se usa la aplicación, la cual decide qué alumnos y grupos se registran.</P>

      <H>2. ¿Qué datos se recaban?</H>
      <L items={[
        "Docentes, prefectura y administradores: nombre, nombre de usuario y contraseña (guardada cifrada; nadie puede leerla).",
        "Alumnos: nombre, grupo, asistencia (asistencia, retardo, falta o falta justificada), el motivo de las faltas justificadas, entregas de actividades y calificaciones.",
        "Madres, padres o tutores: nombre y número de teléfono, solo cuando el docente los registra para compartir el enlace de consulta.",
      ]}/>
      <P>AppProf <b>no</b> pide datos sensibles. Para el motivo de una falta justificada basta con algo general (por ejemplo «cita médica» o «asunto familiar»); no se deben escribir diagnósticos, enfermedades ni información íntima.</P>

      <H>3. ¿Para qué se usan?</H>
      <P>Finalidades necesarias:</P>
      <L items={[
        "Registrar y consultar la asistencia de los alumnos en cada clase.",
        "Llevar el control de actividades entregadas y calcular calificaciones.",
        "Generar reportes para docentes, prefectura y dirección, y avisar cuando un alumno está en riesgo de reprobar.",
        "Permitir que madres, padres o tutores consulten la asistencia de su hijo o hija mediante un enlace personal.",
        "Dar acceso seguro a cada usuario según su función.",
      ]}/>
      <P>Los datos no se usan para publicidad, no se venden y no se usan para fines distintos a los anteriores.</P>

      <H>4. Datos de menores de edad</H>
      <P>La mayoría de los alumnos son menores de edad. Sus datos los registra el personal docente como parte de las actividades escolares, y la institución es quien cuenta con la autorización de madres, padres o tutores para el tratamiento de los datos escolares. Solo se registran los datos mínimos necesarios para el control escolar.</P>

      <H>5. ¿Con quién se comparten?</H>
      <P>Solo pueden ver los datos el docente de cada clase, la prefectura y la administración escolar, y el tutor a quien el docente le comparta su enlace. Para funcionar, la aplicación usa proveedores que almacenan la información por cuenta del responsable, sin usarla para fines propios: <b>Supabase</b> (base de datos y cuentas de usuario) y <b>Vercel</b> (publicación de la aplicación). Sus servidores pueden encontrarse fuera de México. No se hacen otras transferencias, salvo las que exija una autoridad competente conforme a la ley.</P>

      <H>6. ¿Cómo se protegen?</H>
      <L items={[
        "Conexión cifrada (HTTPS) en todo momento.",
        "Acceso con usuario y contraseña, y permisos por función: cada docente solo ve sus clases.",
        "Contraseñas cifradas y reglas de seguridad en la base de datos.",
        "El enlace para tutores es personal, solo permite consultar y no permite modificar nada.",
      ]}/>

      <H>7. ¿Cuánto tiempo se guardan?</H>
      <P>Durante el ciclo escolar y el tiempo que la institución necesite para sus procesos de control escolar. Después pueden eliminarse a petición de la institución o del titular.</P>

      <H>8. Tus derechos (ARCO) y cómo revocar tu consentimiento</H>
      <P>Tienes derecho a <b>A</b>cceder a tus datos, <b>R</b>ectificarlos si están mal, <b>C</b>ancelarlos y <b>O</b>ponerte a su uso, así como a revocar tu consentimiento. Si se trata de los datos de un menor, los ejerce su madre, padre o tutor. Envía tu solicitud a {contacto} indicando tu nombre, el alumno o usuario de que se trate, lo que solicitas y un medio para responderte. Recibirás respuesta en los plazos que marca la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Los docentes pueden corregir su nombre y contraseña desde «Mi cuenta».</P>

      <H>9. Cambios a este aviso</H>
      <P>Cualquier cambio se publicará en la aplicación y, si es importante, se pedirá de nuevo tu aceptación al entrar.</P>
    </div>
  );
}

// Ventana con el aviso. Con onAccept muestra la casilla para aceptarlo (al entrar por primera vez).
export default function AvisoPrivacidad({ onClose, onAccept, onLogout }) {
  const [check, setCheck] = useState(false);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  async function accept() {
    setBusy(true); setError("");
    const err = await onAccept();
    setBusy(false);
    if (err) setError(err);
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:14}}>
      <div style={{background:C.card,color:C.text,fontFamily:"Inter,sans-serif",border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:620,maxHeight:"94vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",animation:"fadeUp .2s ease"}}>
        <div style={{padding:"18px 20px 10px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:24}}>🔒</span>
          <div style={{flex:1,fontWeight:800,fontSize:17}}>Aviso de privacidad</div>
          {onClose && <button className="btn" onClick={onClose} style={{background:"none",color:C.muted,fontSize:22,padding:"2px 8px"}}>×</button>}
        </div>
        <div style={{padding:"6px 20px 10px",overflowY:"auto",flex:1}}>
          {onAccept && <P><span style={{color:C.gold}}>Antes de continuar, lee cómo se cuidan los datos de los alumnos y de los usuarios.</span></P>}
          <TextoAviso/>
        </div>
        {onAccept && (
          <div style={{padding:"12px 20px 18px",borderTop:`1px solid ${C.border}`}}>
            <label style={{display:"flex",gap:10,alignItems:"flex-start",fontSize:13,cursor:"pointer",marginBottom:12}}>
              <input type="checkbox" checked={check} onChange={e => setCheck(e.target.checked)} style={{marginTop:2,width:20,height:20,flexShrink:0,appearance:"auto",WebkitAppearance:"checkbox",accentColor:C.accent,opacity:1,position:"static"}}/>
              <span>He leído el aviso de privacidad y me comprometo a usar los datos de los alumnos solo para fines escolares.</span>
            </label>
            {error && <div style={{color:C.danger,fontSize:12,marginBottom:8}}>{error}</div>}
            <div style={{display:"flex",gap:10}}>
              <button className="btn" onClick={accept} disabled={!check || busy}
                style={{flex:1,background:check?`linear-gradient(135deg,${C.accent},${C.teal})`:C.border,color:"#fff",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:700,fontFamily:"inherit",opacity:check?1:.6}}>
                {busy ? "Guardando…" : "Aceptar y continuar"}
              </button>
              {onLogout && <button className="btn" onClick={onLogout}
                style={{background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",fontSize:14,fontFamily:"inherit"}}>Salir</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
