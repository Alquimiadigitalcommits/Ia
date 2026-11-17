// Aplica las migraciones pendientes con un usuario que pueda cambiar la estructura de la base.
// El usuario de la API (SUPABASE_DB_URL) NO puede hacerlo a propósito: mínimo privilegio.
// En producción las migraciones se aplican desde Supabase; este script sirve para otros entornos.
// Si SUPABASE_MIGRACIONES_URL no está configurada, no hace nada (y lo dice).
import { bdPostgres } from "../src/datos/bd.js";
import { aplicarMigraciones, leerMigraciones } from "../src/datos/migraciones.js";

try { process.loadEnvFile(".env"); } catch {}
const url = process.env.SUPABASE_MIGRACIONES_URL;
if (!url) {
  console.log("SUPABASE_MIGRACIONES_URL no está configurada: las migraciones se aplican desde Supabase.");
  process.exit(0);
}
const bd = await bdPostgres(url);
try {
  const nuevas = await aplicarMigraciones(bd, await leerMigraciones("supabase/migrations"));
  console.log(nuevas.length ? `Migraciones aplicadas: ${nuevas.join(", ")}` : "La base ya estaba al día.");
} finally {
  await bd.cerrar();
}
