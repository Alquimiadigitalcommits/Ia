import type { Context } from "@netlify/functions";
import { cargarConfig } from "../../src/nucleo/config.js";
import { procesarTodos } from "../../src/canales/whatsapp.js";
import { extraerMensajes, firmaValida, verificarWebhook } from "../../src/conectores/whatsapp.js";

export default async (req: Request, context: Context) => {
  const cfg = cargarConfig();

  if (req.method === "GET") {
    const challenge = verificarWebhook(new URL(req.url).searchParams, cfg.whatsapp.verifyToken);
    return challenge ? new Response(challenge) : new Response("Token inválido", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const cuerpo = await req.text();
  if (!firmaValida(cuerpo, req.headers.get("x-hub-signature-256"), cfg.whatsapp.appSecret)) {
    return new Response("Firma inválida", { status: 401 });
  }

  const mensajes = extraerMensajes(JSON.parse(cuerpo));
  // Meta exige respuesta rápida: respondemos 200 y seguimos procesando en segundo plano.
  context.waitUntil(procesarTodos(cfg, mensajes));
  return new Response("ok");
};
