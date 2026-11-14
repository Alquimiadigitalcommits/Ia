// Importa el historial del grupo "Ideas" a la base "Ideas y referencias" de Notion.
//
// 1. En WhatsApp: grupo Ideas → ⋮ / nombre del grupo → Exportar chat → Sin archivos.
// 2. Guarda el .txt (si viene en .zip, descomprímelo).
// 3. npm run importar -- ruta/al/chat.txt --prueba          (solo muestra cómo agruparía, sin gastar nada)
//    npm run importar -- ruta/al/chat.txt                   (importa todo)
//    npm run importar -- ruta/al/chat.txt --desde 2026-06-01 --minutos 5
//
// Se puede correr varias veces: lo que ya está en Notion se salta.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { crearClienteNotion } from "../src/conectores/notion.js";
import { agrupar, leerChat } from "../src/ideas/chat-export.js";
import { guardarIdea } from "../src/ideas/guardar.js";
import { registroArchivo } from "../src/nucleo/idempotencia.js";

try { process.loadEnvFile(".env"); } catch {} // .env es opcional

const args = process.argv.slice(2);
const opcion = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const valoresOpciones = [opcion("--desde"), opcion("--minutos")];
const archivo = args.find((a) => !a.startsWith("--") && !valoresOpciones.includes(a));
if (!archivo) {
  console.error("Uso: npm run importar -- chat.txt [--prueba] [--desde AAAA-MM-DD] [--minutos 3]");
  process.exit(1);
}
const prueba = args.includes("--prueba");
const desde = opcion("--desde") ? new Date(opcion("--desde")!) : undefined;
const minutos = Number(opcion("--minutos") ?? 3);

const mensajes = leerChat(readFileSync(archivo, "utf8"));
const todas = agrupar(mensajes, minutos).filter((i) => !desde || i.fecha >= desde);
// El chat se exporta sin archivos: una foto sola, sin texto, no deja nada que guardar.
const ideas = todas.filter((i) => i.texto.trim());
console.log(
  `${mensajes.length} mensajes → ${ideas.length} ideas` +
    ` (se omiten ${todas.length - ideas.length} que eran solo foto/video/audio sin texto)`,
);

if (prueba) {
  for (const i of ideas.slice(0, 15)) {
    const extra = i.adjuntos.length ? ` [${i.adjuntos.join(", ")}]` : "";
    console.log(`\n${i.fecha.toLocaleString("es-CL")} · ${i.mensajes} msj${extra}\n  ${i.texto.replace(/\n/g, "\n  ")}`);
  }
  if (ideas.length > 15) console.log(`\n... y ${ideas.length - 15} más`);
  process.exit(0);
}

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DB_IDEAS || "c2b5071b2e6d48c384d748b77ac1ab8b";
if (!token || !process.env.ANTHROPIC_API_KEY) {
  console.error("Faltan NOTION_TOKEN o ANTHROPIC_API_KEY en .env");
  process.exit(1);
}
const notion = crearClienteNotion(token);
// Junto al chat queda "chat.txt.importados.json" con lo ya importado.
const procesados = registroArchivo(`${archivo}.importados.json`);

let creadas = 0, saltadas = 0, errores = 0, sinClasificar = 0;
const cola = [...ideas];
async function trabajador() {
  for (let i = cola.shift(); i; i = cola.shift()) {
    const id = "chat-" + createHash("sha1").update(`${i.fecha.toISOString()}|${i.texto}`).digest("hex").slice(0, 16);
    try {
      const r = await guardarIdea(notion, databaseId, procesados, {
        idOrigen: id,
        fecha: i.fecha,
        texto: i.texto,
        remitente: i.autor,
        origen: "Importado del grupo",
        tipoAdjunto: i.adjuntos.length ? i.adjuntos.join(", ") : undefined,
      });
      if (!r) saltadas++;
      else {
        creadas++;
        if (!r.idea) sinClasificar++;
        console.log(`✓ ${r.idea?.titulo ?? i.texto.slice(0, 60)}  →  ${r.clientes.join(", ") || "sin cliente"}`);
      }
    } catch (e) {
      errores++;
      console.error(`✗ ${i.texto.slice(0, 60)}:`, (e as Error).message);
    }
  }
}
// 3 en paralelo: con los reintentos del conector, respeta el límite de Notion.
await Promise.all([trabajador(), trabajador(), trabajador()]);
console.log(`\nListo. Creadas: ${creadas} (sin clasificar: ${sinClasificar}) · Ya existían: ${saltadas} · Errores: ${errores}`);
