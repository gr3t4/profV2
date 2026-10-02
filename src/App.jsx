import { C } from "./lib/constants";
import { useAuth } from "./hooks/useAuth";
import { lazy, Suspense } from "react";
// Cada pantalla se descarga solo cuando se necesita, para que la app abra más rápido.
const AuthScreen = lazy(() => import("./components/AuthScreen"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const TeacherApp = lazy(() => import("./components/TeacherApp"));
const ViewerApp  = lazy(() => import("./components/ViewerApp"));
const ParentView = lazy(() => import("./components/ParentView"));
import InstallBanner from "./components/InstallBanner";

function Loading() {
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:C.muted,fontFamily:"Inter,sans-serif",fontSize:14}}>Cargando...</span>
    </div>
  );
}

export default function App() {
  return <Suspense fallback={<Loading/>}><Screens/></Suspense>;
}

function Screens() {
  const { user, loading, connError, retry, login, register, logout } = useAuth();

  // Link público de solo lectura para padres/tutores (?padre=<token>) — no
  // requiere sesión, así que se resuelve antes que cualquier estado de auth.
  const parentToken = new URLSearchParams(window.location.search).get("padre");
  if (parentToken) return <ParentView token={parentToken}/>;

  if (loading) return <Loading/>;

  if (!user && connError) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",gap:14,alignItems:"center",justifyContent:"center",padding:24,textAlign:"center"}}>
      <span style={{color:C.text,fontFamily:"Inter,sans-serif",fontSize:15}}>No se pudo conectar. Revisa tu internet.</span>
      <button onClick={retry} style={{background:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"11px 24px",fontSize:14,fontFamily:"Inter,sans-serif",fontWeight:600,cursor:"pointer"}}>
        Reintentar
      </button>
    </div>
  );

  if (!user) return <><AuthScreen onLogin={login} onRegister={register}/><InstallBanner/></>;
  if (user.role === "admin")  return <><AdminPanel  user={user} onLogout={logout}/><InstallBanner/></>;
  if (user.role === "viewer") return <><ViewerApp   user={user} onLogout={logout}/><InstallBanner/></>;
  return <><TeacherApp user={user} onLogout={logout}/><InstallBanner/></>;
}
