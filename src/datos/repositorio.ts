// Operaciones de datos genéricas para cualquier entidad del registro.
// Los nombres de tablas y columnas salen SOLO del registro (nunca del usuario);
// los valores siempre van como parámetros ($1, $2...). Así no hay inyección SQL.

import { ZodError } from "zod";
import type { Consulta, Fila } from "./bd.js";
import { ENTIDADES, entidadPorTabla, type Entidad } from "./entidades.js";
import type { Area } from "../../shared/modulos.js";

export class ErrorDatos extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
    readonly detalle?: unknown,
  ) {
    super(mensaje);
  }
}

/** Traduce errores de Zod y de Postgres a mensajes claros con su código HTTP. */
export function traducirError(e: unknown): ErrorDatos {
  if (e instanceof ErrorDatos) return e;
  if (e instanceof ZodError) {
    return new ErrorDatos(400, e.issues.map((i) => `${i.path.join(".") || "dato"}: ${i.message}`).join(" · "), e.issues);
  }
  const pg = e as { code?: string; message?: string };
  if (pg.code === "23505") return new ErrorDatos(409, "Ya existe un registro igual (por ejemplo, otro registro para ese mismo día).");
  if (pg.code === "23514" || pg.code === "22P02" || pg.code === "22007" || pg.code === "22008") return new ErrorDatos(400, "Algún dato no cumple las reglas permitidas.");
  if (pg.code === "42501" || /row-level security/i.test(pg.message ?? "")) return new ErrorDatos(403, "No tienes permiso para esa área desde este canal.");
  return new ErrorDatos(500, "Error inesperado al guardar. Intenta de nuevo.");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validarId = (id: string) => {
  if (!UUID.test(id)) throw new ErrorDatos(400, "Identificador no válido.");
};

export interface Filtros {
  desde?: string;
  hasta?: string;
  estado?: string;
  limite?: number;
}

export async function listar(q: Consulta, ent: Entidad, f: Filtros = {}): Promise<Fila[]> {
  const cond = ["eliminado_en is null"];
  const params: unknown[] = [];
  if (f.desde) { params.push(f.desde); cond.push(`${ent.campoFecha} >= $${params.length}`); }
  if (f.hasta) { params.push(f.hasta); cond.push(`${ent.campoFecha} <= $${params.length}`); }
  if (f.estado && ent.crear.shape.estado) { params.push(f.estado); cond.push(`estado = $${params.length}`); }
  const limite = Math.min(Math.max(f.limite ?? 100, 1), 500);
  return q(`select * from ${ent.tabla} where ${cond.join(" and ")} order by ${ent.orden} limit ${limite}`, params);
}

export async function obtener(q: Consulta, ent: Entidad, id: string): Promise<Fila> {
  validarId(id);
  const [fila] = await q(`select * from ${ent.tabla} where id = $1`, [id]);
  if (!fila) throw new ErrorDatos(404, "No encontrado.");
  return fila;
}

function columnasYValores(datos: Record<string, unknown>) {
  const entradas = Object.entries(datos).filter(([, v]) => v !== undefined);
  return { columnas: entradas.map(([k]) => k), valores: entradas.map(([, v]) => v) };
}

export async function crear(q: Consulta, ent: Entidad, entrada: unknown): Promise<Fila> {
  let datos = ent.crear.parse(entrada) as Record<string, unknown>;
  if (ent.normalizar) datos = ent.normalizar(datos);
  const { columnas, valores } = columnasYValores(datos);
  const [fila] = await q(
    `insert into ${ent.tabla} (${columnas.join(", ")}) values (${valores.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    valores,
  );
  return fila;
}

export async function editar(q: Consulta, ent: Entidad, id: string, entrada: unknown): Promise<Fila> {
  validarId(id);
  let datos = ent.editar.parse(entrada) as Record<string, unknown>;
  if (ent.normalizar) datos = ent.normalizar(datos);
  const { columnas, valores } = columnasYValores(datos);
  if (!columnas.length) throw new ErrorDatos(400, "No hay cambios para guardar.");
  const [fila] = await q(
    `update ${ent.tabla} set ${columnas.map((c, i) => `${c} = $${i + 1}`).join(", ")} where id = $${columnas.length + 1} and eliminado_en is null returning *`,
    [...valores, id],
  );
  if (!fila) throw new ErrorDatos(404, "No encontrado o está en la papelera.");
  return fila;
}

/** Borrado suave: va a la papelera y se puede restaurar. */
export async function eliminar(q: Consulta, ent: Entidad, id: string): Promise<Fila> {
  validarId(id);
  const [fila] = await q(`update ${ent.tabla} set eliminado_en = now() where id = $1 and eliminado_en is null returning *`, [id]);
  if (!fila) throw new ErrorDatos(404, "No encontrado o ya estaba en la papelera.");
  return fila;
}

export async function restaurar(q: Consulta, ent: Entidad, id: string): Promise<Fila> {
  validarId(id);
  const [fila] = await q(`update ${ent.tabla} set eliminado_en = null where id = $1 and eliminado_en is not null returning *`, [id]);
  if (!fila) throw new ErrorDatos(404, "No está en la papelera.");
  return fila;
}

export async function historial(q: Consulta, ent: Entidad, id: string) {
  validarId(id);
  return q(
    "select id, operacion, antes, despues, canal, creado_en from historial where tabla = $1 and registro_id = $2 order by creado_en desc, id desc limit 100",
    [ent.tabla, id],
  );
}

/** Historial reciente de todas las entidades (para Ajustes). */
export async function actividadReciente(q: Consulta, limite = 50) {
  const filas = await q<{ tabla: string; registro_id: string; operacion: string; canal: string; creado_en: string; despues: Fila | null; antes: Fila | null }>(
    "select tabla, registro_id, operacion, canal, creado_en, antes, despues from historial order by creado_en desc, id desc limit $1",
    [Math.min(limite, 200)],
  );
  return filas.map((f) => {
    const ent = entidadPorTabla(f.tabla);
    const datos = f.despues ?? f.antes ?? {};
    return { entidad: ent?.nombre ?? f.tabla, id: f.registro_id, operacion: f.operacion, canal: f.canal, cuando: f.creado_en, titulo: ent ? String(datos[ent.campoTitulo] ?? "") : "" };
  });
}

export async function papelera(q: Consulta) {
  const resultado: { entidad: string; id: string; titulo: string; eliminado_en: string }[] = [];
  for (const ent of ENTIDADES) {
    const filas = await q(`select id, ${ent.campoTitulo} as titulo, eliminado_en from ${ent.tabla} where eliminado_en is not null order by eliminado_en desc limit 100`);
    resultado.push(...filas.map((f) => ({ entidad: ent.nombre, id: f.id, titulo: String(f.titulo), eliminado_en: f.eliminado_en })));
  }
  return resultado.sort((a, b) => String(b.eliminado_en).localeCompare(String(a.eliminado_en)));
}

/** Exporta todo (o un área) en JSON, incluida la papelera, para respaldo o para llevarse los datos. */
export async function exportar(q: Consulta, area?: Area) {
  const datos: Record<string, Fila[]> = {};
  for (const ent of ENTIDADES) {
    if (area && ent.area !== area && ent.area !== "columna") continue;
    const filas = await q(`select * from ${ent.tabla} order by creado_en`);
    datos[ent.nombre] = area && ent.area === "columna" ? filas.filter((f) => f.area === area) : filas;
  }
  const [perfil] = await q("select nombre, zona_horaria, creado_en from perfiles");
  return { formato: "alquimia-mi-dia/v1", exportado_en: new Date().toISOString(), area: area ?? "todas", perfil: perfil ?? null, datos };
}

/** Registro del día de bienestar: crea la fila o la actualiza. El agua se SUMA, el resto se reemplaza. */
export async function registrarBienestar(
  q: Consulta,
  fecha: string,
  cambios: { agua_vasos?: number; humor?: number | null; energia?: number | null; sueno_horas?: number | null; notas?: string | null; meta_agua?: number },
): Promise<Fila> {
  const ent = ENTIDADES.find((e) => e.nombre === "bienestar")!;
  // El agua llega como CAMBIO (+1, -1), no como total: se valida aparte.
  const { agua_vasos: delta, ...otros } = cambios;
  if (delta !== undefined && (!Number.isInteger(delta) || delta < -40 || delta > 40)) {
    throw new ErrorDatos(400, "agua_vasos: el cambio debe ser un número entero entre -40 y 40.");
  }
  const datos: Record<string, any> = { ...(ent.editar.parse({ ...otros, fecha }) as Record<string, any>), agua_vasos: delta };
  const [existente] = await q("select * from registros_bienestar where fecha = $1 and eliminado_en is null", [fecha]);
  if (!existente) {
    return crear(q, ent, { ...datos, agua_vasos: Math.max(0, datos.agua_vasos ?? 0) });
  }
  const { fecha: _f, agua_vasos, ...resto } = datos;
  const nuevos: Record<string, unknown> = { ...resto };
  if (agua_vasos !== undefined) nuevos.agua_vasos = Math.min(40, Math.max(0, existente.agua_vasos + agua_vasos));
  if (!Object.keys(nuevos).length) return existente;
  return editar(q, ent, existente.id, nuevos);
}
