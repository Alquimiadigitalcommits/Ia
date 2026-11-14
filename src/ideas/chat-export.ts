// Lee el .txt que genera WhatsApp con "Exportar chat" (Android y iPhone, español o inglés).

export interface MensajeChat {
  fecha: Date;
  autor: string;
  texto: string;
  adjunto?: string; // "imagen", "video", "audio", "sticker", "documento", "multimedia"
}

export interface IdeaAgrupada {
  fecha: Date;
  autor: string;
  texto: string;
  adjuntos: string[];
  mensajes: number;
}

// [14/11/26, 10:32:15] Tamara: hola           (iPhone)
// 14/11/2026, 10:32 - Tamara: hola            (Android)
// 14/11/26 10:32 p. m. - Tamara: hola         (Android 12 h)
const CABECERA =
  /^‎?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]+?):\s([\s\S]*)$/i;

const ADJUNTOS: [RegExp, string][] = [
  [/<multimedia omitido>|<media omitted>|archivo omitido/i, "multimedia"],
  [/imagen omitida|image omitted|\.(jpe?g|png|webp)\b.*(adjunto|attached)|PHOTO-/i, "imagen"],
  [/video omitido|video omitted|VIDEO-|\.mp4\b/i, "video"],
  [/audio omitido|audio omitted|AUDIO-|\.opus\b/i, "audio"],
  [/sticker omitido|sticker omitted/i, "sticker"],
  [/documento omitido|document omitted|\.pdf\b/i, "documento"],
];

const SISTEMA = /(creaste el grupo|created group|cifrados de extremo a extremo|end-to-end encrypted|se eliminó este mensaje|this message was deleted|eliminaste este mensaje|you deleted this message)/i;

const limpiarAdjunto = (t: string) =>
  t
    .replace(/<[^>]+>/g, "")
    .replace(/\b(imagen|video|audio|sticker|documento|gif|archivo|image|document)\s+(omitid[oa]|omitted)\b/gi, "")
    .replace(/\S+\.(jpe?g|png|webp|mp4|opus|pdf)\s*\((archivo adjunto|file attached)\)/gi, "")
    .trim();

function aFecha(d: string, m: string, a: string, h: string, min: string, s?: string, ampm?: string) {
  let hora = Number(h);
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && hora < 12) hora += 12;
    if (!pm && hora === 12) hora = 0;
  }
  const anio = a.length === 2 ? 2000 + Number(a) : Number(a);
  return new Date(anio, Number(m) - 1, Number(d), hora, Number(min), Number(s ?? 0));
}

export function leerChat(contenido: string): MensajeChat[] {
  const salida: MensajeChat[] = [];
  for (const lineaCruda of contenido.replace(/\r/g, "").split("\n")) {
    const linea = lineaCruda.replace(/[‎  ]/g, (c) => (c === "‎" ? "" : " "));
    const m = CABECERA.exec(linea);
    if (m) {
      const [, d, mes, a, h, min, s, ampm, autor, texto] = m;
      const adjunto = ADJUNTOS.find(([re]) => re.test(texto))?.[1];
      salida.push({
        fecha: aFecha(d, mes, a, h, min, s, ampm),
        autor: autor.trim(),
        texto: adjunto ? limpiarAdjunto(texto) : texto.trim(),
        adjunto,
      });
    } else if (salida.length && linea.trim()) {
      // Mensaje de varias líneas: sigue el anterior.
      salida[salida.length - 1].texto += `\n${linea}`;
    }
  }
  return salida.filter((x) => !SISTEMA.test(x.texto));
}

/**
 * Junta mensajes seguidos del mismo autor con menos de `minutos` entre ellos
 * (típico: pegar un link y después escribir la nota).
 */
export function agrupar(mensajes: MensajeChat[], minutos = 3): IdeaAgrupada[] {
  const ideas: IdeaAgrupada[] = [];
  let horaUltimoMensaje = 0;
  for (const m of mensajes) {
    const ultima = ideas[ideas.length - 1];
    const seguido = m.fecha.getTime() - horaUltimoMensaje <= minutos * 60_000;
    if (ultima && ultima.autor === m.autor && seguido) {
      if (m.texto) ultima.texto = ultima.texto ? `${ultima.texto}\n${m.texto}` : m.texto;
      if (m.adjunto) ultima.adjuntos.push(m.adjunto);
      ultima.mensajes++;
    } else {
      ideas.push({ fecha: m.fecha, autor: m.autor, texto: m.texto, adjuntos: m.adjunto ? [m.adjunto] : [], mensajes: 1 });
    }
    horaUltimoMensaje = m.fecha.getTime();
  }
  return ideas;
}
