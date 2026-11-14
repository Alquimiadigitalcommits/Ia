// Datos personales del dashboard: lee y escribe las bases de la página "Mi día" en Notion.
import { crearClienteNotion, escribir, leer, type ClienteNotion } from "../conectores/notion.js";

export const ZONA = process.env.ZONA_HORARIA ?? "America/Santiago";

export interface BasesPersonales {
  token: string;
  registro: string;
  medicamentos: string;
  plan: string;
  fechas: string;
  ciclo: string;
  lecturas: string;
  proyectos?: string;
}

export function basesDesdeEntorno(): BasesPersonales {
  const e = process.env;
  const req = (n: string) => {
    if (!e[n]) throw new Error(`Falta la variable de entorno ${n}`);
    return e[n]!;
  };
  return {
    token: req("NOTION_TOKEN"),
    registro: req("NOTION_DB_REGISTRO"),
    medicamentos: req("NOTION_DB_MEDICAMENTOS"),
    plan: req("NOTION_DB_PLAN"),
    fechas: req("NOTION_DB_FECHAS"),
    ciclo: req("NOTION_DB_CICLO"),
    lecturas: req("NOTION_DB_LECTURAS"),
    proyectos: e.NOTION_DB_PROYECTOS || undefined,
  };
}

// ─────────────────────────── Fechas en la zona horaria de Chile ───────────────────────────

export const fechaISO = (d: Date, zona = ZONA) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
export const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

export const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);

// Lectores de propiedades (vienen del conector único de Notion)
type Props = Record<string, any>;
const { texto: txt, numero: num, opcion: sel, opciones: multi, casilla: chk, fecha } = leer;

// ─────────────────────────── Cálculos (funciones puras, se pueden probar sin Notion) ───────────────────────────

export interface Periodo {
  inicio: string;
  fin: string | null;
}

export function calcularCiclo(periodos: Periodo[], hoy: string) {
  const orden = [...periodos].filter((p) => p.inicio).sort((a, b) => b.inicio.localeCompare(a.inicio));
  if (!orden.length) return null;
  const duraciones: number[] = [];
  for (let i = 0; i < Math.min(orden.length - 1, 6); i++) {
    const d = diasEntre(orden[i + 1].inicio, orden[i].inicio);
    if (d >= 15 && d <= 60) duraciones.push(d);
  }
  const promedio = duraciones.length ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : 28;
  const ultimo = orden[0];
  const largoPeriodo = ultimo.fin ? diasEntre(ultimo.inicio, ultimo.fin) + 1 : 5;
  const diaDelCiclo = diasEntre(ultimo.inicio, hoy) + 1;
  let proximo = sumarDias(ultimo.inicio, promedio);
  while (proximo < hoy) proximo = sumarDias(proximo, promedio);
  return {
    ultimoInicio: ultimo.inicio,
    duracionPromedio: promedio,
    registros: orden.length,
    diaDelCiclo,
    enPeriodo: diaDelCiclo >= 1 && diaDelCiclo <= largoPeriodo,
    proximoInicio: proximo,
    diasParaProximo: diasEntre(hoy, proximo),
    diasPeriodo: Array.from({ length: largoPeriodo }, (_, i) => sumarDias(ultimo.inicio, i)),
    diasProximo: Array.from({ length: largoPeriodo }, (_, i) => sumarDias(proximo, i)),
  };
}

/** Próxima vez que ocurre una fecha (si se repite cada año, la de este año o el siguiente). */
export function proximaOcurrencia(iso: string, repite: boolean, hoy: string): string {
  if (!repite || iso >= hoy) return iso;
  const [, mes, dia] = iso.split("-");
  const esteAnio = `${hoy.slice(0, 4)}-${mes}-${dia}`;
  return esteAnio >= hoy ? esteAnio : `${Number(hoy.slice(0, 4)) + 1}-${mes}-${dia}`;
}

export const horarios = (s: string) =>
  s
    .split(/[,;\s]+/)
    .map((h) => h.trim())
    .filter((h) => /^\d{1,2}:\d{2}$/.test(h))
    .map((h) => h.padStart(5, "0"));

// ─────────────────────────── Resumen para el dashboard ───────────────────────────

export interface EventoDelDia {
  hora: string;
  titulo: string;
  detalle: string;
  tipo: "medicamento" | "kine" | "ejercicio" | "fecha";
}

