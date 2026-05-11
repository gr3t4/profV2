import { useState, useEffect } from "react";
import { C } from "./lib/constants";
import { getSession, clearSession } from "./lib/session";
import AuthScreen from "./components/AuthScreen";
import AdminPanel from "./components/AdminPanel";
import TeacherApp from "./components/TeacherApp";
import ViewerApp  from "./components/ViewerApp";
import StudentApp from "./components/StudentApp";
import InstallBanner from "./components/InstallBanner";

export default function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (s) setUser(s);
    setLoading(false);
  }, []);

  function logout() { clearSession(); setUser(null); }

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:C.muted,fontFamily:"Inter,sans-serif",fontSize:14}}>Cargando...</span>
    </div>
  );

  if (!user) return <><AuthScreen onLogin={setUser}/><InstallBanner/></>;
  if (user.role === "admin")   return <><AdminPanel  user={user} onLogout={logout}/><InstallBanner/></>;
  if (user.role === "viewer")  return <><ViewerApp   user={user} onLogout={logout}/><InstallBanner/></>;
  if (user.role === "student") return <><StudentApp  user={user} onLogout={logout}/><InstallBanner/></>;
  return <><TeacherApp user={user} onLogout={logout}/><InstallBanner/></>;
}
