import { readFile } from "node:fs/promises";
import { bdPGlite, type BaseDatos, type Contexto } from "../src/datos/bd.js";
import { aplicarMigraciones, leerMigraciones } from "../src/datos/migraciones.js";

export const ANA = "11111111-1111-4111-8111-111111111111";
export const BETO = "22222222-2222-4222-8222-222222222222";

/** Postgres real en memoria con el mismo esquema y las mismas reglas que Supabase. */
export async function bdDePrueba(): Promise<BaseDatos> {
  const bd = await bdPGlite();
  await bd.ejecutarComoAdmin(await readFile("supabase/local/supabase-simulado.sql", "utf8"));
  await aplicarMigraciones(bd, await leerMigraciones("supabase/migrations"));
  return bd;
}

export const web = (usuarioId = ANA): Contexto => ({ usuarioId, canal: "web" });
export const whatsapp = (usuarioId = ANA): Contexto => ({ usuarioId, canal: "whatsapp" });