export async function resumen(b: BasesPersonales, ahora = new Date(), cli: ClienteNotion = crearClienteNotion(b.token)) {
  const hoy = fechaISO(ahora);
  const dia = diaSemana(hoy);
  const hace6 = sumarDias(hoy, -6);

  const [registros, meds, plan, fechas, periodos, lecturas, proyectos] = await Promise.all([
    cli.consultar(b.registro, {
      filter: { property: "Fecha", date: { on_or_after: hace6 } },
      sorts: [{ property: "Fecha", direction: "ascending" }],
    }),
    cli.consultar(b.medicamentos, { filter: { property: "Activo", checkbox: { equals: true } } }),
    cli.consultar(b.plan, { filter: { property: "Activo", checkbox: { equals: true } } }),
    cli.consultar(b.fechas),
    cli.consultar(b.ciclo, { sorts: [{ property: "Inicio", direction: "descending" }], page_size: 13 }),
    cli.consultar(b.lecturas, { filter: { property: "Estado", select: { equals: "Leyendo" } } }),
    b.proyectos ? cli.consultar(b.proyectos, { page_size: 20 }).catch(() => []) : Promise.resolve([]),
  ]);

  // Semana (rellena los días sin registro)
  const porFecha = new Map<string, Props>(registros.map((r) => [fecha(r.properties.Fecha) ?? "", r.properties]));
  const semana = Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hace6, i);
    const p = porFecha.get(f);
    const humor = p ? sel(p.Humor) : null;
    return {
      fecha: f,
      dia: diaSemana(f),
      agua: p ? num(p["Agua (vasos)"]) ?? 0 : 0,
      humor: humor ? Number(humor[0]) : null,
      ejercicio: p ? num(p["Ejercicio (min)"]) ?? 0 : 0,
      lectura: p ? num(p["Lectura (min)"]) ?? 0 : 0,
      kine: p ? chk(p["Kine hecha"]) : false,
      sueno: p ? num(p["Horas de sueño"]) : null,
    };
  });
  const pHoy = porFecha.get(hoy);
  const hoyDatos = {
    ...semana[6],
    metaAgua: (pHoy && num(pHoy["Meta agua"])) || 8,
    humorTexto: pHoy ? sel(pHoy.Humor) : null,
    energia: pHoy ? sel(pHoy["Energía"]) : null,
  };

  // Línea de tiempo de hoy
  const eventos: EventoDelDia[] = [];
  const medicamentosHoy = meds
    .map((m) => m.properties)
    .filter((p) => {
      const dias = multi(p["Días"]);
      const hasta = fecha(p.Hasta);
      return (dias.length === 0 || dias.includes("Todos") || dias.includes(dia)) && (!hasta || hasta >= hoy);
    })
    .map((p) => ({
      nombre: txt(p.Medicamento),
      dosis: txt(p.Dosis),
      horas: horarios(txt(p.Horarios)),
      stock: num(p["Stock (unidades)"]),
      paraQue: txt(p["Para qué"]),
    }));
  for (const m of medicamentosHoy) {
    for (const h of m.horas) eventos.push({ hora: h, titulo: m.nombre, detalle: m.dosis, tipo: "medicamento" });
  }

  const planHoy = plan
    .map((r) => r.properties)
    .filter((p) => multi(p["Días"]).includes(dia))
    .map((p) => ({
      nombre: txt(p.Ejercicio),
      tipo: sel(p.Tipo) ?? "Ejercicio",
      hora: horarios(txt(p.Hora))[0] ?? "",
      detalle: [txt(p["Series x reps"]), num(p.Minutos) ? `${num(p.Minutos)} min` : ""].filter(Boolean).join(" · "),
      indicaciones: txt(p.Indicaciones),
    }));
  for (const p of planHoy) {
    eventos.push({
      hora: p.hora || "—",
      titulo: p.nombre,
      detalle: p.detalle,
      tipo: p.tipo === "Kinesiología" ? "kine" : "ejercicio",
    });
  }

  const proximasFechas = fechas
    .map((r) => r.properties)
    .map((p) => {
      const original = fecha(p.Fecha);
      if (!original) return null;
      const cuando = proximaOcurrencia(original, chk(p["Se repite cada año"]), hoy);
      return {
        evento: txt(p.Evento),
        fecha: cuando,
        tipo: sel(p.Tipo) ?? "Otro",
        dias: diasEntre(hoy, cuando),
        avisar: num(p["Avisar días antes"]) ?? 0,
        alarma: chk(p.Alarma),
        hora: p.Fecha?.date?.start?.length > 10 ? p.Fecha.date.start.slice(11, 16) : "",
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x && x.dias >= 0))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const f of proximasFechas.filter((f) => f.dias === 0)) {
    eventos.push({ hora: f.hora || "—", titulo: f.evento, detalle: f.tipo, tipo: "fecha" });
  }
  eventos.sort((a, b) => (a.hora === "—" ? 1 : b.hora === "—" ? -1 : a.hora.localeCompare(b.hora)));

  const ciclo = calcularCiclo(
    periodos.map((r) => ({ inicio: fecha(r.properties.Inicio) ?? "", fin: fecha(r.properties.Fin) })),
    hoy,
  );

  return {
    generado: ahora.toISOString(),
    hoy,
    nombre: process.env.NOMBRE_DASHBOARD ?? "",
    agua: hoyDatos,
    semana,
    eventos,
    medicamentosHoy,
    planHoy,
    fechas: proximasFechas.slice(0, 12),
    ciclo,
    lecturas: lecturas.map((r) => ({
      libro: txt(r.properties.Libro),
      autor: txt(r.properties.Autor),
      pagina: num(r.properties["Página actual"]) ?? 0,
      total: num(r.properties["Páginas totales"]) ?? 0,
    })),
    proyectos: proyectos.slice(0, 8).map((r) => {
      const props = r.properties as Props;
      const tituloProp = Object.values(props).find((p: any) => p?.type === "title");
      const estadoProp = Object.values(props).find((p: any) => p?.type === "status" || p?.type === "select");
      return {
        nombre: txt(tituloProp),
        estado: (estadoProp as any)?.status?.name ?? (estadoProp as any)?.select?.name ?? "",
        url: r.url as string,
      };
    }),
  };
}

