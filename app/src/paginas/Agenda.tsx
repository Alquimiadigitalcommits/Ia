import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NOMBRE_AREA } from "../../../shared/modulos";
import { Cargando, ErrorCaja, Modal, Vacio } from "../componentes/Basicos";
import { Encabezado } from "../componentes/Estructura";
import { Historial } from "../componentes/Historial";
import { Icono } from "../componentes/Icono";
import { api } from "../lib/api";
import { aISOConZona, diaDe, fechaLarga, hora, hoyISO, sumarDias } from "../lib/fechas";
import { useCarga, useSesion } from "../lib/sesion";

interface Evento { id: string; titulo: string; inicio: string; fin: string | null; todo_el_dia: boolean; lugar: string | null; notas: string | null; recordatorio_min: number | null; area: string }
const AREAS_EVENTO = ["personal", "trabajo", "finanzas", "salud"] as const;

export function Agenda() {
  const { zona } = useSesion();
  const [params, setParams] = useSearchParams();
  const [editar, setEditar] = useState<Evento | "nuevo" | null>(params.get("nuevo") ? "nuevo" : null);
  const [historial, setHistorial] = useState<string | null>(null);
  const [verPasados, setVerPasados] = useState(false);
  const hoy = hoyISO(zona);
  const desde = verPasados ? sumarDias(hoy, -60) : hoy;
  const { datos, error, cargando, recargar } = useCarga<Evento[]>(
    () => api("GET", `/e/eventos?desde=${encodeURIComponent(aISOConZona(desde, "00:00", zona))}&hasta=${encodeURIComponent(aISOConZona(sumarDias(hoy, 90), "23:59", zona))}&limite=300`),
    [desde],
  );
  useEffect(() => { if (params.get("nuevo")) setParams({}, { replace: true }); }, [params, setParams]);

  const porDia = new Map<string, Evento[]>();
  for (const e of datos ?? []) {
    const d = diaDe(e.inicio, zona);
    porDia.set(d, [...(porDia.get(d) ?? []), e]);
  }
  const eliminar = async (e: Evento) => { await api("DELETE", `/e/eventos/${e.id}`); void recargar(); };

  return (
    <>
      <Encabezado
        titulo="Agenda"
        subtitulo="Próximos 90 días. Vistas de mes y semana, repeticiones y bloques de tiempo llegan en la fase 4."
        acciones={<button className="boton" onClick={() => setEditar("nuevo")}><Icono nombre="mas" tamano={16} />Nuevo</button>}
      />
      <label className="casilla"><input type="checkbox" checked={verPasados} onChange={(e) => setVerPasados(e.target.checked)} />Mostrar los últimos 60 días</label>
      {cargando && !datos && <Cargando />}
      {error && <ErrorCaja mensaje={error} reintentar={recargar} />}
      {datos && !datos.length && <Vacio titulo="Agenda libre" texto="No hay eventos en este período." accion={<button className="boton" onClick={() => setEditar("nuevo")}>Agregar evento</button>} />}
      {[...porDia.entries()].map(([dia, eventos]) => (
        <section key={dia} className="dia-agenda">
          <h2 className={dia === hoy ? "es-hoy" : ""}>{dia === hoy ? "Hoy · " : ""}{fechaLarga(dia)}</h2>
          <ul className="filas">
            {eventos.map((e) => (
              <li key={e.id} className={`fila${dia < hoy ? " hecha" : ""}`}>
                <time className="hora-chip">{e.todo_el_dia ? "Todo el día" : hora(e.inicio, zona)}</time>
                <button className="fila-texto" onClick={() => setEditar(e)}>
                  <b>{e.titulo}</b>
                  <small>{[e.lugar, e.fin && !e.todo_el_dia ? `hasta ${hora(e.fin, zona)}` : null, NOMBRE_AREA[e.area as keyof typeof NOMBRE_AREA]].filter(Boolean).join(" · ")}</small>
                </button>
                <button className="icono-btn" onClick={() => setHistorial(e.id)} aria-label={`Historial de ${e.titulo}`}><Icono nombre="reloj" tamano={18} /></button>
                <button className="icono-btn" onClick={() => eliminar(e)} aria-label={`Enviar a la papelera: ${e.titulo}`}><Icono nombre="basura" tamano={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Modal titulo={editar === "nuevo" ? "Nuevo evento" : "Editar evento"} abierto={editar !== null} alCerrar={() => setEditar(null)}>
        {editar !== null && <FormEvento evento={editar === "nuevo" ? null : editar} zona={zona} alGuardar={() => { setEditar(null); void recargar(); }} />}
      </Modal>
      <Historial entidad="eventos" id={historial} alCerrar={() => setHistorial(null)} />
    </>
  );
}

function FormEvento({ evento, zona, alGuardar }: { evento: Evento | null; zona: string; alGuardar: () => void }) {
  const [d, setD] = useState({
    titulo: evento?.titulo ?? "",
    fecha: evento ? diaDe(evento.inicio, zona) : hoyISO(zona),
    horaInicio: evento && !evento.todo_el_dia ? hora(evento.inicio, zona) : "09:00",
    horaFin: evento?.fin ? hora(evento.fin, zona) : "",
    todoElDia: evento?.todo_el_dia ?? false,
    lugar: evento?.lugar ?? "",
    notas: evento?.notas ?? "",
    area: evento?.area ?? "personal",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enviar = async () => {
    setError(null);
    if (d.horaFin && !d.todoElDia && d.horaFin < d.horaInicio) return setError("La hora de término no puede ser antes del inicio.");
    setGuardando(true);
    const cuerpo = {
      titulo: d.titulo,
      inicio: aISOConZona(d.fecha, d.todoElDia ? "00:00" : d.horaInicio, zona),
      fin: d.horaFin && !d.todoElDia ? aISOConZona(d.fecha, d.horaFin, zona) : null,
      todo_el_dia: d.todoElDia,
      lugar: d.lugar || null,
      notas: d.notas || null,
      area: d.area,
    };
    try {
      await (evento ? api("PATCH", `/e/eventos/${evento.id}`, cuerpo) : api("POST", "/e/eventos", cuerpo));
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
      <label>Fecha<input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} required /></label>
      <label className="casilla"><input type="checkbox" checked={d.todoElDia} onChange={(e) => setD({ ...d, todoElDia: e.target.checked })} />Todo el día</label>
      {!d.todoElDia && (
        <div className="fila-campos">
          <label>Empieza<input type="time" value={d.horaInicio} onChange={(e) => setD({ ...d, horaInicio: e.target.value })} required /></label>
          <label>Termina (opcional)<input type="time" value={d.horaFin} onChange={(e) => setD({ ...d, horaFin: e.target.value })} /></label>
        </div>
      )}
      <div className="fila-campos">
        <label>Lugar<input value={d.lugar} onChange={(e) => setD({ ...d, lugar: e.target.value })} maxLength={300} /></label>
        <label>Área<select value={d.area} onChange={(e) => setD({ ...d, area: e.target.value })}>{AREAS_EVENTO.map((a) => <option key={a} value={a}>{NOMBRE_AREA[a]}</option>)}</select></label>
      </div>
      <label>Notas<textarea value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} rows={3} maxLength={5000} /></label>
      <div className="botonera"><button className="boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button></div>
    </form>
  );
}
