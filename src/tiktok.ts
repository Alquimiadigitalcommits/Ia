import { clasificarIdeaTikTok } from "./clasificar.js";
import { crearIdeaTikTok, yaGuardado, type Destino } from "./notion.js";
import { extraerLinks, leerReferencias } from "./referencias.js";

export interface IdeaCruda {
  idOrigen: string;
  fecha: Date;
  texto: string;
  origen: "WhatsApp" | "Importado del grupo";
  imagen?: { datos: Buffer; mimeType: string };
  tipoAdjunto?: string;
}

/** Lee links → clasifica con Claude → crea la página. Devuelve null si ya existía. */
export async function guardarIdeaTikTok(d: Destino, c: IdeaCruda) {
  if (await yaGuardado(d, c.idOrigen)) return null;
  const referencias = await leerReferencias(extraerLinks(c.texto));
  const idea = await clasificarIdeaTikTok({
    texto: c.texto,
    remitente: "Tamara",
    imagen: c.imagen,
    referencias,
  });
  const pagina = await crearIdeaTikTok(d, {
    idOrigen: c.idOrigen,
    fecha: c.fecha,
    mensajeOriginal: c.texto,
    referencias,
    tipoAdjunto: c.tipoAdjunto,
    origen: c.origen,
    idea,
  });
  return { idea, pagina };
}
