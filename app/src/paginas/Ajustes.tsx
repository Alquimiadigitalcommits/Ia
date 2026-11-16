import { useState } from "react";
import { AREAS, NOMBRE_AREA, type Area } from "../../../shared/modulos";
import { Cargando, ErrorCaja, Interruptor, Vacio } from "../componentes/Basicos";
import { Encabezado } from "../componentes/Estructura";
import { Icono } from "../componentes/Icono";
import { api, descargar } from "../lib/api";
import { fechaHora, hoyISO } from "../lib/fechas";
import { useCarga, useSesion, type Acceso } from "../lib/sesion";
import { MODO_LOCAL } from "../lib/supabase";

const NOMBRE_ENTIDAD: Record<string, string> = { tareas: "Tarea", eventos: "Evento", bienestar: "Bienestar" };
const NOMBRE_OP: Record<string, string> = { crear: "creó", editar: "editó", eliminar: "envió a la papelera", restaurar: "restauró" };
const NOMBRE_CANAL: Record<string, string> = { web: "app", whatsapp: "WhatsApp", ia: "asistente" };

export function Ajustes() {
  const { yo, salir } = useSesion();
  if (!yo) return null;
  return (
    <>
      <Encabezado titulo="Ajustes" subtitulo={yo.usuario.email ?? (MODO_LOCAL ? "Modo local de desarrollo" : undefined)} acciones={!MODO_LOCAL && <button className="boton secundario" onClick={salir}><Icono nombre="salir" tamano={16} />Cerrar sesión</button>} />
      <Perfil />
      <Permisos />
      <Datos />
      <Papelera />
      <Actividad />
    </>
  );
}

function Perfil() {
  const { yo, guardarPerfil } = useSesion();
  const [nombre, setNombre] = useState(yo!.perfil.nombre);
  const [zona, setZona] = useState(yo!.perfil.zona_horaria);
  const [estado, setEstado] = useState<string | null>(null);
  return (
    <section className="seccion-ajustes">
      <h2>Perfil</h2>
      <form className="formulario" onSubmit={async (e) => { e.preventDefault(); try { await guardarPerfil({ nombre, zona_horaria: zona }); setEstado("✓ Guardado"); } catch (err) { setEstado((err as Error).message); } }}>
        <div className="fila-campos">
          <label>Nombre para el saludo<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} /></label>
          <label>Zona horaria<input value={zona} onChange={(e) => setZona(e.target.value)} list="zonas" /></label>
        </div>
        <datalist id="zonas"><option value="America/Santiago" /><option value="America/Buenos_Aires" /><option value="America/Lima" /><option value="America/Bogota" /><option value="America/Mexico_City" /><option value="Europe/Madrid" /></datalist>
        <div className="botonera">{estado && <span role="status">{estado}</span>}<button className="boton">Guardar</button></div>
      </form>
    </section>
  );
}

