// Prueba solo la parte de Claude (y la lectura del link), sin WhatsApp ni Notion:
//   npm run probar -- "reel rutina de noche con el serum nuevo #MarcaX"
//   npm run probar -- --tiktok "https://www.tiktok.com/@cuenta/video/123 hacer mi versión"
import { clasificarIdea, clasificarIdeaTikTok } from "../src/clasificar.js";
import { fichasComoTexto, nombresClientes } from "../src/clientes.js";
import { extraerLinks, leerReferencias } from "../src/referencias.js";

try { process.loadEnvFile(".env"); } catch {} // .env es opcional
const args = process.argv.slice(2);
const tiktok = args.includes("--tiktok");
const texto = args.filter((a) => a !== "--tiktok").join(" ") || "Stream de Kick jugando el nuevo juego de terror el viernes";

const referencias = await leerReferencias(extraerLinks(texto));
for (const r of referencias) {
  console.log(`Link ${r.url}\n  autor: ${r.autor ?? "?"}\n  descripción: ${r.titulo ?? "(no se pudo leer)"}\n  portada: ${r.portada ? "sí" : "no"}`);
}
const idea = tiktok
  ? await clasificarIdeaTikTok({ texto, remitente: "Tamara", referencias }, nombresClientes(), fichasComoTexto())
  : await clasificarIdea({ texto, remitente: "Tamara", referencias }, nombresClientes());
console.log(JSON.stringify(idea, null, 2));
