// Canal WhatsApp: recibe mensajes, revisa quién escribe y decide el camino.
//   admin   → asistente completo (ideas, hábitos, finanzas, negocios, agenda)
//   equipo / cliente → solo ideas (más barato y sin acceso a datos privados)

import { atender } from "../asistente/asistente.js";
import { crearClienteNotion } from "../conectores/notion.js";
import { sheetsDesdeEntorno } from "../conectores/sheets.js";
import { descargarMedia, enviarTexto, type MensajeEntrante } from "../conectores/whatsapp.js";
import { guardarIdea, type IdeaGuardada } from "../ideas/guardar.js";
import type { Config, Contacto } from "../nucleo/config.js";
import { estadoPorDefecto, type AlmacenEstado } from "../nucleo/estado.js";
import { registroPorDefecto, type RegistroProcesados } from "../nucleo/idempotencia.js";
import { basesDesdeEntorno } from "../personal/personal.js";

const AYUDA_IDEAS = `Bot de ideas de Alquimia Digital
Mándame la idea como texto, link de TikTok/YouTube, foto o captura.
- Para asignar cliente: escribe #NombreCliente (ej. #Plasok).
- Cada mensaje queda en "Ideas y referencias" de Notion.`;

const AYUDA_ADMIN = `Escríbeme como hablas. Ejemplos:
• "tomé 2 vasos de agua" · "hoy ánimo 4" · "hice la kine"
• "gasté 5 lucas en uber con débito"
• "vendí 2 aros en Detalles a 8 mil, transferencia"
• "compré 100 limpiapipas a 3 lucas para Detalles"
• "proveedor: Telas Ñuñoa, vende lino, Irarrázaval 1234, @telasnunoa"
• "cita kine el viernes 16:00" · "me llegó la regla"
• link de TikTok = idea guardada con el cliente sugerido
• "¿cuánto llevo gastado este mes?" · "¿qué tengo hoy?"
• "borra eso" deshace lo último`;

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

async function caminoIdeas(cfg: Config, m: MensajeEntrante, contacto: Contacto, procesados: RegistroProcesados, imagen?: { datos: Buffer; mimeType: string }) {
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
  if (r) await enviarTexto(cfg, m.de, respuestaIdea(r));
}

async function caminoAdmin(
  cfg: Config,
  m: MensajeEntrante,
  contacto: Contacto,
  procesados: RegistroProcesados,
  almacen: AlmacenEstado,
  imagen?: { datos: Buffer; mimeType: string },
) {
  if (!(await procesados.reclamar(`msg:${m.id}`))) return; // reenvío de WhatsApp
  try {
    const estado = await almacen.leer(m.de);
    estado.ultimoEntrante = new Date().toISOString(); // abre la ventana gratuita de 24 h
    const base = basesDesdeEntorno();
    const { respuesta, estado: nuevo } = await atender(
      {
        notion: crearClienteNotion(cfg.notion.token),
        bases: {
          ...base,
          finanzas: process.env.NOTION_DB_FINANZAS_PERSONALES ?? "",
          ideas: cfg.notion.ideasDatabaseId,
        },
        sheets: await sheetsDesdeEntorno(),
        procesados,
        ideaBase: {
          idOrigen: m.id,
          fecha: m.fecha,
          remitente: contacto.nombre,
          origen: "WhatsApp",
          imagen,
          tipoAdjunto: m.tipo === "text" ? undefined : m.tipo,
        },
        ahora: new Date(),
      },
      estado,
      { texto: m.texto, tieneImagen: Boolean(imagen), nombre: contacto.nombre },
      "admin",
    );
    await almacen.guardar(m.de, nuevo);
    await enviarTexto(cfg, m.de, respuesta);
  } catch (e) {
    await procesados.liberar(`msg:${m.id}`);
    throw e;
  }
}

export async function procesarMensaje(cfg: Config, m: MensajeEntrante, procesados: RegistroProcesados, almacen: AlmacenEstado): Promise<void> {
  const contacto = cfg.contactos[m.de];
  if (!contacto) {
    console.warn(`Número no autorizado: ${m.de}`);
    return; // no se responde a desconocidos: evita gastar mensajes y dar pistas
  }
  const esAdmin = contacto.rol === "admin";
  if (/^\s*(ayuda|help|men[uú])\s*$/i.test(m.texto)) return enviarTexto(cfg, m.de, esAdmin ? AYUDA_ADMIN : AYUDA_IDEAS);
  if (m.tipo === "otro") return enviarTexto(cfg, m.de, "Ese tipo de mensaje todavía no lo leo. Mándalo como texto, link o foto.");
  if (m.tipo === "audio") return enviarTexto(cfg, m.de, "Todavía no escucho audios. Escríbemelo o mándalo como texto.");

  const imagen = m.tipo === "image" && m.mediaId ? await descargarMedia(cfg, m.mediaId).catch(() => undefined) : undefined;
  return esAdmin ? caminoAdmin(cfg, m, contacto, procesados, almacen, imagen) : caminoIdeas(cfg, m, contacto, procesados, imagen);
}

/** Procesa todos los mensajes del webhook sin que un error corte a los demás. */
export async function procesarTodos(
  cfg: Config,
  mensajes: MensajeEntrante[],
  procesados: RegistroProcesados = registroPorDefecto(),
  almacen: AlmacenEstado = estadoPorDefecto(),
): Promise<void> {
  // Mensajes de la misma persona en orden (el 2º puede depender del 1º: "y otro igual").
  const porPersona = new Map<string, MensajeEntrante[]>();
  for (const m of mensajes) porPersona.set(m.de, [...(porPersona.get(m.de) ?? []), m]);
  await Promise.all(
    [...porPersona.values()].map(async (lista) => {
      for (const m of lista) {
        try {
          await procesarMensaje(cfg, m, procesados, almacen);
        } catch (e) {
          console.error(`Error procesando ${m.id}`, e);
          await enviarTexto(cfg, m.de, "No pude procesar ese mensaje por un error. Reenvíalo en unos minutos.").catch(() => {});
        }
      }
    }),
  );
}
