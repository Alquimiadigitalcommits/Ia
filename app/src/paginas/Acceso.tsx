import { useState } from "react";
import { supabase } from "../lib/supabase";

export function Acceso() {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enlace = async () => {
    setEnviando(true);
    setEstado(null);
    const { error } = await supabase!.auth.signInWithOtp({ email: correo, options: { emailRedirectTo: window.location.origin } });
    setEnviando(false);
    setEstado(error ? { tipo: "error", texto: error.message } : { tipo: "ok", texto: `Te enviamos un enlace a ${correo}. Ábrelo en este dispositivo para entrar.` });
  };
  const google = async () => {
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) setEstado({ tipo: "error", texto: error.message });
  };

  return (
    <main className="pantalla-acceso">
      <div className="caja-acceso">
        <div className="marca grande">mi día</div>
        <p className="sub">Tu vida personal, salud, trabajo y finanzas en un solo lugar. Tus datos son privados por defecto.</p>
        <form className="formulario" onSubmit={(e) => { e.preventDefault(); void enlace(); }}>
          <label>Correo<input type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required /></label>
          <button className="boton" disabled={enviando}>{enviando ? "Enviando…" : "Recibir enlace para entrar"}</button>
        </form>
        {import.meta.env.VITE_GOOGLE_HABILITADO === "1" && (
          <>
            <div className="separador-texto"><span>o</span></div>
            <button className="boton secundario ancho" onClick={google}>Entrar con Google</button>
          </>
        )}
        {estado && <p className={estado.tipo === "ok" ? "aviso-ok" : "error"} role="status">{estado.texto}</p>}
      </div>
    </main>
  );
}

export function SinConfigurar() {
  return (
    <main className="pantalla-acceso">
      <div className="caja-acceso">
        <div className="marca grande">mi día</div>
        <h1>Falta conectar la base de datos</h1>
        <p className="sub">La app está publicada, pero todavía no tiene su base de datos (Supabase). Hay que cargar en Netlify <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>, <code>SUPABASE_URL</code> y <code>SUPABASE_DB_URL</code>, y volver a publicar.</p>
      </div>
    </main>
  );
}
