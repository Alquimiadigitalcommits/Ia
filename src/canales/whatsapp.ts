// Canal WhatsApp: recibe mensajes, revisa quién escribe y entrega cada idea al flujo de ideas.
// Aquí no hay lógica de Notion ni de Claude: eso vive en ideas/ y conectores/.

import { crearClienteNotion } from "../conectores/notion.js";
import { descargarMedia, enviarTexto, type MensajeEntrante } from "../conectores/whatsapp.js";
import { guardarIdea, type IdeaGuardada } from "../ideas/guardar.js";
import type { Config } from "../nucleo/config.js";
import { registroPorDefecto, type RegistroProcesados } from "../nucleo/idempotencia.js";

const AYUDA = `Bot de ideas de Alquimia Digital
Mándame la idea como texto, link de TikTok/YouTube, foto o captura.
- Para asignar cliente: escribe #NombreCliente (ej. #Plasok).
- Cada mensaje queda como una fila en "Ideas y referencias" de Notion.
- Escribe "ayuda" para ver esto de nuevo.`;

export function respuestaIdea(r: IdeaGuardada): string {
  if (!r.idea) return `Guardada sin clasificar. Revísala en Notion:\n${r.pagina.url}`;
  const i = r.idea;
  const sinDatos = r.referencias.length > 0 && r.referencias.every((x) => !x.titulo && !x.portada);
  return [
    `"${i.titulo}"`,
    `De qué trata: ${i.de_que_trata}`,
    i.clientes_sugeridos.length
      ? `Le sirve a:\n${i.clientes_sugeridos.map((c) => `• ${c.cliente} (${c.encaje}): ${c.como_adaptarlo}`).join("\n")}`
      : "No calza claro con ningún cliente actual.",
    `${i.formato} · ${i.nicho} · prioridad ${i.prioridad}${i.caduca ? " · caduca" : ""}`,
    sinDatos ? "No pude leer el video del link. Mándame una captura y lo reviso mejor." : "",
    r.pagina.url,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function procesarMensaje(cfg: Config, m: MensajeEntrante, procesados: RegistroProcesados): Promise<void> {
  const contacto = cfg.contactos[m.de];
  if (!contacto) {
    console.warn(`Número no autorizado: ${m.de}`);
    return; // no se responde a desconocidos: evita gastar mensajes y dar pistas
  }
  if (/^\s*(ayuda|help|men[uú])\s*$/i.test(m.texto)) return enviarTexto(cfg, m.de, AYUDA);
  if (m.tipo === "otro") return enviarTexto(cfg, m.de, "Ese tipo de mensaje todavía no lo guardo. Mándalo como texto, link o foto.");

  let imagen: { datos: Buffer; mimeType: string } | undefined;
  if (m.tipo === "image" && m.mediaId) imagen = await descargarMedia(cfg, m.mediaId).catch(() => undefined);

  const r = await guardarIdea(crearClienteNotion(cfg.notion.token), cfg.notion.ideasDatabaseId, procesados, {
    idOrigen: m.id,
    fecha: m.fecha,
    texto: m.texto,
    remitente: contacto.nombre,
    origen: "WhatsApp",
    esCliente: contacto.rol === "cliente",
    clienteDelRemitente: contacto.rol === "cliente" ? contacto.cliente : undefined,
    imagen,
    tipoAdjunto: m.tipo === "text" ? undefined : m.tipo,
  });
  if (r) await enviarTexto(cfg, m.de, respuestaIdea(r)); // null = reenvío de WhatsApp ya procesado
}

/** Procesa todos los mensajes del webhook sin que un error corte a los demás. */
export async function procesarTodos(
  cfg: Config,
  mensajes: MensajeEntrante[],
  procesados: RegistroProcesados = registroPorDefecto(),
): Promise<void> {
  await Promise.all(
    mensajes.map(async (m) => {
      try {
        await procesarMensaje(cfg, m, procesados);
      } catch (e) {
        console.error(`Error procesando ${m.id}`, e);
        await enviarTexto(cfg, m.de, "No pude guardar esa idea por un error. Reenvíala en unos minutos.").catch(() => {});
      }
    }),
  );
}
