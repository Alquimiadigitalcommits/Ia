import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { FORMATOS, PILARES, PLATAFORMAS, PRIORIDADES } from "./config.js";

const client = new Anthropic();

export function esquemaIdea(clientes: string[]) {
  const listaClientes = clientes;
  return z.object({
    titulo: z.string().describe("Título corto de la idea, máximo 80 caracteres, sin emojis"),
    resumen: z.string().describe("1 a 3 frases: qué se grabaría y para qué"),
    cliente: z.enum(["Sin asignar", ...listaClientes.filter((c) => c !== "Sin asignar")] as [string, ...string[]]),
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

const SISTEMA = `Eres el asistente de Alquimia Digital, agencia chilena que gestiona redes sociales de marcas y creadores (gaming en Kick, lifestyle, skincare, panoramas en TikTok, Instagram y YouTube).
Recibes mensajes de WhatsApp con ideas de contenido, a veces desordenados, con audios transcritos, links o fotos.
Tu trabajo es ordenar la idea para guardarla en Notion. Reglas:
- Español latino, neutro, sin lenguaje de anuncio ni adjetivos vacíos.
- No inventes datos que no estén en el mensaje. Si falta algo, usa "Sin definir" o "Sin asignar".
- Si el remitente ya tiene cliente asignado, usa ese cliente.
- Si el mensaje trae "#Nombre", ese es el cliente.
- Prioridad Alta solo si hay fecha cercana, tendencia con caducidad o el mensaje lo pide.`;

export interface EntradaClasificacion {
  texto: string;
  remitente: string;
  clienteAsignado?: string;
  imagen?: { datos: Buffer; mimeType: string };
}

/** Devuelve la idea ordenada, o null si Claude no pudo (la idea igual se guarda sin clasificar). */
export async function clasificarIdea(
  entrada: EntradaClasificacion,
  clientes: string[],
): Promise<IdeaClasificada | null> {
  const contenido: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (entrada.imagen && /^image\/(jpeg|png|gif|webp)$/.test(entrada.imagen.mimeType)) {
    contenido.push({
      type: "image",
      source: {
        type: "base64",
        media_type: entrada.imagen.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: entrada.imagen.datos.toString("base64"),
      },
    });
  }
  contenido.push({
    type: "text",
    text: [
      `Remitente: ${entrada.remitente}`,
      `Cliente asignado al remitente: ${entrada.clienteAsignado ?? "ninguno"}`,
      `Clientes válidos: ${clientes.join(", ") || "ninguno"}`,
      "",
      "Mensaje:",
      entrada.texto || "(sin texto, solo adjunto)",
    ].join("\n"),
  });

  try {
    const res = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(esquemaIdea(clientes)) },
      // Si el modelo rechaza el pedido, la API lo reintenta con un modelo de respaldo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SISTEMA,
      messages: [{ role: "user", content: contenido }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      console.warn("Clasificación vacía", res.stop_reason);
      return null;
    }
    return res.parsed_output;
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
