// Aplica las migraciones pendientes en Supabase. Netlify lo corre en cada publicación.
// Si SUPABASE_DB_URL no está configurada, no hace nada (y lo dice).
import { bdPostgres } from "../src/datos/bd.js";
import { aplicarMigraciones, leerMigraciones } from "../src/datos/migraciones.js";

try { process.loadEnvFile(".env"); } catch {}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.log("SUPABASE_DB_URL no está configurada: no se aplicaron migraciones.");
  process.exit(0);
}
const bd = await bdPostgres(url);
try {
  const nuevas = await aplicarMigraciones(bd, await leerMigraciones("supabase/migrations"));
  console.log(nuevas.length ? `Migraciones aplicadas: ${nuevas.join(", ")}` : "La base ya estaba al día.");
} finally {
  await bd.cerrar();
}
