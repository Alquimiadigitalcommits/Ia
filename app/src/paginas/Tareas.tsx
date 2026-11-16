import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NOMBRE_AREA } from "../../../shared/modulos";
import { Cargando, ErrorCaja, Modal, Vacio } from "../componentes/Basicos";
import { Encabezado } from "../componentes/Estructura";
import { Historial } from "../componentes/Historial";
import { Icono } from "../componentes/Icono";
import { api } from "../lib/api";
import { fechaCorta, hoyISO } from "../lib/fechas";
import { useCarga, useSesion } from "../lib/sesion";

interface Tarea { id: string; titulo: string; descripcion: string | null; estado: "pendiente" | "en_curso" | "hecha"; prioridad: "alta" | "media" | "baja"; vence: string | null; area: string }
type Filtro = "pendientes" | "hechas" | "todas";
const AREAS_TAREA = ["personal", "trabajo", "finanzas", "salud"] as const;

export function Tareas() {
  const { zona } = useSesion();
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [editar, setEditar] = useState<Tarea | "nueva" | null>(params.get("nueva") ? "nueva" : null);
  const [historial, setHistorial] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; deshacer?: () => void } | null>(null);
  const { datos, error, cargando, recargar } = useCarga<Tarea[]>(() => api("GET", "/e/tareas?limite=300"));

  useEffect(() => {
    if (params.get("nueva")) setParams({}, { replace: true });
  }, [params, setParams]);

  const hoy = hoyISO(zona);
  const lista = (datos ?? []).filter((t) => (filtro === "todas" ? true : filtro === "hechas" ? t.estado === "hecha" : t.estado !== "hecha"));

  const alternar = async (t: Tarea) => {
    await api("PATCH", `/e/tareas/${t.id}`, { estado: t.estado === "hecha" ? "pendiente" : "hecha" });
    void recargar();
  };
  const eliminar = async (t: Tarea) => {
    await api("DELETE", `/e/tareas/${t.id}`);
    setAviso({ texto: `"${t.titulo}" está en la papelera.`, deshacer: async () => { await api("POST", `/e/tareas/${t.id}/restaurar`); setAviso(null); void recargar(); } });
    void recargar();
  };

  return (
    <>
      <Encabezado titulo="Tareas" subtitulo={datos ? `${datos.filter((t) => t.estado !== "hecha").length} pendientes` : undefined} acciones={<button className="boton" onClick={() => setEditar("nueva")}><Icono nombre="mas" tamano={16} />Nueva</button>} />
      {aviso && (
        <div className="aviso-ok" role="status">
          {aviso.texto} {aviso.deshacer && <button className="enlace" onClick={aviso.deshacer}>Deshacer</button>}
        </div>
      )}
      <div className="pestanas" role="tablist">
        {(["pendientes", "hechas", "todas"] as Filtro[]).map((f) => (
          <button key={f} role="tab" aria-selected={filtro === f} className={filtro === f ? "activa" : ""} onClick={() => setFiltro(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {cargando && !datos && <Cargando />}
      {error && <ErrorCaja mensaje={error} reintentar={recargar} />}
      {datos && !lista.length && (
        <Vacio
          titulo={filtro === "hechas" ? "Todavía no completas tareas" : "Sin tareas pendientes"}
          texto={filtro === "pendientes" ? "Agrega lo que tienes que hacer. Puedes ponerle fecha, prioridad y área." : undefined}
          accion={filtro !== "hechas" ? <button className="boton" onClick={() => setEditar("nueva")}>Agregar tarea</button> : undefined}
        />
      )}
      <ul className="filas">
        {lista.map((t) => (
          <li key={t.id} className={`fila${t.estado === "hecha" ? " hecha" : ""}`}>
            <button className={`check${t.estado === "hecha" ? " marcado" : ""}`} onClick={() => alternar(t)} aria-label={t.estado === "hecha" ? `Reabrir: ${t.titulo}` : `Marcar como hecha: ${t.titulo}`} />
            <button className="fila-texto" onClick={() => setEditar(t)}>
              <b>{t.titulo}</b>
              <small>
                <span className={`punto-prioridad ${t.prioridad}`} aria-hidden="true" />Prioridad {t.prioridad} · {NOMBRE_AREA[t.area as keyof typeof NOMBRE_AREA]}
                {t.vence && <> · <span className={t.vence < hoy && t.estado !== "hecha" ? "vencida" : ""}>{t.vence < hoy && t.estado !== "hecha" ? "venció " : "vence "}{fechaCorta(t.vence)}</span></>}
              </small>
            </button>
            <button className="icono-btn" onClick={() => setHistorial(t.id)} aria-label={`Historial de ${t.titulo}`}><Icono nombre="reloj" tamano={18} /></button>
            <button className="icono-btn" onClick={() => eliminar(t)} aria-label={`Enviar a la papelera: ${t.titulo}`}><Icono nombre="basura" tamano={18} /></button>
          </li>
        ))}
      </ul>

      <Modal titulo={editar === "nueva" ? "Nueva tarea" : "Editar tarea"} abierto={editar !== null} alCerrar={() => setEditar(null)}>
        {editar !== null && <FormTarea tarea={editar === "nueva" ? null : editar} alGuardar={() => { setEditar(null); void recargar(); }} />}
      </Modal>
      <Historial entidad="tareas" id={historial} alCerrar={() => setHistorial(null)} />
    </>
  );
}

function FormTarea({ tarea, alGuardar }: { tarea: Tarea | null; alGuardar: () => void }) {
  const [d, setD] = useState({
    titulo: tarea?.titulo ?? "",
    descripcion: tarea?.descripcion ?? "",
    prioridad: tarea?.prioridad ?? "media",
    vence: tarea?.vence ?? "",
    area: tarea?.area ?? "personal",
    estado: tarea?.estado ?? "pendiente",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enviar = async () => {
    setGuardando(true);
    setError(null);
    const cuerpo = { ...d, descripcion: d.descripcion || null, vence: d.vence || null };
    try {
      await (tarea ? api("PATCH", `/e/tareas/${tarea.id}`, cuerpo) : api("POST", "/e/tareas", cuerpo));
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <form className="formulario" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      {error && <p className="error" role="alert">{error}</p>}
      <label>Título<input value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} required maxLength={300} autoFocus /></label>
      <label>Detalle (opcional)<textarea value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} maxLength={5000} rows={3} /></label>
      <div className="fila-campos">
        <label>Vence<input type="date" value={d.vence} onChange={(e) => setD({ ...d, vence: e.target.value })} /></label>
        <label>Prioridad<select value={d.prioridad} onChange={(e) => setD({ ...d, prioridad: e.target.value as Tarea["prioridad"] })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></label>
      </div>
      <div className="fila-campos">
        <label>Área<select value={d.area} onChange={(e) => setD({ ...d, area: e.target.value })}>{AREAS_TAREA.map((a) => <option key={a} value={a}>{NOMBRE_AREA[a]}</option>)}</select></label>
        <label>Estado<select value={d.estado} onChange={(e) => setD({ ...d, estado: e.target.value as Tarea["estado"] })}><option value="pendiente">Pendiente</option><option value="en_curso">En curso</option><option value="hecha">Hecha</option></select></label>
      </div>
      <div className="botonera"><button className="boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button></div>
    </form>
  );
}
