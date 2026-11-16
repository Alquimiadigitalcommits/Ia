import { useEffect, useState } from "react";
import { CARITAS, Cargando, ErrorCaja, Escala, Vacio } from "../componentes/Basicos";
import { Encabezado } from "../componentes/Estructura";
import { Historial } from "../componentes/Historial";
import { Icono } from "../componentes/Icono";
import { api } from "../lib/api";
import { fechaCorta, hoyISO, sumarDias } from "../lib/fechas";
import { useCarga, useSesion } from "../lib/sesion";

interface Registro { id: string; fecha: string; agua_vasos: number; meta_agua: number; humor: number | null; energia: number | null; sueno_horas: number | null; notas: string | null }

export function Bienestar() {
  const { zona } = useSesion();
  const hoy = hoyISO(zona);
  const [historial, setHistorial] = useState<string | null>(null);
  const { datos, error, cargando, recargar } = useCarga<Registro[]>(() => api("GET", `/e/bienestar?desde=${sumarDias(hoy, -29)}&limite=60`), [hoy]);
  const deHoy = datos?.find((r) => r.fecha === hoy) ?? null;

  const eliminar = async (r: Registro) => { await api("DELETE", `/e/bienestar/${r.id}`); void recargar(); };

  return (
    <>
      <Encabezado titulo="Bienestar" subtitulo="Agua, ánimo, energía y sueño. Un registro por día." />
      {cargando && !datos && <Cargando />}
      {error && <ErrorCaja mensaje={error} reintentar={recargar} />}
      {datos && <RegistroDeHoy key={deHoy?.id ?? "nuevo"} registro={deHoy} alGuardar={recargar} />}

      <h2 className="titulo-seccion">Últimos 30 días</h2>
      {datos && !datos.length && <Vacio titulo="Sin registros todavía" texto="Lo que registres hoy aparece aquí." />}
      <ul className="filas">
        {(datos ?? []).map((r) => (
          <li key={r.id} className="fila">
            <time className="hora-chip">{fechaCorta(r.fecha)}</time>
            <div className="fila-texto">
              <b>{r.agua_vasos}/{r.meta_agua} vasos{r.humor ? ` · ${CARITAS[r.humor - 1]}` : ""}</b>
              <small>{[r.energia ? `energía ${r.energia}/5` : null, r.sueno_horas != null ? `${r.sueno_horas} h de sueño` : null, r.notas].filter(Boolean).join(" · ") || "Sin más datos"}</small>
            </div>
            <button className="icono-btn" onClick={() => setHistorial(r.id)} aria-label={`Historial del ${r.fecha}`}><Icono nombre="reloj" tamano={18} /></button>
            <button className="icono-btn" onClick={() => eliminar(r)} aria-label={`Enviar a la papelera el registro del ${r.fecha}`}><Icono nombre="basura" tamano={18} /></button>
          </li>
        ))}
      </ul>
      <Historial entidad="bienestar" id={historial} alCerrar={() => setHistorial(null)} />
    </>
  );
}

function RegistroDeHoy({ registro, alGuardar }: { registro: Registro | null; alGuardar: () => void }) {
  const [humor, setHumor] = useState<number | null>(registro?.humor ?? null);
  const [energia, setEnergia] = useState<number | null>(registro?.energia ?? null);
  const [sueno, setSueno] = useState(registro?.sueno_horas != null ? String(registro.sueno_horas) : "");
  const [notas, setNotas] = useState(registro?.notas ?? "");
  const [meta, setMeta] = useState(String(registro?.meta_agua ?? 8));
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  useEffect(() => setEstado(null), [humor, energia, sueno, notas, meta]);

  const agua = async (vasos: number) => {
    try { await api("POST", "/bienestar/hoy", { agua_vasos: vasos }); alGuardar(); } catch (e) { setEstado({ tipo: "error", texto: (e as Error).message }); }
  };
  const guardar = async () => {
    const horas = sueno === "" ? null : Number(sueno.replace(",", "."));
    if (horas !== null && (Number.isNaN(horas) || horas < 0 || horas > 24)) return setEstado({ tipo: "error", texto: "Las horas de sueño deben estar entre 0 y 24." });
    try {
      await api("POST", "/bienestar/hoy", { humor, energia, sueno_horas: horas, notas: notas || null, meta_agua: Number(meta) || 8 });
      setEstado({ tipo: "ok", texto: "Guardado" });
      alGuardar();
    } catch (e) {
      setEstado({ tipo: "error", texto: (e as Error).message });
    }
  };

  return (
    <section className="tarjeta amarilla registro-hoy" aria-label="Registro de hoy">
      <span className="forma forma-gota" aria-hidden="true" />
      <div className="tarjeta-cab"><h2>Hoy</h2></div>
      <div className="agua-control">
        <button className="redondo" onClick={() => agua(-1)} aria-label="Restar un vaso">−</button>
        <div className="cifra destacada"><b>{registro?.agua_vasos ?? 0}/{registro?.meta_agua ?? 8}</b><span>vasos de agua</span></div>
        <button className="redondo oscuro" onClick={() => agua(1)} aria-label="Sumar un vaso">+</button>
      </div>
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <span className="etiqueta">Ánimo</span>
        <Escala valor={humor} alCambiar={setHumor} etiqueta="Ánimo" simbolos={CARITAS} />
        <span className="etiqueta">Energía</span>
        <Escala valor={energia} alCambiar={setEnergia} etiqueta="Energía" />
        <div className="fila-campos">
          <label>Horas de sueño<input inputMode="decimal" value={sueno} onChange={(e) => setSueno(e.target.value)} placeholder="7,5" /></label>
          <label>Meta de agua (vasos)<input type="number" min={1} max={40} value={meta} onChange={(e) => setMeta(e.target.value)} /></label>
        </div>
        <label>Notas del día<textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={2000} /></label>
        <div className="botonera">
          {estado && <span className={estado.tipo === "ok" ? "aviso-ok" : "error"} role="status">{estado.tipo === "ok" ? "✓ " : ""}{estado.texto}</span>}
          <button className="boton">Guardar</button>
        </div>
      </form>
    </section>
  );
}
