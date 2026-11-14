import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  FORMATOS,
  NICHOS,
  PILARES,
  PLATAFORMAS,
  PRIORIDADES,
  TIPOS_TIKTOK,
} from "./config.js";
import type { Referencia } from "./referencias.js";

let client: Anthropic | undefined;
const claude = () => (client ??= new Anthropic());

// ─────────────────────────── Esquemas ───────────────────────────

export function esquemaIdea(clientes: string[]) {
  return z.object({
    titulo: z.string().describe("Título corto de la idea, máximo 80 caracteres, sin emojis"),
    resumen: z.string().describe("1 a 3 frases: qué se grabaría y para qué"),
    cliente: z.enum(["Sin asignar", ...clientes.filter((c) => c !== "Sin asignar")] as [string, ...string[]]),
    plataformas: z.array(z.enum(PLATAFORMAS)),
    formato: z.enum(FORMATOS),
    pilar: z.enum(PILARES),
    prioridad: z.enum(PRIORIDADES),
    hook: z.string().describe("Primera frase del video o portada, máximo 15 palabras"),
    tags: z.array(z.string()).describe("2 a 5 etiquetas en minúscula"),
    es_referencia_externa: z
      .boolean()
      .describe("true si el mensaje es principalmente un link o captura de contenido de otra cuenta"),
  });
}
export type IdeaClasificada = z.infer<ReturnType<typeof esquemaIdea>>;

export function esquemaTikTok(clientes: string[]) {
  return z.object({
  titulo: z.string().describe("Título corto, máximo 70 caracteres, sin emojis"),
  de_que_trata: z
    .string()
    .describe(
      "Qué muestra o cuenta el video de referencia según portada, descripción y hashtags. Si no hay referencia, qué se mostraría",
    ),
  clientes_sugeridos: z
    .array(
      z.object({
        cliente: z.enum(clientes as [string, ...string[]]),
        encaje: z.enum(["Alto", "Medio"]),
        por_que: z.string().describe("Qué del video conecta con el rubro, público o temas del cliente. 1 frase"),
        como_adaptarlo: z.string().describe("Versión concreta para ese cliente: qué se graba, con qué producto o lugar. 1-2 frases"),
      }),
    )
    .describe("De 0 a 3 clientes, del mejor encaje al menor. Vacío si no le sirve a ninguno"),
  nicho: z.enum(NICHOS),
  tipo: z.enum(TIPOS_TIKTOK),
  resumen: z.string().describe("1 a 3 frases: qué se graba y qué se lleva quien lo ve"),
  hook: z.string().describe("Lo primero que se dice o aparece en pantalla, máximo 12 palabras"),
  estructura: z
    .array(z.string())
    .describe("3 a 5 pasos cortos del video en orden. Basados en el mensaje; no inventes productos ni lugares"),
  audio_o_tendencia: z.string().describe('Audio, trend o formato viral que se usa. "" si no hay'),
  caduca: z.boolean().describe("true si depende de una tendencia, fecha o evento que pasa pronto"),
  prioridad: z.enum(PRIORIDADES),
  tags: z.array(z.string()).describe("2 a 5 etiquetas en minúscula"),
  es_referencia: z.boolean().describe("true si es principalmente un video de otra cuenta para inspirarse"),
  });
}
export type IdeaTikTok = z.infer<ReturnType<typeof esquemaTikTok>>;

// ─────────────────────────── Prompts ───────────────────────────

const REGLAS = `- Español latino, neutro, sin lenguaje de anuncio ni adjetivos vacíos.
- No inventes datos que no estén en el mensaje o en la referencia.`;

const SISTEMA_AGENCIA = `Eres el asistente de Alquimia Digital, agencia que gestiona redes sociales de marcas y creadores.
Recibes mensajes de WhatsApp con ideas de contenido, a veces desordenados, con links o fotos. Ordena la idea para guardarla en Notion.
${REGLAS}
- Si falta algo, usa "Sin definir" o "Sin asignar".
- Si el remitente ya tiene cliente asignado, usa ese cliente. Si el mensaje trae "#Nombre", ese es el cliente.
- Prioridad Alta solo si hay fecha cercana, tendencia con caducidad o el mensaje lo pide.`;

