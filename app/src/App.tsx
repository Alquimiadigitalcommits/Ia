import type { ComponentType } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { disponible, MODULOS } from "../../shared/modulos";
import { Cargando, ErrorCaja } from "./componentes/Basicos";
import { Estructura } from "./componentes/Estructura";
import { SesionProvider, useSesion } from "./lib/sesion";
import { Acceso, SinConfigurar } from "./paginas/Acceso";
import { Agenda } from "./paginas/Agenda";
import { Ajustes } from "./paginas/Ajustes";
import { Bienestar } from "./paginas/Bienestar";
import { Dashboard } from "./paginas/Dashboard";
import { ModuloPendiente, Modulos } from "./paginas/Modulos";
import { Tareas } from "./paginas/Tareas";

/** Página de cada módulo construido. Los que no están construidos muestran "en construcción". */
const PAGINAS: Partial<Record<string, ComponentType>> = { agenda: Agenda, tareas: Tareas, bienestar: Bienestar };

function Rutas() {
  const { estado, recargar } = useSesion();
  if (estado.tipo === "sin_configurar") return <SinConfigurar />;
  if (estado.tipo === "cargando") return <main className="pantalla-acceso"><Cargando texto="Entrando…" /></main>;
  if (estado.tipo === "sin_sesion") return <Acceso />;
  if (estado.tipo === "error") return <main className="pantalla-acceso"><ErrorCaja mensaje={estado.mensaje} reintentar={recargar} /></main>;

  return (
    <Estructura>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/modulos" element={<Modulos />} />
        <Route path="/ajustes" element={<Ajustes />} />
        {MODULOS.map((m) => {
          const P = PAGINAS[m.id];
          return <Route key={m.id} path={m.ruta} element={P && disponible(m) ? <P /> : <ModuloPendiente id={m.id} />} />;
        })}
        <Route path="*" element={<div className="estado vacio"><b>Esta página no existe</b><Link className="boton secundario" to="/">Ir al inicio</Link></div>} />
      </Routes>
    </Estructura>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        <Rutas />
      </SesionProvider>
    </BrowserRouter>
  );
}
