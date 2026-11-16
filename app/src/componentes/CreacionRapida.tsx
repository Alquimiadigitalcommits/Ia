import { useState } from "react";
import { api } from "../lib/api";
import { aISOConZona, hoyISO } from "../lib/fechas";
import { useSesion } from "../lib/sesion";
import { CARITAS, Escala, Modal } from "./Basicos";
import { Icono } from "./Icono";

type Vista = "menu" | "tarea" | "evento" | "humor";

/** Registro rápido: lo más usado en uno o dos toques. */
export function CreacionRapida({ abierta, alCerrar, alIr }: { abierta: boolean; alCerrar: () => void; alIr: (ruta: string) => void }) {
  const { zona } = useSesion();
  const [vista, setVista] = useState<Vista>("menu");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => { setVista("menu"); setAviso(null); setError(null); alCerrar(); };
  const ejecutar = async (fn: () => Promise<unknown>, mensaje: string) => {
    setGuardando(true);
    setError(null);
    try {
      await fn();
      setAviso(mensaje);
      setVista("menu");
      window.dispatchEvent(new Event("mi-dia:datos-cambiaron"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={vista === "menu" ? "Registro rápido" : vista === "tarea" ? "Nueva tarea" : vista === "evento" ? "Nuevo evento" : "¿Cómo te sientes?"} abierto={abierta} alCerrar={cerrar}>
      {aviso && <p className="aviso-ok" role="status">✓ {aviso}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {vista === "menu" && (
        <div className="rejilla-rapida">
          <button disabled={guardando} onClick={() => ejecutar(() => api("POST", "/bienestar/hoy", { agua_vasos: 1 }), "+1 vaso de agua")}><Icono nombre="gota" />+1 vaso de agua</button>
          <button onClick={() => setVista("humor")}><Icono nombre="corazon" />Ánimo y energía</button>
          <button onClick={() => setVista("tarea")}><Icono nombre="check" />Tarea</button>
          <button onClick={() => setVista("evento")}><Icono nombre="calendario" />Evento</button>
          <button onClick={() => alIr("/bienestar")}><Icono nombre="reloj" />Sueño y notas</button>
          <button onClick={() => alIr("/modulos")}><Icono nombre="menu" />Más módulos</button>
        </div>
      )}

      {vista === "tarea" && <FormTarea guardando={guardando} alGuardar={(d) => ejecutar(() => api("POST", "/e/tareas", d), `Tarea creada: ${d.titulo}`)} alVolver={() => setVista("menu")} />}
      {vista === "evento" && <FormEventoRapido zona={zona} guardando={guardando} alGuardar={(d) => ejecutar(() => api("POST", "/e/eventos", d), `Evento creado: ${d.titulo}`)} alVolver={() => setVista("menu")} />}
      {vista === "humor" && <FormHumor guardando={guardando} alGuardar={(d) => ejecutar(() => api("POST", "/bienestar/hoy", d), "Ánimo registrado")} alVolver={() => setVista("menu")} />}
    </Modal>
  );
}

function FormTarea({ alGuardar, alVolver, guardando }: { alGuardar: (d: any) => void; alVolver: () => void; guardando: boolean }) {
  const [titulo, setTitulo] = useState("");
  const [vence, setVence] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  return (
    <form className="formulario" onSubmit={(e) => { e.preventDefault(); alGuardar({ titulo, prioridad, vence: vence || null }); }}>
      <label>Qué hay que hacer<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={300} autoFocus /></label>
      <div className="fila-campos">
        <label>Vence<input type="date" value={vence} onChange={(e) => setVence(e.target.value)} /></label>
        <label>Prioridad<select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></label>
      </div>
      <div className="botonera"><button type="button" className="boton secundario" onClick={alVolver}>Volver</button><button className="boton" disabled={guardando}>Guardar</button></div>
    </form>
  );
}

function FormEventoRapido({ zona, alGuardar, alVolver, guardando }: { zona: string; alGuardar: (d: any) => void; alVolver: () => void; guardando: boolean }) {
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(hoyISO(zona));
  const [horaIni, setHoraIni] = useState("09:00");
  return (
    <form className="formulario" onSubmit={(e) => { e.preventDefault(); alGuardar({ titulo, inicio: aISOConZona(fecha, horaIni, zona) }); }}>
      <label>Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={300} autoFocus /></label>
      <div className="fila-campos">
        <label>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required /></label>
        <label>Hora<input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} required /></label>
      </div>
      <div className="botonera"><button type="button" className="boton secundario" onClick={alVolver}>Volver</button><button className="boton" disabled={guardando}>Guardar</button></div>
    </form>
  );
}

function FormHumor({ alGuardar, alVolver, guardando }: { alGuardar: (d: any) => void; alVolver: () => void; guardando: boolean }) {
  const [humor, setHumor] = useState<number | null>(null);
  const [energia, setEnergia] = useState<number | null>(null);
  return (
    <form className="formulario" onSubmit={(e) => { e.preventDefault(); alGuardar({ humor, energia }); }}>
      <span className="etiqueta">Ánimo</span>
      <Escala valor={humor} alCambiar={setHumor} etiqueta="Ánimo" simbolos={CARITAS} />
      <span className="etiqueta">Energía</span>
      <Escala valor={energia} alCambiar={setEnergia} etiqueta="Energía" />
      <div className="botonera"><button type="button" className="boton secundario" onClick={alVolver}>Volver</button><button className="boton" disabled={guardando || (humor === null && energia === null)}>Guardar</button></div>
    </form>
  );
}
