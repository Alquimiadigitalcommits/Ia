// Perfil y configuración de cada persona: módulos activos, widgets del dashboard y
// permisos de cada canal (WhatsApp, IA) por área. Se crea solo en la primera entrada.

import { z } from "zod";
import {
  ACCESOS_INICIALES, AREAS, completarModulos, completarWidgets, MODULOS, WIDGETS,
  type ConfigModulo, type ConfigWidget,
} from "../../shared/modulos.js";
import type { Consulta } from "./bd.js";
import { ErrorDatos } from "./repositorio.js";

/** Idempotente: si ya existe, no cambia nada. */
export async function asegurarPerfil(q: Consulta, nombre = "") {
  await q("insert into perfiles (nombre) values ($1) on conflict (id) do nothing", [nombre.slice(0, 80)]);
  for (const a of ACCESOS_INICIALES) {
    await q(
      "insert into accesos (canal, area, lectura, escritura) values ($1, $2, $3, $4) on conflict do nothing",
      [a.canal, a.area, a.lectura, a.escritura],
    );
  }
}

export async function leerConfiguracion(q: Consulta) {
  const [perfil] = await q("select nombre, zona_horaria, creado_en from perfiles");
  const modulos = completarModulos(await q<ConfigModulo>("select modulo, activo, orden, config from modulos_usuario"));
  const widgets = completarWidgets(await q<ConfigWidget>("select widget, visible, orden, tamano, config from widgets_usuario"));
  const accesos = await q("select canal, area, lectura, escritura from accesos order by canal, area");
  return { perfil, modulos, widgets, accesos };
}

const esquemaPerfil = z.object({ nombre: z.string().trim().max(80).optional(), zona_horaria: z.string().max(60).optional() }).strict();

export async function guardarPerfil(q: Consulta, entrada: unknown) {
  const d = esquemaPerfil.parse(entrada);
  if (d.zona_horaria) {
    try {
      new Intl.DateTimeFormat("es", { timeZone: d.zona_horaria });
    } catch {
      throw new ErrorDatos(400, "Zona horaria no válida.");
    }
  }
  const [p] = await q(
    "update perfiles set nombre = coalesce($1, nombre), zona_horaria = coalesce($2, zona_horaria) returning nombre, zona_horaria",
    [d.nombre ?? null, d.zona_horaria ?? null],
  );
  return p;
}

const idsModulos = MODULOS.map((m) => m.id) as [string, ...string[]];
const esquemaModulos = z.array(
  z.object({ modulo: z.enum(idsModulos), activo: z.boolean(), orden: z.number().int().min(0).max(200), config: z.record(z.string(), z.unknown()).default({}) }).strict(),
).max(MODULOS.length);

export async function guardarModulos(q: Consulta, entrada: unknown) {
  for (const m of esquemaModulos.parse(entrada)) {
    await q(
      `insert into modulos_usuario (modulo, activo, orden, config) values ($1, $2, $3, $4)
       on conflict (usuario_id, modulo) do update set activo = excluded.activo, orden = excluded.orden, config = excluded.config, actualizado_en = now()`,
      [m.modulo, m.activo, m.orden, JSON.stringify(m.config)],
    );
  }
  return completarModulos(await q<ConfigModulo>("select modulo, activo, orden, config from modulos_usuario"));
}

const idsWidgets = WIDGETS.map((w) => w.id) as [string, ...string[]];
const esquemaWidgets = z.array(
  z.object({
    widget: z.enum(idsWidgets),
    visible: z.boolean(),
    orden: z.number().int().min(0).max(200),
    tamano: z.enum(["chico", "mediano", "grande"]),
    config: z.record(z.string(), z.unknown()).default({}),
  }).strict(),
).max(WIDGETS.length);

export async function guardarWidgets(q: Consulta, entrada: unknown) {
  for (const w of esquemaWidgets.parse(entrada)) {
    await q(
      `insert into widgets_usuario (widget, visible, orden, tamano, config) values ($1, $2, $3, $4, $5)
       on conflict (usuario_id, widget) do update set visible = excluded.visible, orden = excluded.orden, tamano = excluded.tamano, config = excluded.config, actualizado_en = now()`,
      [w.widget, w.visible, w.orden, w.tamano, JSON.stringify(w.config)],
    );
  }
  return completarWidgets(await q<ConfigWidget>("select widget, visible, orden, tamano, config from widgets_usuario"));
}

const esquemaAccesos = z.array(
  z.object({ canal: z.enum(["whatsapp", "ia"]), area: z.enum(AREAS as [string, ...string[]]), lectura: z.boolean(), escritura: z.boolean() }).strict(),
).max(20);

/** Solo funciona desde la web: la base rechaza cambios de permisos desde WhatsApp o IA. */
export async function guardarAccesos(q: Consulta, entrada: unknown) {
  for (const a of esquemaAccesos.parse(entrada)) {
    // Escribir sin poder leer no tiene sentido: escritura implica lectura.
    const lectura = a.lectura || a.escritura;
    await q(
      `insert into accesos (canal, area, lectura, escritura) values ($1, $2, $3, $4)
       on conflict (usuario_id, canal, area) do update set lectura = excluded.lectura, escritura = excluded.escritura, actualizado_en = now()`,
      [a.canal, a.area, lectura, a.escritura],
    );
  }
  return q("select canal, area, lectura, escritura from accesos order by canal, area");
}
