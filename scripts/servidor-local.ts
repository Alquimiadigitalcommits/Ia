// Servidor local de desarrollo: la app real + la API real + Postgres real (PGlite), sin Supabase.
// Usa una persona fija ("modo local"). NUNCA se publica: se niega a correr dentro de Netlify.
//
//   npm run local            → construye la app en modo local y abre http://localhost:8787
//   npm run local -- --sin-construir
//
// Los datos quedan en .local/pglite (ignorada por Git).

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { manejarApi } from "../src/api/router.js";
import { bdPGlite } from "../src/datos/bd.js";
import { aplicarMigraciones, leerMigraciones } from "../src/datos/migraciones.js";

if (process.env.NETLIFY) {
  console.error("El servidor local no se ejecuta en Netlify.");
  process.exit(1);
}

const PUERTO = Number(process.env.PORT ?? 8787);
const USUARIO_LOCAL = "00000000-0000-4000-8000-000000000001";
const DIR = "dist-local";

if (!process.argv.includes("--sin-construir")) {
  execSync(`npx vite build --outDir ../${DIR}`, { stdio: "inherit", env: { ...process.env, VITE_MODO_LOCAL: "1" } });
}

mkdirSync(".local", { recursive: true });
const bd = await bdPGlite(process.argv.includes("--memoria") ? undefined : ".local/pglite");
await bd.ejecutarComoAdmin(readFileSync("supabase/local/supabase-simulado.sql", "utf8"));
const nuevas = await aplicarMigraciones(bd, await leerMigraciones("supabase/migrations"));
if (nuevas.length) console.log("Migraciones aplicadas:", nuevas.join(", "));

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json", ".map": "application/json",
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PUERTO}`);
  try {
    if (url.pathname.startsWith("/api/v1")) {
      const cuerpo = req.method === "GET" || req.method === "HEAD" ? undefined : await new Promise<string>((ok) => { let t = ""; req.on("data", (c) => (t += c)); req.on("end", () => ok(t)); });
      const r = await manejarApi(
        new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: cuerpo }),
        { bd: async () => bd, verificar: async (t) => (t === "local" ? { id: USUARIO_LOCAL, email: "local@mi-dia", nombre: "Tamara" } : null) },
      );
      res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const ruta = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
    let archivo = join(DIR, ruta);
    let contenido: Buffer;
    try {
      contenido = readFileSync(archivo);
    } catch {
      archivo = join(DIR, "index.html"); // rutas de la app (SPA)
      contenido = readFileSync(archivo);
    }
    res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
    res.end(contenido);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
}).listen(PUERTO, () => console.log(`Mi día (modo local) en http://localhost:${PUERTO}`));
