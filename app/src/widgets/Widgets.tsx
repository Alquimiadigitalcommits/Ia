import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CARITAS } from "../componentes/Basicos";
import { Icono } from "../componentes/Icono";
import { api } from "../lib/api";
import { fechaCorta, hora } from "../lib/fechas";

export interface DatosDashboard {
  hoy: string;
  bienestar: { hoy: Dia; semana: Dia[] };
  tareas: { lista: Tarea[]; pendientes: number; vencidas: number; hechas_semana: number };
  agenda: { hoy: Evento[]; proximos: Evento[] };
  estadisticas: { dias_registrados: number; agua_promedio: number | null; dias_meta_agua: number; humor_promedio: number | null; energia_promedio: number | null; sueno_promedio: number | null; tareas_hechas_semana: number };
}
interface Dia { fecha: string; agua: number; meta: number; humor: number | null; energia: number | null; sueno: number | null; registrado: boolean }
interface Tarea { id: string; titulo: string; prioridad: string; vence: string | null; area: string }
interface Evento { id: string; titulo: string; inicio: string; todo_el_dia: boolean; lugar: string | null }

export interface PropsWidget { d: DatosDashboard; zona: string; alCambiar: () => void }

const avisar = () => window.dispatchEvent(new Event("mi-dia:datos-cambiaron"));
const DIA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

export function Tarjeta({ titulo, color, forma, ir, children }: { titulo: string; color: string; forma?: string; ir?: string; children: ReactNode }) {
  return (
    <section className={`tarjeta ${color}`} aria-label={titulo}>
      {forma && <span className={`forma forma-${forma}`} aria-hidden="true" />}
      <div className="tarjeta-cab">
        <h2>{titulo}</h2>
        {ir && <Link to={ir} className="ver-mas">Ver todo</Link>}
      </div>
      {children}
    </section>
  );
}

export const Cifra = ({ valor, rotulo, destacada }: { valor: ReactNode; rotulo: string; destacada?: boolean }) => (
  <div className={`cifra${destacada ? " destacada" : ""}`}><b>{valor}</b><span>{rotulo}</span></div>
);

function WResumen({ d, zona }: PropsWidget) {
  const b = d.bienestar.hoy;
  const partes = [
    `${b.agua} de ${b.meta} vasos de agua`,
    `${d.tareas.pendientes} tarea${d.tareas.pendientes === 1 ? "" : "s"} pendiente${d.tareas.pendientes === 1 ? "" : "s"}${d.tareas.vencidas ? ` (${d.tareas.vencidas} vencida${d.tareas.vencidas === 1 ? "" : "s"})` : ""}`,
    d.agenda.hoy.length ? `${d.agenda.hoy.length} evento${d.agenda.hoy.length === 1 ? "" : "s"} hoy, el primero a las ${hora(d.agenda.hoy[0].inicio, zona)}` : "sin eventos hoy",
  ];
  return (
    <Tarjeta titulo="Resumen del día" color="crema">
      <p className="resumen-texto">{partes.join(" · ")}.</p>
    </Tarjeta>
  );
}

function WAccesos({ alCambiar }: PropsWidget) {
  const sumar = async (vasos: number) => { await api("POST", "/bienestar/hoy", { agua_vasos: vasos }); alCambiar(); avisar(); };
  return (
    <Tarjeta titulo="Registro rápido" color="crema">
      <div className="botones-rapidos">
        <button className="chip-btn oscuro" onClick={() => sumar(1)}><Icono nombre="gota" tamano={16} />+1 vaso</button>
        <button className="chip-btn" onClick={() => sumar(-1)} aria-label="Restar un vaso">−1 vaso</button>
        <Link className="chip-btn" to="/tareas?nueva=1">+ Tarea</Link>
        <Link className="chip-btn" to="/agenda?nuevo=1">+ Evento</Link>
      </div>
    </Tarjeta>
  );
}

