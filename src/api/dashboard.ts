// Datos del dashboard en una sola consulta: resumen del día, bienestar de la semana,
// tareas, agenda y estadísticas. Todo lee con las reglas de la persona (RLS).

import type { Consulta } from "../datos/bd.js";

export const hoyEn = (zona: string, ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);

const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const promedio = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

export async function datosDashboard(q: Consulta, zona: string, ahora = new Date()) {
  const hoy = hoyEn(zona, ahora);
  const hace6 = sumarDias(hoy, -6);
  const en7 = sumarDias(hoy, 7);

  const bienestar = await q(
    "select fecha::text as fecha, agua_vasos, meta_agua, humor, energia, sueno_horas::float as sueno_horas from registros_bienestar where eliminado_en is null and fecha between $1 and $2 order by fecha",
    [hace6, hoy],
  );
  const porFecha = new Map(bienestar.map((b) => [b.fecha, b]));
  const semana = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(hace6, i);
    const b = porFecha.get(fecha);
    return { fecha, agua: b?.agua_vasos ?? 0, meta: b?.meta_agua ?? 8, humor: b?.humor ?? null, energia: b?.energia ?? null, sueno: b?.sueno_horas ?? null, registrado: Boolean(b) };
  });

  const tareasPendientes = await q(
    "select id, titulo, prioridad, vence::text as vence, area, estado from tareas where eliminado_en is null and estado <> 'hecha' order by (vence is null), vence, (prioridad = 'alta') desc, creado_en limit 8",
  );
  const [conteo] = await q<{ pendientes: number; vencidas: number; hechas_semana: number }>(
    `select
       count(*) filter (where estado <> 'hecha')::int as pendientes,
       count(*) filter (where estado <> 'hecha' and vence < $1)::int as vencidas,
       count(*) filter (where estado = 'hecha' and completada_en >= ($2::date::timestamp at time zone $3))::int as hechas_semana
     from tareas where eliminado_en is null`,
    [hoy, hace6, zona],
  );

  const eventos = await q(
    // Medianoche en la zona horaria de la persona, no en UTC.
    "select id, titulo, inicio, fin, todo_el_dia, lugar, area from eventos where eliminado_en is null and inicio >= ($1::date::timestamp at time zone $3) and inicio < ($2::date::timestamp at time zone $3) order by inicio limit 10",
    [hoy, en7, zona],
  );
  const eventosHoy = eventos.filter((e) => hoyEn(zona, new Date(e.inicio)) === hoy);

  const registrados = semana.filter((s) => s.registrado);
  return {
    hoy,
    bienestar: { hoy: semana[6], semana },
    tareas: { lista: tareasPendientes, pendientes: conteo?.pendientes ?? 0, vencidas: conteo?.vencidas ?? 0, hechas_semana: conteo?.hechas_semana ?? 0 },
    agenda: { hoy: eventosHoy, proximos: eventos },
    estadisticas: {
      dias_registrados: registrados.length,
      agua_promedio: promedio(registrados.map((s) => s.agua)),
      dias_meta_agua: semana.filter((s) => s.registrado && s.agua >= s.meta).length,
      humor_promedio: promedio(semana.map((s) => s.humor)),
      energia_promedio: promedio(semana.map((s) => s.energia)),
      sueno_promedio: promedio(semana.map((s) => s.sueno)),
      tareas_hechas_semana: conteo?.hechas_semana ?? 0,
    },
  };
}
