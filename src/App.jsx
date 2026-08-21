import { C } from "./lib/constants";
import { useAuth } from "./hooks/useAuth";
import AuthScreen from "./components/AuthScreen";
import AdminPanel from "./components/AdminPanel";
import TeacherApp from "./components/TeacherApp";
import ViewerApp from "./components/ViewerApp";
import InstallBanner from "./components/InstallBanner";

export default function App() {
  const { user, loading, connError, retry, login, register, logout } = useAuth();

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:C.muted,fontFamily:"Inter,sans-serif",fontSize:14}}>Cargando...</span>
    </div>
  );

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