function WBienestar({ d, alCambiar }: PropsWidget) {
  const b = d.bienestar.hoy;
  const max = Math.max(b.meta, ...d.bienestar.semana.map((s) => s.agua), 1);
  const ponerHumor = async (humor: number) => { await api("POST", "/bienestar/hoy", { humor }); alCambiar(); };
  return (
    <Tarjeta titulo="Bienestar" color="amarilla" forma="gota" ir="/bienestar">
      <div className="cifras">
        <Cifra valor={`${b.agua}/${b.meta}`} rotulo="vasos hoy" destacada />
        <Cifra valor={b.sueno != null ? `${b.sueno} h` : "—"} rotulo="sueño" />
        <Cifra valor={b.energia != null ? `${b.energia}/5` : "—"} rotulo="energía" />
      </div>
      <div className="escala compacta" role="radiogroup" aria-label="Ánimo de hoy">
        {CARITAS.map((c, i) => (
          <button key={c} role="radio" aria-checked={b.humor === i + 1} className={b.humor === i + 1 ? "activo" : ""} onClick={() => ponerHumor(i + 1)} aria-label={`Ánimo ${i + 1} de 5`}>{c}</button>
        ))}
      </div>
      <svg className="barras" viewBox="0 0 280 90" role="img" aria-label="Vasos de agua por día, últimos 7 días">
        {d.bienestar.semana.map((s, i) => {
          const h = s.registrado ? Math.max(4, (s.agua / max) * 62) : 31;
          const x = i * 40 + 13;
          return (
            <g key={s.fecha}>
              <rect x={x} y={70 - h} width="14" height={h} rx="7" fill={s.registrado ? "#141414" : "none"} stroke="#141414" strokeDasharray={s.registrado ? "0" : "3 3"} />
              <text x={x + 7} y="86" textAnchor="middle" fontSize="10" fill="rgba(20,20,20,.65)">{DIA[new Date(`${s.fecha}T12:00:00Z`).getUTCDay()]}</text>
            </g>
          );
        })}
      </svg>
    </Tarjeta>
  );
}

function WTareas({ d, alCambiar }: PropsWidget) {
  const completar = async (id: string) => { await api("PATCH", `/e/tareas/${id}`, { estado: "hecha" }); alCambiar(); };
  return (
    <Tarjeta titulo="Tareas pendientes" color="verde" forma="triangulo" ir="/tareas">
      <div className="cifras">
        <Cifra valor={d.tareas.pendientes} rotulo="pendientes" destacada />
        <Cifra valor={d.tareas.vencidas} rotulo="vencidas" />
        <Cifra valor={d.tareas.hechas_semana} rotulo="hechas 7 días" />
      </div>
      {d.tareas.lista.length ? (
        <ul className="lista-check">
          {d.tareas.lista.slice(0, 5).map((t) => (
            <li key={t.id}>
              <button className="check" onClick={() => completar(t.id)} aria-label={`Marcar como hecha: ${t.titulo}`} />
              <span className="lista-texto">{t.titulo}</span>
              {t.vence && <small className={t.vence < d.hoy ? "vencida" : ""}>{fechaCorta(t.vence)}</small>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pista">Sin pendientes. <Link to="/tareas?nueva=1">Agregar una tarea</Link></p>
      )}
    </Tarjeta>
  );
}

function WAgenda({ d, zona }: PropsWidget) {
  return (
    <Tarjeta titulo="Agenda" color="azul" forma="estrella" ir="/agenda">
      {d.agenda.proximos.length ? (
        <ul className="lista-agenda">
          {d.agenda.proximos.slice(0, 5).map((e) => (
            <li key={e.id}>
              <time>{e.todo_el_dia ? "Todo el día" : hora(e.inicio, zona)}</time>
              <span className="lista-texto"><b>{e.titulo}</b>{e.lugar && <small> · {e.lugar}</small>}</span>
              <small>{fechaCorta(new Date(e.inicio).toLocaleDateString("en-CA", { timeZone: zona }))}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pista">Nada en los próximos 7 días. <Link to="/agenda?nuevo=1">Agregar un evento</Link></p>
      )}
    </Tarjeta>
  );
}

function WEstadisticas({ d }: PropsWidget) {
  const e = d.estadisticas;
  const v = (n: number | null, suf = "") => (n == null ? "—" : `${n}${suf}`);
  return (
    <Tarjeta titulo="Estadísticas de la semana" color="rosada" forma="corazon">
      <div className="cifras">
        <Cifra valor={`${e.dias_registrados}/7`} rotulo="días registrados" destacada />
        <Cifra valor={v(e.agua_promedio)} rotulo="vasos promedio" />
        <Cifra valor={`${e.dias_meta_agua}/7`} rotulo="días con meta de agua" />
        <Cifra valor={v(e.humor_promedio, "/5")} rotulo="ánimo promedio" />
        <Cifra valor={v(e.sueno_promedio, " h")} rotulo="sueño promedio" />
        <Cifra valor={e.tareas_hechas_semana} rotulo="tareas hechas" />
      </div>
      {e.dias_registrados < 3 && <p className="pista">Los promedios son más útiles con al menos 3 días registrados.</p>}
    </Tarjeta>
  );
}

export const COMPONENTES_WIDGET: Record<string, (p: PropsWidget) => ReactNode> = {
  resumen: WResumen,
  accesos_rapidos: WAccesos,
  bienestar: WBienestar,
  tareas: WTareas,
  agenda: WAgenda,
  estadisticas: WEstadisticas,
};
