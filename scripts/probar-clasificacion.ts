// Prueba solo la lectura del link y la clasificación con Claude, sin WhatsApp ni Notion:
//   npm run probar -- "reel rutina de noche con frutos secos #SaborASemilla"
//   npm run probar -- "https://www.tiktok.com/@cuenta/video/123 hacer mi versión"
import { extraerLinks, leerReferencias } from "../src/conectores/referencias.js";
import { clasificarIdea } from "../src/ideas/clasificar.js";
import { fichasComoTexto, nombresClientes } from "../src/nucleo/clientes.js";

try { process.loadEnvFile(".env"); } catch {} // .env es opcional
const texto = process.argv.slice(2).join(" ") || "Stream de Kick jugando el nuevo juego de terror el viernes";

const referencias = await leerReferencias(extraerLinks(texto));
for (const r of referencias) {
  console.log(`Link ${r.url}\n  autor: ${r.autor ?? "?"}\n  descripción: ${r.titulo ?? "(no se pudo leer)"}\n  portada: ${r.portada ? "sí" : "no"}`);
}
const idea = await clasificarIdea({ texto, remitente: "Tamara", referencias }, nombresClientes(), fichasComoTexto());
console.log(JSON.stringify(idea, null, 2));
