import type { Config } from "./config.js";
import { clasificarIdea } from "./clasificar.js";
import { crearIdea, yaGuardado } from "./notion.js";
import { descargarMedia, enviarTexto, type MensajeEntrante } from "./whatsapp.js";

const AYUDA = `Bot de ideas de Alquimia Digital
Mándame la idea como texto, link, foto con descripción o captura.
- Para asignar cliente: escribe #NombreCliente en el mensaje.
- Cada mensaje = una idea en Notion.
- Escribe "ayuda" para ver esto de nuevo.`;

const extraerLinks = (s: string) => s.match(/https?:\/\/[^\s<>"]+/g) ?? [];

function clienteDesdeHashtag(texto: string, clientes: string[]): string | undefined {
  const tags = texto.match(/#([\p{L}\p{N}_.-]+)/gu) ?? [];
  const normal = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (const tag of tags) {
    const encontrado = clientes.find((c) => normal(c) === normal(tag.slice(1)));
    if (encontrado) return encontrado;
  }
  return undefined;
}

export async function procesarMensaje(cfg: Config, m: MensajeEntrante): Promise<void> {
  const contacto = cfg.contactos[m.de];
  if (!contacto) {
    console.warn(`Número no autorizado: ${m.de}`);
    await enviarTexto(cfg, m.de, "Este número no está registrado para enviar ideas. Escríbele a Alquimia Digital.");
    return;
  }

  if (/^\s*(ayuda|help|menu|menú)\s*$/i.test(m.texto)) {
    await enviarTexto(cfg, m.de, AYUDA);
    return;
  }

  if (await yaGuardado(cfg, m.id)) return; // reintento de Meta

  if (m.tipo === "otro") {
    await enviarTexto(cfg, m.de, "Ese tipo de mensaje todavía no lo guardo. Mándalo como texto, link o foto.");
    return;
  }

  // Audio: la transcripción queda para la fase 2. Se guarda el registro igual.
  let imagen: { datos: Buffer; mimeType: string } | undefined;
  if (m.tipo === "image" && m.mediaId) {
    try {
      imagen = await descargarMedia(cfg, m.mediaId);
    } catch (e) {
      console.error(e);
    }
  }

  const clienteForzado =
    contacto.rol === "cliente" ? contacto.cliente : clienteDesdeHashtag(m.texto, cfg.clientes);

  const idea = await clasificarIdea(
    { texto: m.texto, remitente: contacto.nombre, clienteAsignado: clienteForzado, imagen },
    cfg.clientes,
  );

  const pagina = await crearIdea(cfg, {
    whatsappId: m.id,
    fecha: m.fecha,
    remitente: contacto.nombre,
    telefono: m.de,
    fuente: contacto.rol === "cliente" ? "Cliente" : "Alquimia",
    mensajeOriginal: m.texto,
    links: extraerLinks(m.texto),
    tipoAdjunto: m.tipo === "text" ? undefined : m.tipo,
    clienteForzado,
    idea,
  });

  const respuesta = idea
    ? [
        `Guardada en Notion: "${idea.titulo}"`,
        `Cliente: ${clienteForzado ?? idea.cliente}`,
        `Formato: ${idea.formato} | ${idea.plataformas.join(", ") || "sin plataforma"}`,
        pagina.url,
      ].join("\n")
    : `Guardé la idea en Notion sin clasificar (queda en estado "Sin clasificar").\n${pagina.url}`;
  await enviarTexto(cfg, m.de, respuesta);
}

/** Procesa todos los mensajes del webhook sin que un error corte a los demás. */
export async function procesarTodos(cfg: Config, mensajes: MensajeEntrante[]): Promise<void> {
  await Promise.all(
    mensajes.map(async (m) => {
      try {
        await procesarMensaje(cfg, m);
      } catch (e) {
        console.error(`Error procesando ${m.id}`, e);
        await enviarTexto(cfg, m.de, "No pude guardar esa idea por un error. Reenvíala en unos minutos.").catch(() => {});
      }
    }),
  );
}
