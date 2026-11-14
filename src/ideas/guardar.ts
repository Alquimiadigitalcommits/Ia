// Guarda una idea en la base existente "Ideas y referencias" de Notion,
// relacionada con las fichas de la base Clientes.

import { bloque, escribir, type ClienteNotion } from "../conectores/notion.js";
import { extraerLinks, leerReferencias, type Referencia } from "../conectores/referencias.js";
import { CLIENTES, fichasComoTexto, nombresClientes } from "../nucleo/clientes.js";
import type { RegistroProcesados } from "../nucleo/idempotencia.js";
import { clasificarIdea, type IdeaClasificada } from "./clasificar.js";

export interface IdeaEntrante {
  /** Id único del origen (id del mensaje de WhatsApp o hash del chat importado). */
  idOrigen: string;
  fecha: Date;
  texto: string;
  remitente: string;
  origen: "WhatsApp" | "Importado del grupo";
  /** Si lo envía un cliente, su nombre tal como está en clientes.json. */
  clienteDelRemitente?: string;
  esCliente?: boolean;
  imagen?: { datos: Buffer; mimeType: string };
  tipoAdjunto?: string;
}

export interface IdeaGuardada {
  idea: IdeaClasificada | null;
  pagina: { id: string; url: string };
  referencias: Referencia[];
  clientes: string[];
}

const idNotionDe = (nombre: string) => CLIENTES.find((c) => c.nombre === nombre)?.notionId;

/** "#Plasok" en el mensaje → cliente Plasok (sin importar mayúsculas, espacios ni símbolos). */
export function clienteDesdeHashtag(texto: string, clientes = nombresClientes()): string | undefined {
  const normal = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");
  for (const tag of texto.match(/#([\p{L}\p{N}_.-]+)/gu) ?? []) {
    const t = normal(tag.slice(1));
    const encontrado = clientes.find((c) => normal(c) === t || normal(c.split("·")[0]) === t);
    if (encontrado) return encontrado;
  }
  return undefined;
}

/** Arma las propiedades de la fila según las columnas reales de "Ideas y referencias". */
export function propiedadesIdea(e: IdeaEntrante, idea: IdeaClasificada | null, referencias: Referencia[], clientes: string[]) {
  const idsClientes = clientes.map(idNotionDe).filter((x): x is string => Boolean(x));
  const fuente = e.esCliente ? "Cliente" : idea?.es_referencia ? "Referente" : idea?.caduca ? "Tendencia" : "Equipo";
  const props: Record<string, unknown> = {
    Idea: escribir.titulo(idea?.titulo || e.texto.slice(0, 70) || "Idea sin título"),
    Fuente: escribir.opcion(fuente),
  };
  if (idsClientes.length) props.Cliente = escribir.relacion(idsClientes);
  if (referencias[0]) props.Referencia = escribir.url(referencias[0].url);
  if (idea) {
    Object.assign(props, {
      Resumen: escribir.texto(idea.resumen),
      Formato: escribir.opcion(idea.formato),
      Nicho: escribir.texto(idea.nicho),
      "Plataforma potencial": escribir.opciones(idea.plataformas),
      Prioridad: escribir.opcion(idea.prioridad),
      Potencial: escribir.opcion(idea.clientes_sugeridos[0]?.encaje ?? "Bajo"),
    });
  }
  return props;
}

/** Contenido de la página: mensaje, referencias, a quién le sirve y estructura para grabar. */
export function bloquesIdea(e: IdeaEntrante, idea: IdeaClasificada | null, referencias: Referencia[]) {
  const b: object[] = [
    bloque.titulo3("Mensaje recibido"),
    bloque.cita(e.texto || "(sin texto)"),
    bloque.parrafo(`${e.origen} · ${e.remitente} · ${e.fecha.toLocaleString("es-CL", { timeZone: "America/Santiago" })}`),
  ];
  if (e.tipoAdjunto) b.push(bloque.parrafo(`Adjunto: ${e.tipoAdjunto}`));
  if (referencias.length) {
    b.push(bloque.titulo3("Referencias"));
    for (const r of referencias) {
      if (r.titulo || r.autor) b.push(bloque.parrafo(`${r.plataforma} · ${r.autor ?? "?"}: ${r.titulo ?? ""}`));
      b.push(bloque.marcador(r.url));
    }
  }
  if (!idea) {
    b.push(bloque.aviso("No se pudo clasificar automáticamente. Revisa y completa a mano.", "⚠️"));
    return b;
  }
  b.push(bloque.titulo3("De qué trata"), bloque.parrafo(idea.de_que_trata));
  b.push(bloque.titulo3("A quién le sirve"));
  if (!idea.clientes_sugeridos.length) b.push(bloque.parrafo("No calza claro con ningún cliente actual."));
  for (const c of idea.clientes_sugeridos) {
    b.push(
      bloque.aviso(`${c.cliente} · encaje ${c.encaje}\nPor qué: ${c.por_que}\nCómo adaptarlo: ${c.como_adaptarlo}`, c.encaje === "Alto" ? "🟢" : "🟡"),
    );
  }
  b.push(bloque.titulo3("Para grabar"), bloque.aviso(`Hook: ${idea.hook}`, "🎬"));
  for (const paso of idea.estructura) b.push(bloque.numerado(paso));
  const extras = [
    `Tipo: ${idea.tipo}`,
    idea.audio_o_tendencia ? `Audio o tendencia: ${idea.audio_o_tendencia}` : "",
    idea.caduca ? "Caduca pronto" : "",
    idea.tags.length ? `Etiquetas: ${idea.tags.join(", ")}` : "",
  ].filter(Boolean);
  b.push(bloque.parrafo(extras.join(" · ")));
  return b;
}

/**
 * Flujo completo de una idea:
 * reclamar id (no duplicar) → leer links → clasificar con Claude → crear fila en Notion.
 * Devuelve null si el id ya se había procesado.
 */
export async function guardarIdea(
  notion: ClienteNotion,
  databaseId: string,
  procesados: RegistroProcesados,
  e: IdeaEntrante,
): Promise<IdeaGuardada | null> {
  if (!(await procesados.reclamar(e.idOrigen))) return null;
  try {
    const clienteForzado = e.clienteDelRemitente ?? clienteDesdeHashtag(e.texto);
    const referencias = await leerReferencias(extraerLinks(e.texto));
    const idea = await clasificarIdea(
      { texto: e.texto, remitente: e.remitente, clienteAsignado: clienteForzado, imagen: e.imagen, referencias },
      nombresClientes(),
      fichasComoTexto(),
    );
    const clientes = [
      ...new Set([...(clienteForzado ? [clienteForzado] : []), ...(idea?.clientes_sugeridos.map((c) => c.cliente) ?? [])]),
    ];
    const pagina = await notion.crearPagina(
      databaseId,
      propiedadesIdea(e, idea, referencias, clientes),
      bloquesIdea(e, idea, referencias),
    );
    return { idea, pagina, referencias, clientes };
  } catch (error) {
    await procesados.liberar(e.idOrigen); // que un reintento sí pueda guardarla
    throw error;
  }
}
