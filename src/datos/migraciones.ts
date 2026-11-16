// Aplica los archivos de supabase/migrations en orden, una sola vez cada uno.
// Guarda un "checksum" de cada archivo: si alguien edita una migración ya aplicada,
// se detiene en vez de dejar la base en un estado desconocido (se corrige con una migración nueva).

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BaseDatos } from "./bd.js";

export interface Migracion {
  nombre: string;
  sql: string;
}

export async function leerMigraciones(directorio: string): Promise<Migracion[]> {
  const archivos = (await readdir(directorio)).filter((f) => /^\d+_[a-z0-9_]+\.sql$/.test(f)).sort();
  return Promise.all(archivos.map(async (nombre) => ({ nombre, sql: await readFile(join(directorio, nombre), "utf8") })));
}

const checksum = (sql: string) => createHash("sha256").update(sql).digest("hex");

export async function aplicarMigraciones(bd: BaseDatos, migraciones: Migracion[]): Promise<string[]> {
  await bd.ejecutarComoAdmin(
    "create table if not exists _migraciones (nombre text primary key, checksum text not null, aplicada_en timestamptz not null default now())",
  );
  const aplicadas = new Map(
    (await bd.consultarComoAdmin<{ nombre: string; checksum: string }>("select nombre, checksum from _migraciones")).map((m) => [m.nombre, m.checksum]),
  );
  const nuevas: string[] = [];
  for (const m of migraciones) {
    const previa = aplicadas.get(m.nombre);
    if (previa) {
      if (previa !== checksum(m.sql)) throw new Error(`La migración ${m.nombre} fue modificada después de aplicarse. Crea una migración nueva en vez de editarla.`);
      continue;
    }
    await bd.ejecutarComoAdmin(`begin;\n${m.sql}\n;insert into _migraciones (nombre, checksum) values ('${m.nombre}', '${checksum(m.sql)}');\ncommit;`);
    nuevas.push(m.nombre);
  }
  return nuevas;
}
