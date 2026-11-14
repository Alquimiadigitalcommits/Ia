// Fechas importantes y ciclo, escritos desde WhatsApp.

import { escribir, type ClienteNotion } from "../conectores/notion.js";

export const TIPOS_FECHA = ["Cumpleaños", "Pago", "Cita médica", "Entrega", "Negocio", "Personal", "Otro"] as const;

export async function agregarFecha(
  notion: ClienteNotion,
  db: string,
  f: { evento: string; fecha: string; hora?: string | null; tipo: (typeof TIPOS_FECHA)[number]; seRepite: boolean; avisarDiasAntes?: number | null },
) {
  const inicio = f.hora ? `${f.fecha}T${f.hora}:00` : f.fecha;
  const props: Record<string, unknown> = {
    Evento: escribir.titulo(f.evento),
    Fecha: { date: { start: inicio, ...(f.hora ? { time_zone: process.env.ZONA_HORARIA ?? "America/Santiago" } : {}) } },
    Tipo: escribir.opcion(f.tipo),
    "Se repite cada año": escribir.casilla(f.seRepite),
    Alarma: escribir.casilla(Boolean(f.hora)),
  };
  if (f.avisarDiasAntes != null) props["Avisar días antes"] = escribir.numero(f.avisarDiasAntes);
  const pagina = await notion.crearPagina(db, props);
  return { pagina, resumen: `Fecha: ${f.evento} · ${f.fecha}${f.hora ? ` ${f.hora}` : ""} (${f.tipo})${f.seRepite ? " · cada año" : ""}` };
}

/** Inicio crea una fila nueva; fin completa la fila más reciente sin fecha de término. */
export async function registrarPeriodo(notion: ClienteNotion, db: string, accion: "inicio" | "fin", fecha: string) {
  if (accion === "inicio") {
    const pagina = await notion.crearPagina(db, { Periodo: escribir.titulo(`Periodo ${fecha}`), Inicio: escribir.fecha(fecha) });
    return { pagina, resumen: `Inicio de periodo: ${fecha}` };
  }
  const [abierto] = await notion.consultar(db, {
    filter: { property: "Fin", date: { is_empty: true } },
    sorts: [{ property: "Inicio", direction: "descending" }],
    page_size: 1,
  });
  if (!abierto) return { pagina: null, resumen: "No encontré un periodo abierto. Registra primero el inicio." };
  await notion.actualizarPagina(abierto.id, { Fin: escribir.fecha(fecha) });
  return { pagina: null, resumen: `Fin de periodo: ${fecha}` };
}
