// Registro de entidades: cada tabla que la app puede crear, editar y borrar.
// Las columnas permitidas salen del esquema Zod: nada que no esté aquí llega a la base.
// Agregar una entidad nueva (ej. "habitos" en la fase 4) = migración + una entrada aquí.

import { z } from "zod";
import type { Area } from "../../shared/modulos.js";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha con formato AAAA-MM-DD");
const fechaHora = z.string().datetime({ offset: true, message: "Fecha y hora ISO con zona horaria" });
const areaNoIntima = z.enum(["personal", "salud", "finanzas", "trabajo"]);
const textoOpcional = (max: number) => z.string().max(max).nullable().optional();

export interface Entidad {
  nombre: string;
  tabla: string;
  modulo: string;
  /** Área fija de toda la tabla, o "columna" si cada fila trae su área. */
  area: Area | "columna";
  crear: z.ZodObject<any>;
  editar: z.ZodObject<any>;
  orden: string;
  /** Columna de fecha para filtrar por período. */
  campoFecha: string;
  /** Cómo mostrar la fila en la papelera y el historial. */
  campoTitulo: string;
  /** Ajustes automáticos antes de guardar (ej. marcar completada_en). */
  normalizar?: (datos: Record<string, unknown>) => Record<string, unknown>;
}

const bienestarBase = z.object({
  fecha,
  agua_vasos: z.number().int().min(0).max(40).optional(),
  meta_agua: z.number().int().min(1).max(40).optional(),
  humor: z.number().int().min(1).max(5).nullable().optional(),
  energia: z.number().int().min(1).max(5).nullable().optional(),
  sueno_horas: z.number().min(0).max(24).nullable().optional(),
  notas: textoOpcional(2000),
}).strict();

const tareaBase = z.object({
  titulo: z.string().trim().min(1, "El título no puede estar vacío").max(300),
  descripcion: textoOpcional(5000),
  estado: z.enum(["pendiente", "en_curso", "hecha"]).optional(),
  prioridad: z.enum(["alta", "media", "baja"]).optional(),
  vence: fecha.nullable().optional(),
  area: areaNoIntima.optional(),
}).strict();

const eventoBase = z.object({
  titulo: z.string().trim().min(1, "El título no puede estar vacío").max(300),
  inicio: fechaHora,
  fin: fechaHora.nullable().optional(),
  todo_el_dia: z.boolean().optional(),
  lugar: textoOpcional(300),
  notas: textoOpcional(5000),
  recordatorio_min: z.number().int().min(0).max(10080).nullable().optional(),
  area: areaNoIntima.optional(),
}).strict();

export const ENTIDADES: Entidad[] = [
  {
    nombre: "bienestar",
    tabla: "registros_bienestar",
    modulo: "bienestar",
    area: "personal",
    crear: bienestarBase,
    editar: bienestarBase.partial(),
    orden: "fecha desc",
    campoFecha: "fecha",
    campoTitulo: "fecha",
  },
  {
    nombre: "tareas",
    tabla: "tareas",
    modulo: "tareas",
    area: "columna",
    crear: tareaBase,
    editar: tareaBase.partial(),
    orden: "(estado = 'hecha'), vence asc nulls last, creado_en desc",
    campoFecha: "vence",
    campoTitulo: "titulo",
    normalizar: (d) => (d.estado === undefined ? d : { ...d, completada_en: d.estado === "hecha" ? new Date().toISOString() : null }),
  },
  {
    nombre: "eventos",
    tabla: "eventos",
    modulo: "agenda",
    area: "columna",
    crear: eventoBase.refine((e) => !e.fin || e.fin >= e.inicio, { message: "El fin no puede ser antes del inicio", path: ["fin"] }),
    editar: eventoBase.partial(),
    orden: "inicio asc",
    campoFecha: "inicio",
    campoTitulo: "titulo",
  },
];

export const entidadPorNombre = (n: string) => ENTIDADES.find((e) => e.nombre === n);
export const entidadPorTabla = (t: string) => ENTIDADES.find((e) => e.tabla === t);
