import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { disponible, moduloPorId } from "../../../shared/modulos";
import { useSesion } from "../lib/sesion";
import { CreacionRapida } from "./CreacionRapida";
import { Icono } from "./Icono";

export function Estructura({ children }: { children: ReactNode }) {
  const { yo } = useSesion();
  const [crear, setCrear] = useState(false);
  const navegar = useNavigate();
  const activos = (yo?.modulos ?? []).filter((m) => m.activo).map((m) => moduloPorId(m.modulo)!).filter(Boolean);

  return (
    <div className="estructura">
      <a className="saltar" href="#contenido">Saltar al contenido</a>

      {/* Escritorio: menú lateral con los módulos activos */}
      <nav className="lateral-menu" aria-label="Módulos">
        <div className="marca">mi día</div>
        <NavLink to="/" end className="item"><Icono nombre="inicio" />Inicio</NavLink>
        {activos.map((m) => (
          <NavLink key={m.id} to={m.ruta} className="item">
            <Icono nombre={m.icono} />
            {m.nombre}
            {!disponible(m) && <span className="pronto">fase {m.fase}</span>}
          </NavLink>
        ))}
        <div className="separador" />
        <NavLink to="/modulos" className="item"><Icono nombre="menu" />Módulos</NavLink>
        <NavLink to="/ajustes" className="item"><Icono nombre="ajustes" />Ajustes</NavLink>
        <button className="boton crear-escritorio" onClick={() => setCrear(true)}><Icono nombre="mas" />Crear</button>
      </nav>

      <main id="contenido" className="contenido" tabIndex={-1}>{children}</main>

      {/* Celular: navegación inferior con botón central de creación */}
      <nav className="nav-inferior" aria-label="Navegación principal">
        <NavLink to="/" end><Icono nombre="inicio" /><span>Inicio</span></NavLink>
        <NavLink to="/agenda"><Icono nombre="calendario" /><span>Agenda</span></NavLink>
        <button className="fab" onClick={() => setCrear(true)} aria-label="Crear registro rápido"><Icono nombre="mas" tamano={26} /></button>
        <NavLink to="/tareas"><Icono nombre="check" /><span>Tareas</span></NavLink>
        <NavLink to="/modulos"><Icono nombre="menu" /><span>Menú</span></NavLink>
      </nav>

      <CreacionRapida abierta={crear} alCerrar={() => setCrear(false)} alIr={(ruta) => { setCrear(false); navegar(ruta); }} />
    </div>
  );
}

export function Encabezado({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: string; acciones?: ReactNode }) {
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="sub">{subtitulo}</p>}
      </div>
      {acciones && <div className="acciones">{acciones}</div>}
    </header>
  );
}
