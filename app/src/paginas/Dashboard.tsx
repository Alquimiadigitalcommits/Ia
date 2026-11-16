import { useEffect, useState } from "react";
import { disponible, moduloPorId, mover, WIDGETS, widgetsVisibles, type ConfigWidget } from "../../../shared/modulos";
import { Cargando, ErrorCaja } from "../componentes/Basicos";
import { Encabezado } from "../componentes/Estructura";
import { Icono } from "../componentes/Icono";
import { api } from "../lib/api";
import { fechaLarga, saludo } from "../lib/fechas";
import { useCarga, useSesion } from "../lib/sesion";
import { COMPONENTES_WIDGET, type DatosDashboard } from "../widgets/Widgets";

export function Dashboard() {
  const { yo, zona, guardarWidgets } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<DatosDashboard>(() => api("GET", "/dashboard"));
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<ConfigWidget[]>([]);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  useEffect(() => {
    const f = () => void recargar();
    window.addEventListener("mi-dia:datos-cambiaron", f);
    return () => window.removeEventListener("mi-dia:datos-cambiaron", f);
  }, [recargar]);

  if (!yo) return null;
  const configActual = editando ? borrador : yo.widgets;
  const visibles = widgetsVisibles(configActual, yo.modulos).filter((w) => COMPONENTES_WIDGET[w.widget]);
  const nombre = yo.perfil.nombre ? `, ${yo.perfil.nombre}` : "";

  const empezar = () => { setBorrador(yo.widgets.map((w, i) => ({ ...w, orden: i }))); setEditando(true); setErrorGuardar(null); };
  const guardar = async () => {
    try { await guardarWidgets(borrador); setEditando(false); } catch (e) { setErrorGuardar((e as Error).message); }
  };
  const cambiar = (id: string, cambio: Partial<ConfigWidget>) => setBorrador((b) => b.map((w) => (w.widget === id ? { ...w, ...cambio } : w)));
  const moverW = (id: string, dir: -1 | 1) => setBorrador((b) => mover(b, [...b].sort((x, y) => x.orden - y.orden).findIndex((w) => w.widget === id), dir));

  return (
    <>
      <Encabezado
        titulo={`${saludo()}${nombre}`}
        subtitulo={datos ? fechaLarga(datos.hoy) : undefined}
        acciones={
          editando ? (
            <><button className="boton secundario" onClick={() => setEditando(false)}>Cancelar</button><button className="boton" onClick={guardar}>Guardar</button></>
          ) : (
            <button className="boton secundario" onClick={empezar}><Icono nombre="lapiz" tamano={16} />Personalizar</button>
          )
        }
      />
      {errorGuardar && <ErrorCaja mensaje={errorGuardar} />}
      {cargando && !datos && <Cargando texto="Preparando tu día…" />}
      {error && <ErrorCaja mensaje={error} reintentar={recargar} />}

      {datos && (
        <div className={`widgets${editando ? " editando" : ""}`}>
          {visibles.map((w, i) => {
            const C = COMPONENTES_WIDGET[w.widget];
            return (
              <div key={w.widget} className={`widget tam-${w.tamano}`}>
                {editando && (
                  <div className="widget-controles" aria-label={`Opciones de ${WIDGETS.find((x) => x.id === w.widget)?.nombre}`}>
                    <button className="icono-btn" onClick={() => moverW(w.widget, -1)} disabled={i === 0} aria-label="Subir"><Icono nombre="arriba" tamano={18} /></button>
                    <button className="icono-btn" onClick={() => moverW(w.widget, 1)} disabled={i === visibles.length - 1} aria-label="Bajar"><Icono nombre="abajo" tamano={18} /></button>
                    <select value={w.tamano} onChange={(e) => cambiar(w.widget, { tamano: e.target.value as ConfigWidget["tamano"] })} aria-label="Tamaño">
                      <option value="chico">Chico</option><option value="mediano">Mediano</option><option value="grande">Grande</option>
                    </select>
                    <button className="icono-btn" onClick={() => cambiar(w.widget, { visible: false })} aria-label="Ocultar"><Icono nombre="ojoCerrado" tamano={18} /></button>
                  </div>
                )}
                <C d={datos} zona={zona} alCambiar={recargar} />
              </div>
            );
          })}
        </div>
      )}

      {editando && <PanelOcultos borrador={borrador} alMostrar={(id) => cambiar(id, { visible: true })} />}
    </>
  );
}

function PanelOcultos({ borrador, alMostrar }: { borrador: ConfigWidget[]; alMostrar: (id: string) => void }) {
  const { yo } = useSesion();
  const activos = new Set(yo!.modulos.filter((m) => m.activo).map((m) => m.modulo));
  return (
    <section className="panel-ocultos" aria-label="Widgets ocultos o no disponibles">
      <h2>Agregar al dashboard</h2>
      <ul>
        {WIDGETS.map((def) => {
          const conf = borrador.find((b) => b.widget === def.id);
          const mod = def.modulo ? moduloPorId(def.modulo) : null;
          const enVista = conf?.visible && (!mod || (activos.has(mod.id) && disponible(mod)));
          if (enVista) return null;
          const motivo = mod && !disponible(mod) ? `Disponible en la fase ${mod.fase}` : mod && !activos.has(mod.id) ? `Activa el módulo ${mod.nombre}` : null;
          return (
            <li key={def.id}>
              <span>{def.nombre}</span>
              {motivo ? <small>{motivo}</small> : <button className="chip-btn" onClick={() => alMostrar(def.id)}><Icono nombre="ojo" tamano={16} />Mostrar</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
