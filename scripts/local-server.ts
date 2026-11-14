// Servidor local para probar con ngrok:  npm run dev  →  ngrok http 3000
// Usa la misma lógica que la función de Netlify.
import { createServer } from "node:http";
import { cargarConfig } from "../src/config.js";
import { procesarTodos } from "../src/procesar.js";
import { extraerMensajes, firmaValida, verificarWebhook } from "../src/whatsapp.js";

try { process.loadEnvFile(".env"); } catch {} // .env es opcional
const cfg = cargarConfig();
const PUERTO = Number(process.env.PORT ?? 3000);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PUERTO}`);
  if (url.pathname !== "/webhook") {
    res.writeHead(404).end();
    return;
  }

  if (req.method === "GET") {
    const challenge = verificarWebhook(url.searchParams, cfg.whatsapp.verifyToken);
    res.writeHead(challenge ? 200 : 403).end(challenge ?? "Token inválido");
    return;
  }

  let cuerpo = "";
  for await (const chunk of req) cuerpo += chunk;
  const firma = req.headers["x-hub-signature-256"];
  if (!firmaValida(cuerpo, typeof firma === "string" ? firma : null, cfg.whatsapp.appSecret)) {
    res.writeHead(401).end("Firma inválida");
    return;
  }
  res.writeHead(200).end("ok");
  void procesarTodos(cfg, extraerMensajes(JSON.parse(cuerpo)));
}).listen(PUERTO, () => console.log(`Webhook escuchando en http://localhost:${PUERTO}/webhook`));
