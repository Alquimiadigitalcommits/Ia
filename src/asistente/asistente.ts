// El asistente: recibe un mensaje, Claude elige herramientas, el SDK las ejecuta
// (validando con Zod) y vuelve a Claude hasta que tiene la respuesta final.

import Anthropic from "@anthropic-ai/sdk";
import type { EstadoPersona } from "../nucleo/estado.js";
import { fechaISO, ZONA } from "../personal/personal.js";
import { crearHerramientas, type ContextoHerramientas } from "./herramientas.js";

let client: Anthropic | undefined;
const claude = () => (client ??= new Anthropic());

export function instrucciones(ahora: Date, nombre: string, permisos: "admin" | "ideas") {
  const hoy = fechaISO(ahora);
  const hora = new Intl.DateTimeFormat("es-CL", { timeZone: ZONA, weekday: "long", hour: "2-digit", minute: "2-digit" }).format(ahora);
  if (permisos === "ideas") {
    return `Eres el bot de ideas de Alquimia Digital. Hablas con ${nombre}. Hoy es ${hoy} (${hora}, Chile).
Si el mensaje trae una idea de contenido, link o referencia, usa guardar_idea. Si no, responde en una frase qué puede mandar.
Responde corto, en español latino, sin lenguaje de anuncio.`;
  }
  return `Eres el asistente personal de ${nombre} por WhatsApp. Ordena su vida, la agencia Alquimia Digital y sus negocios.
Hoy es ${hoy} (${hora}, zona horaria de Chile).

Cómo decidir:
- Ideas de contenido, links de redes, referencias → guardar_idea.
- Agua, humor, kine, ejercicio, lectura, sueño → registrar_habito.
- Plata personal (comida, uber, arriendo, sueldo, ahorro) → registrar_finanza_personal.
- Plata de un negocio (Ropa, Calzado, Detalles, Dropshipping, Etsy, Alquimia Digital): venta → registrar_venta; materiales o productos para vender → registrar_compra; otros gastos del negocio → registrar_gasto_negocio.
- Proveedores que encontró → agregar_proveedor. Fechas, citas, cumpleaños, pagos → agregar_fecha_importante. Periodo → registrar_periodo.
- Preguntas ("¿cuánto he gastado?", "¿qué tengo hoy?") → consultar. "Borra eso", "me equivoqué" → deshacer_ultimo.
- Un mensaje puede traer varias cosas: usa varias herramientas.

Reglas:
- Chile: "luca" = 1.000 pesos, "5 lucas" = 5.000, "un palo" = 1.000.000. Montos en pesos enteros.
- Si no está claro si un gasto es personal o de un negocio, o falta un dato obligatorio (monto, precio, negocio), NO guardes: pregunta en una frase.
- No inventes datos. Fechas relativas ("mañana", "el viernes") conviértelas a YYYY-MM-DD desde hoy.
- Respuesta final: corta, datos antes que adjetivos, una línea por cosa guardada empezando con ✓. Sin lenguaje de anuncio.`;
}

export interface ResultadoAsistente {
  respuesta: string;
  estado: EstadoPersona;
}

export async function atender(
  ctx: Omit<ContextoHerramientas, "acciones" | "accionesPrevias">,
  estado: EstadoPersona,
  mensaje: { texto: string; tieneImagen: boolean; nombre: string },
  permisos: "admin" | "ideas",
): Promise<ResultadoAsistente> {
  const acciones: ContextoHerramientas["acciones"] = [];
  const accionesPrevias = [...(estado.ultimaAccion ?? [])];
  const herramientas = crearHerramientas({ ...ctx, acciones, accionesPrevias }, permisos);

  const texto = mensaje.texto || (mensaje.tieneImagen ? "(mandó una imagen sin texto)" : "");
  const historial: Anthropic.Beta.BetaMessageParam[] = estado.historial.map((h) => ({ role: h.rol, content: h.texto }));

  const final = await claude().beta.messages.toolRunner({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    max_iterations: 6,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: instrucciones(ctx.ahora, mensaje.nombre, permisos),
    tools: herramientas,
    messages: [...historial, { role: "user", content: texto + (mensaje.tieneImagen ? "\n[Adjuntó una imagen: si es referencia de contenido, guárdala con guardar_idea]" : "") }],
  });

  const respuesta =
    final.stop_reason === "refusal"
      ? "No pude procesar ese mensaje. Escríbelo de otra forma."
      : final.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim() || (acciones.length ? acciones.map((a) => `✓ ${a.resumen}`).join("\n") : "Listo.");

  return {
    respuesta,
    estado: {
      ...estado,
      historial: [...estado.historial, { rol: "user", texto }, { rol: "assistant", texto: respuesta }],
      // Si este mensaje guardó algo, eso es lo que se deshace después. Si solo consultó, se mantiene lo anterior.
      ultimaAccion: acciones.length ? acciones : accionesPrevias,
    },
  };
}