function Permisos() {
  const { yo, guardarAccesos } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const accesos = yo!.accesos;
  const de = (canal: Acceso["canal"], area: string) => accesos.find((a) => a.canal === canal && a.area === area) ?? { canal, area, lectura: false, escritura: false };
  const cambiar = async (a: Acceso) => {
    setError(null);
    try { await guardarAccesos([a]); } catch (e) { setError((e as Error).message); }
  };
  return (
    <section className="seccion-ajustes">
      <h2>Qué puede ver y registrar cada canal</h2>
      <p className="sub">La app siempre accede a todo lo tuyo. WhatsApp y el asistente solo acceden a lo que autorices aquí. Salud viene apagada por privacidad. Estos permisos solo se cambian desde la app; la base de datos rechaza cambios desde WhatsApp o el asistente.</p>
      {error && <ErrorCaja mensaje={error} />}
      <div className="tabla-permisos" role="table" aria-label="Permisos por canal">
        <div role="row" className="fila-tabla cabecera"><span role="columnheader">Área</span><span role="columnheader">WhatsApp: ver</span><span role="columnheader">WhatsApp: registrar</span><span role="columnheader">Asistente: ver</span><span role="columnheader">Asistente: registrar</span></div>
        {AREAS.map((area) => (
          <div role="row" className="fila-tabla" key={area}>
            <span role="cell">{NOMBRE_AREA[area as Area]}{area === "salud_intima" && <small> · máxima privacidad</small>}</span>
            {(["whatsapp", "ia"] as const).flatMap((canal) => {
              const a = de(canal, area);
              return [
                <span role="cell" key={`${canal}-l`}><Interruptor activo={a.lectura} etiqueta={`${canal} puede ver ${NOMBRE_AREA[area as Area]}`} alCambiar={(v) => cambiar({ ...a, lectura: v, escritura: v ? a.escritura : false })} /></span>,
                <span role="cell" key={`${canal}-e`}><Interruptor activo={a.escritura} etiqueta={`${canal} puede registrar en ${NOMBRE_AREA[area as Area]}`} alCambiar={(v) => cambiar({ ...a, escritura: v, lectura: v || a.lectura })} /></span>,
              ];
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function Datos() {
  const [error, setError] = useState<string | null>(null);
  const exportar = async (area?: Area) => {
    setError(null);
    try { await descargar(`/exportar${area ? `?area=${area}` : ""}`, `mi-dia-${area ?? "todo"}-${hoyISO()}.json`); } catch (e) { setError((e as Error).message); }
  };
  return (
    <section className="seccion-ajustes">
      <h2>Exportar mis datos</h2>
      <p className="sub">Descarga un archivo JSON con tus registros, incluida la papelera. Sirve como respaldo o para llevarte tus datos.</p>
      {error && <ErrorCaja mensaje={error} />}
      <div className="botones-rapidos">
        <button className="chip-btn oscuro" onClick={() => exportar()}><Icono nombre="descargar" tamano={16} />Todo</button>
        {(["personal", "trabajo", "finanzas", "salud"] as Area[]).map((a) => <button key={a} className="chip-btn" onClick={() => exportar(a)}>{NOMBRE_AREA[a]}</button>)}
      </div>
    </section>
  );
}

function Papelera() {
  const { zona } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<{ entidad: string; id: string; titulo: string; eliminado_en: string }[]>(() => api("GET", "/papelera"));
  const restaurar = async (entidad: string, id: string) => { await api("POST", `/e/${entidad}/${id}/restaurar`); void recargar(); window.dispatchEvent(new Event("mi-dia:datos-cambiaron")); };
  return (
    <section className="seccion-ajustes">
      <h2>Papelera</h2>
      <p className="sub">Nada se borra definitivamente. Lo que envías a la papelera se puede restaurar.</p>
      {cargando && <Cargando />}
      {error && <ErrorCaja mensaje={error} reintentar={recargar} />}
      {datos && !datos.length && <Vacio titulo="La papelera está vacía" />}
      <ul className="filas">
        {(datos ?? []).map((p) => (
          <li key={p.id} className="fila">
            <div className="fila-texto"><b>{p.titulo}</b><small>{NOMBRE_ENTIDAD[p.entidad] ?? p.entidad} · eliminado {fechaHora(p.eliminado_en, zona)}</small></div>
            <button className="chip-btn" onClick={() => restaurar(p.entidad, p.id)}><Icono nombre="restaurar" tamano={16} />Restaurar</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Actividad() {
  const { zona } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<{ entidad: string; id: string; operacion: string; canal: string; cuando: string; titulo: string }[]>(() => api("GET", "/actividad"));
  return (
    <section className="seccion-ajustes">
      <h2>Actividad reciente</h2>
      {cargando && <Cargando />}
      {error && <ErrorCaja mensaje={error} reintentar={recargar} />}
      {datos && !datos.length && <Vacio titulo="Sin actividad todavía" />}
      <ol className="actividad">
        {(datos ?? []).map((a, i) => (
          <li key={`${a.id}-${i}`}><span>{fechaHora(a.cuando, zona)}</span> Se {NOMBRE_OP[a.operacion] ?? a.operacion} {NOMBRE_ENTIDAD[a.entidad]?.toLowerCase() ?? a.entidad} <b>{a.titulo}</b> desde {NOMBRE_CANAL[a.canal] ?? a.canal}</li>
        ))}
      </ol>
    </section>
  );
}
