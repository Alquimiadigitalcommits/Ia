// Prueba solo la parte de Claude, sin WhatsApp ni Notion:
//   npm run probar -- "idea: tiktok mostrando la rutina de noche con el serum nuevo #MarcaX"
import { clasificarIdea } from "../src/clasificar.js";

try { process.loadEnvFile(".env"); } catch {} // .env es opcional
const texto = process.argv.slice(2).join(" ") || "Hacer un stream de Kick jugando el nuevo juego de terror con la comunidad el viernes";
const clientes = (process.env.CLIENTES ?? "").split(",").map((c) => c.trim()).filter(Boolean);

const idea = await clasificarIdea({ texto, remitente: "Tamara" }, clientes);
console.log(JSON.stringify(idea, null, 2));
