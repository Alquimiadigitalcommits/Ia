import type { Config, Contacto } from "./config.js";
import { clasificarIdea } from "./clasificar.js";
import { crearIdea, yaGuardado } from "./notion.js";
import { extraerLinks, leerReferencias } from "./referencias.js";
import { guardarIdeaTikTok } from "./tiktok.js";
import { descargarMedia, enviarTexto, type MensajeEntrante } from "./whatsapp.js";

const AYUDA_AGENCIA = `Bot de ideas de Alquimia Digital
Mándame la idea como texto, link, foto con descripción o captura.
- Para asignar cliente: escribe #NombreCliente en el mensaje.
- Cada mensaje = una idea en Notion.
- Escribe "ayuda" para ver esto de nuevo.`;

const AYUDA_TIKTOK = `Ideas TikTok
Mándame frases, links de TikTok/YouTube o capturas. Cada mensaje queda como ficha en Notion con nicho, tipo, hook y estructura.
- Para empezar con "agencia:" lo mando al Banco de ideas de Alquimia.`;

function clienteDesdeHashtag(texto: string, clientes: string[]): string | undefined {
  const tags = texto.match(/#([\p{L}\p{N}_.-]+)/gu) ?? [];
  const normal = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (const tag of tags) {
    const encontrado = clientes.find((c) => normal(c) === normal(tag.slice(1)));
    if (encontrado) return encontrado;
  }
  return undefined;
}

async function bajarImagen(cfg: Config, m: MensajeEntrante) {
  if (m.tipo !== "image" || !m.mediaId) return undefined;
  try {
    return await descargarMedia(cfg, m.mediaId);
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

async function guardarTikTok(cfg: Config, m: MensajeEntrante): Promise<string> {
  const destino = { token: cfg.notion.token, databaseId: cfg.notion.tiktokDatabaseId };
  const r = await guardarIdeaTikTok(destino, {
    idOrigen: m.id,
    fecha: m.fecha,
    texto: m.texto,
    origen: "WhatsApp",
    imagen: await bajarImagen(cfg, m),
    tipoAdjunto: m.tipo === "text" ? undefined : m.tipo,
  });
  if (!r) return ""; // reintento de Meta: ya estaba
  return r.idea
    ? [
        `Guardada: "${r.idea.titulo}"`,
        `${r.idea.nicho} · ${r.idea.tipo} · prioridad ${r.idea.prioridad}${r.idea.caduca ? " · caduca" : ""}`,
        `Hook: ${r.idea.hook}`,
        r.pagina.url,
      ].join("\n")
    : `Guardada sin clasificar.\n${r.pagina.url}`;
}

async function guardarAgencia(cfg: Config, m: MensajeEntrante, contacto: Contacto, texto: string): Promise<string> {
  const destino = { token: cfg.notion.token, databaseId: cfg.notion.databaseId };
  if (await yaGuardado(destino, m.id)) return "";

  const clienteForzado =
    contacto.rol === "cliente" ? contacto.cliente : clienteDesdeHashtag(texto, cfg.clientes);
  const referencias = await leerReferencias(extraerLinks(texto));
  const idea = await clasificarIdea(
    { texto, remitente: contacto.nombre, clienteAsignado: clienteForzado, imagen: await bajarImagen(cfg, m), referencias },
    cfg.clientes,
  );
  const pagina = await crearIdea(destino, {
    whatsappId: m.id,
    fecha: m.fecha,
    remitente: contacto.nombre,
    telefono: m.de,
    fuente: contacto.rol === "cliente" ? "Cliente" : "Alquimia",
    mensajeOriginal: texto,
    referencias,
    tipoAdjunto: m.tipo === "text" ? undefined : m.tipo,
    clienteForzado,
    idea,
  });
  return idea
    ? [
        `Guardada en Notion: "${idea.titulo}"`,
        `Cliente: ${clienteForzado ?? idea.cliente}`,
        `Formato: ${idea.formato} | ${idea.plataformas.join(", ") || "sin plataforma"}`,
        pagina.url,
      ].join("\n")
    : `Guardé la idea en Notion sin clasificar (queda en estado "Sin clasificar").\n${pagina.url}`;
}

export async function procesarMensaje(cfg: Config, m: MensajeEntrante): Promise<void> {
  const contacto = cfg.contactos[m.de];
  if (!contacto) {
    console.warn(`Número no autorizado: ${m.de}`);
    await enviarTexto(cfg, m.de, "Este número no está registrado para enviar ideas. Escríbele a Alquimia Digital.");
    return;
  }

  const esTikTok = contacto.destino === "tiktok" && Boolean(cfg.notion.tiktokDatabaseId);

  if (/^\s*(ayuda|help|menu|menú)\s*$/i.test(m.texto)) {
    await enviarTexto(cfg, m.de, esTikTok ? AYUDA_TIKTOK : AYUDA_AGENCIA);
    return;
  }
  if (m.tipo === "otro") {
    await enviarTexto(cfg, m.de, "Ese tipo de mensaje todavía no lo guardo. Mándalo como texto, link o foto.");
    return;
  }

  // Quien usa la base TikTok puede mandar algo a la agencia empezando con "agencia:".
  const prefijoAgencia = /^\s*agencia\s*:\s*/i;
  const respuesta =
    esTikTok && !prefijoAgencia.test(m.texto)
      ? await guardarTikTok(cfg, m)
      : await guardarAgencia(cfg, m, contacto, m.texto.replace(prefijoAgencia, ""));

  if (respuesta) await enviarTexto(cfg, m.de, respuesta);
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
