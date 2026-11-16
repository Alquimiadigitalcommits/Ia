// Acceso a Postgres. Cada operación corre dentro de una transacción "como la persona":
//   SET LOCAL ROLE authenticated + request.jwt.claims = { sub: usuarioId } + app.canal
// Así las políticas RLS de la base deciden qué se puede ver y escribir, igual que en Supabase.
// Aunque la API tuviera un error, la base no entrega datos de otra persona ni de un área no autorizada.

import type { Canal } from "../../shared/modulos.js";

export type Fila = Record<string, any>;
export type Consulta = <T extends Fila = Fila>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface Contexto {
  usuarioId: string;
  canal: Canal;
}

export interface BaseDatos {
  transaccion<T>(ctx: Contexto, fn: (q: Consulta) => Promise<T>): Promise<T>;
  /** Sin RLS, solo para migraciones. */
  ejecutarComoAdmin(sql: string): Promise<void>;
  consultarComoAdmin<T extends Fila = Fila>(sql: string, params?: unknown[]): Promise<T[]>;
  cerrar(): Promise<void>;
}

// Tipos de Postgres: "date" (1082) se entrega como texto AAAA-MM-DD (si se convierte a Date de
// JavaScript, el día se corre según la zona horaria del servidor); "numeric" (1700) como número.
const OID_DATE = 1082;
const OID_NUMERIC = 1700;
const aNumero = (v: string) => (v === null ? null : Number(v));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que se ejecuta al comenzar cada transacción. */
export function preparacion(ctx: Contexto): { sql: string; params: unknown[] }[] {
  if (!UUID.test(ctx.usuarioId)) throw new Error("Usuario no válido");
  return [
    { sql: "select set_config('request.jwt.claims', $1, true)", params: [JSON.stringify({ sub: ctx.usuarioId, role: "authenticated" })] },
    { sql: "select set_config('app.canal', $1, true)", params: [ctx.canal] },
    { sql: "set local role authenticated", params: [] },
  ];
}

// ─────────────────────────── Producción: Supabase vía pg ───────────────────────────

export async function bdPostgres(connectionString: string): Promise<BaseDatos> {
  const { default: pg } = await import("pg");
  pg.types.setTypeParser(OID_DATE, (v: string) => v);
  pg.types.setTypeParser(OID_NUMERIC, aNumero as any);
  const pool = new pg.Pool({ connectionString, max: 3, ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false } });
  return {
    async transaccion(ctx, fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query("begin");
        for (const p of preparacion(ctx)) await cliente.query(p.sql, p.params);
        const r = await fn(async (sql, params = []) => (await cliente.query(sql, params as any[])).rows);
        await cliente.query("commit");
        return r;
      } catch (e) {
        await cliente.query("rollback").catch(() => {});
        throw e;
      } finally {
        cliente.release();
      }
    },
    async ejecutarComoAdmin(sql) {
      const cliente = await pool.connect();
      try {
        await cliente.query(sql);
      } catch (e) {
        await cliente.query("rollback").catch(() => {}); // no devolver al pool una transacción fallida
        throw e;
      } finally {
        cliente.release();
      }
    },
    async consultarComoAdmin(sql, params = []) {
      return (await pool.query(sql, params as any[])).rows;
    },
    cerrar: () => pool.end(),
  };
}

// ─────────────────────────── Pruebas y desarrollo local: PGlite ───────────────────────────

export async function bdPGlite(directorio?: string): Promise<BaseDatos> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite({ dataDir: directorio, parsers: { [OID_DATE]: (v: string) => v, [OID_NUMERIC]: aNumero } });
  // PGlite atiende una consulta a la vez: se encolan las transacciones.
  let cola: Promise<unknown> = Promise.resolve();
  const enCola = <T>(fn: () => Promise<T>): Promise<T> => {
    const r = cola.then(fn, fn);
    cola = r.catch(() => {});
    return r;
  };
  return {
    transaccion(ctx, fn) {
      return enCola(async () => {
        await db.exec("begin");
        try {
          for (const p of preparacion(ctx)) await db.query(p.sql, p.params);
          const r = await fn(async (sql, params = []) => (await db.query(sql, params as any[])).rows as any[]);
          await db.exec("commit");
          return r;
        } catch (e) {
          await db.exec("rollback").catch(() => {});
          throw e;
        }
      });
    },
    ejecutarComoAdmin: (sql) =>
      enCola(async () => {
        try {
          await db.exec(sql);
        } catch (e) {
          await db.exec("rollback").catch(() => {});
          throw e;
        }
      }),
    consultarComoAdmin: (sql, params = []) => enCola(async () => (await db.query(sql, params as any[])).rows as any[]),
    cerrar: () => db.close(),
  };
}

let instancia: Promise<BaseDatos> | undefined;
/** Base de datos de producción (Supabase). Una por proceso. */
export function bdDesdeEntorno(): Promise<BaseDatos> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Falta SUPABASE_DB_URL: la base de datos no está configurada.");
  return (instancia ??= bdPostgres(url));
}
