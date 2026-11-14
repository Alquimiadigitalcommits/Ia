// Recordatorios por WhatsApp sin costo.
//
// WhatsApp no cobra los mensajes que se envían dentro de las 24 h siguientes al último
// mensaje de la persona ("ventana de atención"). Fuera de esa ventana exige plantillas
// pagadas. Por eso:
//   - solo se envía si la ventana está abierta,
//   - 1 hora antes de que se cierre se manda un aviso para que la persona responda
//     cualquier cosa y la ventana se renueve otras 24 h,
//   - si la ventana se cerró, no se envía nada: las alarmas de MacroDroid siguen funcionando.

import type { EstadoPersona } from "../nucleo/estado.js";
import { fechaISO, ZONA, type Resumen } from "../personal/personal.js";

export interface Recordatorio {
  clave: string; // para no repetirlo
  texto: string;
}

export const horaChile = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Qué enviar en esta pasada (la función corre cada 15 min). */
export function recordatoriosPendientes(r: Resumen, estado: EstadoPersona, ahora: Date, horaResumen = "08:00"): Recordatorio[] {
  const enviados = new Set(estado.recordatoriosEnviados ?? []);
  const hoy = fechaISO(ahora);
  const ya = minutos(horaChile(ahora));
  const enEstaPasada = (hhmm: string) => {
    const m = minutos(hhmm);
    return m <= ya && m > ya - 15;
  };
  const lista: Recordatorio[] = [];

  // Resumen de la mañana
  if (enEstaPasada(horaResumen)) {
    const avisos = r.fechas.filter((f) => f.dias === 0 || (f.avisar > 0 && f.dias === f.avisar));
    const partes = [
      `Buenos días. Hoy:`,
      ...r.eventos.filter((e) => e.hora !== "—").map((e) => `• ${e.hora} ${e.titulo}${e.detalle ? ` · ${e.detalle}` : ""}`),
      ...avisos.map((f) => `• ${f.evento}: ${f.dias === 0 ? "hoy" : `en ${f.dias} días`}`),
      r.ciclo && r.ciclo.diasParaProximo <= 2 ? `• Periodo estimado en ${r.ciclo.diasParaProximo} días` : "",
      `Meta de agua: ${r.agua.metaAgua} vasos.`,
    ].filter(Boolean);
    lista.push({ clave: `${hoy}:resumen`, texto: partes.join("\n") });
  }

  // Cada medicamento, ejercicio o cita con hora
  for (const e of r.eventos) {
    if (e.hora === "—" || !enEstaPasada(e.hora)) continue;
    const icono = e.tipo === "medicamento" ? "💊" : e.tipo === "fecha" ? "📅" : "🏃";
    lista.push({ clave: `${hoy}:${e.hora}:${e.titulo}`, texto: `${icono} ${e.hora} · ${e.titulo}${e.detalle ? `\n${e.detalle}` : ""}` });
  }

  // Aviso para renovar la ventana gratuita (entre 60 y 45 min antes de que se cierre)
  if (estado.ultimoEntrante) {
    const restante = Date.parse(estado.ultimoEntrante) + 24 * 3600_000 - ahora.getTime();
    if (restante <= 60 * 60_000 && restante > 45 * 60_000) {
      lista.push({
        clave: `renovar:${estado.ultimoEntrante}`,
        texto: "En 1 hora dejo de poder escribirte gratis. Respóndeme cualquier cosa (un 👍 sirve) para seguir recibiendo recordatorios.",
      });
    }
  }
  return lista.filter((x) => !enviados.has(x.clave));
}
