import { useState } from "react";
import { Link } from "react-router-dom";
import { disponible, moduloPorId, mover, NOMBRE_AREA, type ConfigModulo } from "../../../shared/modulos";
import { ErrorCaja, Interruptor } from "../componentes/Basicos";
import { Encabezado } from "../componentes/Estructura";
import { Icono } from "../componentes/Icono";
import { useSesion } from "../lib/sesion";

export function Modulos() {
  const { yo, guardarModulos } = useSesion();
  const [error, setError] = useState<string | null>(null);
  if (!yo) return null;
  const lista = [...yo.modulos].sort((a, b) => a.orden - b.orden).map((m, i) => ({ ...m, orden: i }));

  const guardar = async (nueva: ConfigModulo[]) => {
    setError(null);
    try { await guardarModulos(nueva); } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <Encabezado titulo="Módulos" subtitulo="Activa solo lo que usas. Los opcionales vienen apagados para no sobrecargar." acciones={<Link className="boton secundario" to="/ajustes"><Icono nombre="ajustes" tamano={16} />Ajustes</Link>} />
      {error && <ErrorCaja mensaje={error} />}
      <ul className="lista-modulos">
        {lista.map((c, i) => {
          const m = moduloPorId(c.modulo);
          if (!m) return null;
          const listo = disponible(m);
          return (
            <li key={m.id} className={`modulo${c.activo ? " activo" : ""}`}>
              <span className="modulo-icono"><Icono nombre={m.icono} /></span>
              <div className="modulo-texto">
                {c.activo && listo ? <Link to={m.ruta}><b>{m.nombre}</b></Link> : <b>{m.nombre}</b>}
                <small>{m.descripcion}</small>
                <span className="etiquetas">
                  <span className="etiqueta">{NOMBRE_AREA[m.area]}</span>
                  {m.opcional && <span className="etiqueta">Opcional</span>}
                  {!listo && <span className="etiqueta pronto">En construcción · fase {m.fase}</span>}
                </span>
              </div>
              <div className="modulo-acciones">
                <button className="icono-btn" disabled={i === 0} onClick={() => guardar(mover(lista, i, -1))} aria-label={`Subir ${m.nombre}`}><Icono nombre="arriba" tamano={18} /></button>
                <button className="icono-btn" disabled={i === lista.length - 1} onClick={() => guardar(mover(lista, i, 1))} aria-label={`Bajar ${m.nombre}`}><Icono nombre="abajo" tamano={18} /></button>
                <Interruptor activo={c.activo} etiqueta={`${c.activo ? "Desactivar" : "Activar"} ${m.nombre}`} alCambiar={(v) => guardar(lista.map((x) => (x.modulo === m.id ? { ...x, activo: v } : x)))} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ModuloPendiente({ id }: { id: string }) {
  const m = moduloPorId(id);
  return (
    <>
      <Encabezado titulo={m?.nombre ?? "Módulo"} subtitulo={m?.descripcion} />
      <div className="estado vacio">
        <b>En construcción · fase {m?.fase}</b>
        <p>Este módulo se construye en la fase {m?.fase} del plan, con datos reales, historial y pruebas. No se muestra una versión de ejemplo para no confundir.</p>
        <Link className="boton secundario" to="/modulos">Volver a módulos</Link>
      </div>
    </>
  );
}
