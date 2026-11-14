import { createHmac, timingSafeEqual } from "node:crypto";
import type { Config } from "../nucleo/config.js";

/** Mensaje entrante ya normalizado (solo lo que usamos). */
export interface MensajeEntrante {
  id: string;
  de: string; // número del remitente, formato internacional sin "+"
  nombrePerfil?: string;
  fecha: Date;
  tipo: "text" | "image" | "audio" | "video" | "document" | "otro";
  texto: string; // cuerpo del texto o caption del adjunto
  mediaId?: string;
  mimeType?: string;
}

/** GET de verificación que hace Meta al registrar el webhook. */
export function verificarWebhook(params: URLSearchParams, verifyToken: string): string | null {
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken) {
    return params.get("hub.challenge");
  }
  return null;
}

/** Valida la cabecera X-Hub-Signature-256 contra el cuerpo crudo. */
export function firmaValida(cuerpoCrudo: string, firma: string | null, appSecret: string): boolean {
  if (!appSecret) return true; // sin secret configurado no se valida (solo para pruebas locales)
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", appSecret).update(cuerpoCrudo).digest("hex");
  const a = Buffer.from(firma.slice(7), "hex");
  const b = Buffer.from(esperada, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Extrae los mensajes del payload del webhook. Ignora estados (entregado/leído). */
export function extraerMensajes(payload: any): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const nombres = new Map<string, string>(
        (value?.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]),
      );
      for (const m of value?.messages ?? []) {
        const base = {
          id: m.id,
          de: m.from,
          nombrePerfil: nombres.get(m.from),
          fecha: new Date(Number(m.timestamp) * 1000),
        };
        switch (m.type) {
          case "text":
            salida.push({ ...base, tipo: "text", texto: m.text?.body ?? "" });
            break;
          case "image":
          case "video":
          case "document":
          case "audio": {
            const media = m[m.type];
            salida.push({
              ...base,
              tipo: m.type,
              texto: media?.caption ?? "",
              mediaId: media?.id,
              mimeType: media?.mime_type,
            });
            break;
          }
          default:
            salida.push({ ...base, tipo: "otro", texto: "" });
        }
      }
    }
  }
  return salida;
}

export async function enviarTexto(cfg: Config, para: string, texto: string): Promise<void> {
  const { apiVersion, phoneNumberId, token } = cfg.whatsapp;
  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto, preview_url: true },
    }),
  });
  if (!res.ok) console.error("WhatsApp enviarTexto", res.status, await res.text());
}

/** Descarga un adjunto (2 pasos: pedir URL temporal y luego bajar el binario). */
export async function descargarMedia(
  cfg: Config,
  mediaId: string,
): Promise<{ datos: Buffer; mimeType: string }> {
  const { apiVersion, token } = cfg.whatsapp;
  const auth = { Authorization: `Bearer ${token}` };
  const info = await fetch(`https://graph.facebook.com/${apiVersion}/${mediaId}`, { headers: auth });
  if (!info.ok) throw new Error(`No se pudo obtener el media ${mediaId}: ${info.status}`);
  const { url, mime_type } = (await info.json()) as { url: string; mime_type: string };
  const bin = await fetch(url, { headers: auth });
  if (!bin.ok) throw new Error(`No se pudo descargar el media ${mediaId}: ${bin.status}`);
  return { datos: Buffer.from(await bin.arrayBuffer()), mimeType: mime_type };
}