export type Resumen = Awaited<ReturnType<typeof resumen>>;

// ─────────────────────────── Escrituras rápidas (dashboard y bot) ───────────────────────────

async function filaDeHoy(cli: ClienteNotion, b: BasesPersonales, hoy: string) {
  const [fila] = await cli.consultar(b.registro, {
    filter: { property: "Fecha", date: { equals: hoy } },
    page_size: 1,
  });
  if (fila) return { id: fila.id as string, properties: fila.properties as Props };
  const nueva = await cli.crearPagina(b.registro, {
    "Día": escribir.titulo(hoy),
    Fecha: escribir.fecha(hoy),
    "Agua (vasos)": escribir.numero(0),
    "Meta agua": escribir.numero(8),
  });
  return { id: nueva.id, properties: {} as Props };
}

export type Registro =
  | { tipo: "agua"; vasos: number }
  | { tipo: "humor"; valor: 1 | 2 | 3 | 4 | 5 }
  | { tipo: "kine"; hecha: boolean }
  | { tipo: "ejercicio"; minutos: number }
  | { tipo: "lectura"; minutos: number }
  | { tipo: "sueno"; horas: number };

const HUMOR = { 1: "1 Muy bajo", 2: "2 Bajo", 3: "3 Normal", 4: "4 Bien", 5: "5 Muy bien" } as const;

/** Suma o actualiza el registro de hoy. Agua, ejercicio y lectura se suman; el resto se reemplaza. */
export async function registrar(
  b: BasesPersonales,
  r: Registro,
  ahora = new Date(),
  cli: ClienteNotion = crearClienteNotion(b.token),
) {
  const fila = await filaDeHoy(cli, b, fechaISO(ahora));
  const p = fila.properties as Props;
  const props: Record<string, unknown> = {};
  switch (r.tipo) {
    case "agua":
      props["Agua (vasos)"] = { number: Math.max(0, (num(p["Agua (vasos)"]) ?? 0) + r.vasos) };
      break;
    case "ejercicio":
      props["Ejercicio (min)"] = { number: (num(p["Ejercicio (min)"]) ?? 0) + r.minutos };
      break;
    case "lectura":
      props["Lectura (min)"] = { number: (num(p["Lectura (min)"]) ?? 0) + r.minutos };
      break;
    case "humor":
      props.Humor = { select: { name: HUMOR[r.valor] } };
      break;
    case "kine":
      props["Kine hecha"] = { checkbox: r.hecha };
      break;
    case "sueno":
      props["Horas de sueño"] = { number: r.horas };
      break;
  }
  const actualizada = await cli.actualizarPagina(fila.id, props);
  return actualizada.properties as Props;
}

// ─────────────────────────── Alarmas del día (para Android) ───────────────────────────

export function alarmasDelDia(r: Resumen) {
  return r.eventos
    .filter((e) => e.hora !== "—")
    .map((e) => ({ hora: e.hora, etiqueta: `${e.titulo}${e.detalle ? ` · ${e.detalle}` : ""}`.slice(0, 60), tipo: e.tipo }));
}
