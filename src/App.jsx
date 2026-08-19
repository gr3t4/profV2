import { C } from "./lib/constants";
import { useAuth } from "./hooks/useAuth";
import AuthScreen from "./components/AuthScreen";
import AdminPanel from "./components/AdminPanel";
import TeacherApp from "./components/TeacherApp";
import ViewerApp from "./components/ViewerApp";
import InstallBanner from "./components/InstallBanner";

export default function App() {
  const { user, loading, login, register, logout } = useAuth();

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:C.muted,fontFamily:"Inter,sans-serif",fontSize:14}}>Cargando...</span>
    </div>
  );

  if (!user) return <><AuthScreen onLogin={login} onRegister={register}/><InstallBanner/></>;
  if (user.role === "admin")  return <><AdminPanel  user={user} onLogout={logout}/><InstallBanner/></>;
  if (user.role === "viewer") return <><ViewerApp   user={user} onLogout={logout}/><InstallBanner/></>;
  return <><TeacherApp user={user} onLogout={logout}/><InstallBanner/></>;
}
