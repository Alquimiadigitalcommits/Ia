import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { FORMATOS, NICHOS, PLATAFORMAS, PRIORIDADES, TIPOS_VIDEO } from "../nucleo/config.js";
import type { Referencia } from "../conectores/referencias.js";

let client: Anthropic | undefined;
const claude = () => (client ??= new Anthropic());

// ─────────────────────────── Esquema único de idea ───────────────────────────
// Sirve para ideas de clientes, del equipo y para los TikToks que guarda Tamara.
// Las opciones salen de nucleo/config.ts, que copia las de la base "Ideas y referencias".

export function esquemaIdea(clientes: string[]) {
  const lista = (clientes.length ? clientes : ["Sin cliente"]) as [string, ...string[]];
  return z.object({
    titulo: z.string().describe("Título corto, máximo 70 caracteres, sin emojis"),
    de_que_trata: z
      .string()
      .describe("Qué muestra o cuenta la referencia (portada, descripción, hashtags) o qué se grabaría si no hay referencia"),
    resumen: z.string().describe("1 a 3 frases: qué se graba y qué se lleva quien lo ve"),
    clientes_sugeridos: z
      .array(
        z.object({
          cliente: z.enum(lista),
          encaje: z.enum(["Alto", "Medio"]),
          por_que: z.string().describe("Qué conecta con el rubro, público o temas del cliente. 1 frase"),
          como_adaptarlo: z.string().describe("Versión concreta para ese cliente. 1-2 frases"),
        }),
      )
      .describe("De 0 a 3 clientes, del mejor encaje al menor"),
    plataformas: z.array(z.enum(PLATAFORMAS)),
    formato: z.enum(FORMATOS),
    nicho: z.enum(NICHOS),
    tipo: z.enum(TIPOS_VIDEO),
    hook: z.string().describe("Lo primero que se dice o aparece en pantalla, máximo 12 palabras"),
    estructura: z.array(z.string()).describe("3 a 5 pasos cortos en orden. No inventes productos ni lugares"),
    audio_o_tendencia: z.string().describe('Audio, trend o formato viral que usa. "" si no hay'),
    caduca: z.boolean().describe("true si depende de una tendencia, fecha o evento que pasa pronto"),
    prioridad: z.enum(PRIORIDADES),
    tags: z.array(z.string()).describe("2 a 5 etiquetas en minúscula"),
    es_referencia: z.boolean().describe("true si es principalmente contenido de otra cuenta para inspirarse"),
  });
}
export type IdeaClasificada = z.infer<ReturnType<typeof esquemaIdea>>;

// ─────────────────────────── Prompt ───────────────────────────

const sistema = (fichas: string) => `Ordenas el banco de ideas de Alquimia Digital, agencia de redes sociales. Su dueña también es creadora de contenido.
Llegan por WhatsApp: frases sueltas, links de TikTok/YouTube de otras cuentas, capturas, ideas de clientes.
Tu trabajo: entender de qué trata cada idea o video y decidir a qué cliente le sirve, incluidas las cuentas internas.
- Español latino, neutro, sin lenguaje de anuncio ni adjetivos vacíos.
- No inventes datos que no estén en el mensaje o en la referencia.
- Para entender un video usa, en este orden: la portada (imagen), la descripción y hashtags del link, y lo que escribió la persona.
- Si solo hay link y no llegaron datos del video, dilo en "de_que_trata" y no adivines el contenido.
- Si el remitente ya tiene cliente asignado, ese cliente va primero en clientes_sugeridos con encaje Alto. Si el mensaje trae "#Nombre", ese es el cliente.
- Sugiere otros clientes solo si el tema, formato o público conectan con su ficha. Mejor 1 bien justificado que 3 forzados.
- Respeta lo que cada cliente debe evitar.
- Prioridad Alta si caduca pronto o hay urgencia ("ya", "hoy", "urgente", "!!").

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

/** Clasifica una idea. Devuelve null si falla: la idea igual se guarda sin clasificar. */
export function clasificarIdea(e: Entrada, clientes: string[], fichas: string) {
  return pedir(
    esquemaIdea(clientes),
    sistema(fichas),
    armarContenido(e, [`Cliente asignado al remitente: ${e.clienteAsignado ?? "ninguno"}`]),
  ) as Promise<IdeaClasificada | null>;
}
