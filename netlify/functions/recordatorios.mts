// Corre cada 15 minutos (los cron de Netlify están en UTC; cada 15 min no depende de la zona).
// Envía recordatorios por WhatsApp solo dentro de la ventana gratuita de 24 h.
import type { Config } from "@netlify/functions";
import { recordatoriosPendientes } from "../../src/canales/recordatorios.js";
import { enviarTexto } from "../../src/conectores/whatsapp.js";
import { cargarConfig } from "../../src/nucleo/config.js";
import { estadoPorDefecto, ventanaAbierta } from "../../src/nucleo/estado.js";
import { basesDesdeEntorno, resumen } from "../../src/personal/personal.js";

export default async () => {
  if (process.env.RECORDATORIOS_WHATSAPP === "no") return;
  const cfg = cargarConfig();
  const almacen = estadoPorDefecto();
  const ahora = new Date();
  const admins = Object.entries(cfg.contactos).filter(([, c]) => c.rol === "admin").map(([tel]) => tel);
  if (!admins.length) return;
  const r = await resumen(basesDesdeEntorno(), ahora);
  for (const tel of admins) {
    const estado = await almacen.leer(tel);
    if (!ventanaAbierta(estado, ahora)) continue; // ventana cerrada: enviar costaría plata
    const pendientes = recordatoriosPendientes(r, estado, ahora, process.env.HORA_RESUMEN ?? "08:00");
    for (const p of pendientes) {
      await enviarTexto(cfg, tel, p.texto);
      estado.recordatoriosEnviados = [...(estado.recordatoriosEnviados ?? []), p.clave];
    }
    if (pendientes.length) await almacen.guardar(tel, estado);
  }
};

export const config: Config = { schedule: "*/15 * * * *" };