const sistemaTikTok = (fichas: string) => `Ordenas el banco de ideas de Tamara, dueña de la agencia Alquimia Digital y creadora de contenido (videojuegos en Kick, lifestyle, skincare, panoramas).
Ella guarda TikToks de otras cuentas, frases sueltas y capturas. Tu trabajo: entender de qué trata cada video y decidir a qué cliente de la agencia le sirve, incluidas las cuentas internas (marca personal, Medio Relato, la propia agencia).
${REGLAS}
- Para entender el video usa, en este orden: la portada (imagen), la descripción y hashtags del link, y lo que ella escribió.
- Si solo hay link y no llegaron datos del video, dilo en "de_que_trata" y no adivines el contenido.
- Sugiere un cliente solo si el tema, el formato o el público del video conectan con su ficha. Mejor 1 cliente bien justificado que 3 forzados.
- Respeta lo que cada cliente debe evitar.
- Nicho "Otro" solo si no calza con ninguno.
- Prioridad Alta si caduca pronto o ella marca urgencia ("ya", "hoy", "urgente", "!!").

Fichas de clientes:
${fichas}`;

// ─────────────────────────── Llamada común ───────────────────────────

export interface Entrada {
  texto: string;
  remitente: string;
  clienteAsignado?: string;
  imagen?: { datos: Buffer; mimeType: string };
  referencias?: Referencia[];
}

function armarContenido(e: Entrada, extra: string[]): Anthropic.Beta.BetaContentBlockParam[] {
  const contenido: Anthropic.Beta.BetaContentBlockParam[] = [];
  const imagenes = [
    ...(e.imagen ? [{ img: e.imagen, rotulo: "Imagen que mandó por WhatsApp:" }] : []),
    ...(e.referencias ?? [])
      .filter((r) => r.portada)
      .map((r) => ({ img: r.portada!, rotulo: `Portada del video ${r.url}:` })),
  ];
  for (const { img, rotulo } of imagenes) {
    if (!/^image\/(jpeg|png|gif|webp)$/.test(img.mimeType)) continue;
    contenido.push({ type: "text", text: rotulo });
    contenido.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: img.datos.toString("base64"),
      },
    });
  }
  const refs = (e.referencias ?? []).map(
    (r) => `- ${r.plataforma} de ${r.autor ?? "autor desconocido"}: "${r.titulo ?? "(sin descripción)"}" ${r.url}`,
  );
  contenido.push({
    type: "text",
    text: [
      `Remitente: ${e.remitente}`,
      ...extra,
      refs.length ? `Datos de los links:\n${refs.join("\n")}` : "",
      "",
      "Mensaje:",
      e.texto || "(sin texto, solo adjunto)",
    ].join("\n"),
  });
  return contenido;
}

async function pedir<T extends z.ZodType>(
  esquema: T,
  sistema: string,
  contenido: Anthropic.Beta.BetaContentBlockParam[],
): Promise<z.infer<T> | null> {
  try {
    const res = await claude().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(esquema) },
      // Si el modelo rechaza el pedido, la API lo reintenta con un modelo de respaldo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: sistema,
      messages: [{ role: "user", content: contenido }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      console.warn("Clasificación vacía", res.stop_reason);
      return null;
    }
    return res.parsed_output as z.infer<T>;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.error("Claude: límite de uso alcanzado");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Claude error ${error.status}:`, error.message);
    } else {
      console.error("Claude error:", error);
    }
    return null;
  }
}

/** Ideas de clientes / agencia. Devuelve null si falla (la idea igual se guarda). */
export function clasificarIdea(e: Entrada, clientes: string[]) {
  return pedir(
    esquemaIdea(clientes),
    SISTEMA_AGENCIA,
    armarContenido(e, [
      `Cliente asignado al remitente: ${e.clienteAsignado ?? "ninguno"}`,
      `Clientes válidos: ${clientes.join(", ") || "ninguno"}`,
    ]),
  ) as Promise<IdeaClasificada | null>;
}

/** Ideas personales de TikTok. Devuelve null si falla (la idea igual se guarda). */
export function clasificarIdeaTikTok(e: Entrada, clientes: string[], fichas: string) {
  return pedir(esquemaTikTok(clientes), sistemaTikTok(fichas), armarContenido(e, [])) as Promise<IdeaTikTok | null>;
}
