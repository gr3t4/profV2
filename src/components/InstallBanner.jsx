import { useState, useEffect } from "react";
import { C } from "../lib/constants";

export default function InstallBanner() {
  const [prompt, setPrompt]     = useState(null);  // Android / Chrome
  const [show, setShow]         = useState(false);
  const [isIOS, setIsIOS]       = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Ya instalada como PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true); return;
    }
    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);
    if (ios) {
      const dismissed = sessionStorage.getItem("pwa-ios-dismissed");
      if (!dismissed) setShow(true);
      return;
    }
    // Android / Chrome: capturar evento beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      const dismissed = sessionStorage.getItem("pwa-dismissed");
      if (!dismissed) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setShow(false);
    sessionStorage.setItem(isIOS ? "pwa-ios-dismissed" : "pwa-dismissed", "1");
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setShow(false);
  }

  if (!show || installed) return null;

  return (
    <div style={{
      position:"fixed", bottom:16, left:16, right:16, zIndex:9999,
      background:C.card, border:`1px solid ${C.accent}66`,
      borderRadius:16, padding:"14px 16px",
      boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
      display:"flex", alignItems:"flex-start", gap:12,
      animation:"fadeUp .3s ease",
      maxWidth:480, margin:"0 auto",
    }}>
      <div style={{fontSize:28, flexShrink:0}}>📲</div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:700, fontSize:14, color:C.text, marginBottom:4}}>
          Instalar AppProf
        </div>
        {isIOS ? (
          <div style={{fontSize:12, color:C.muted, lineHeight:1.5}}>
            Toca <strong style={{color:C.text}}>Compartir</strong> <span style={{fontSize:14}}>⎙</span> y luego{" "}
            <strong style={{color:C.text}}>"Agregar a pantalla de inicio"</strong> para instalar la app.
          </div>
        ) : (
          <div style={{fontSize:12, color:C.muted, lineHeight:1.5}}>
            Instala la app en tu dispositivo para acceder sin navegador.
          </div>
        )}
        {!isIOS && (
          <button onClick={install} style={{
            marginTop:10, background:`linear-gradient(135deg,${C.accent},#005a44)`,
            color:"#fff", border:"none", borderRadius:8, padding:"8px 18px",
            fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer",
          }}>
            Instalar
          </button>
        )}
      </div>
      <button onClick={dismiss} style={{
        background:"none", border:"none", color:C.muted,
        fontSize:18, cursor:"pointer", padding:"0 4px", flexShrink:0, lineHeight:1,
      }}>✕</button>
    </div>
  );
}
