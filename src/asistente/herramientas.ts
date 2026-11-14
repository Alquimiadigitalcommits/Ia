// Herramientas del asistente. Cada una es una acción concreta con un formato estricto:
// Claude decide CUÁL usar y con qué datos; Zod valida los datos ANTES de ejecutar.
//
// Para sumar una capacidad nueva al bot: agrega una herramienta aquí. Nada más cambia.

import { createHash } from "node:crypto";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ClienteNotion } from "../conectores/notion.js";
import type { ClienteSheets } from "../conectores/sheets.js";
import { guardarIdea, type IdeaEntrante } from "../ideas/guardar.js";
import { agregarProveedor, buscarProveedores, NEGOCIOS, registrarCompra, registrarGastoNegocio, registrarVenta, resumenNegociosMes, stockBajo, type Escritura } from "../negocios/negocios.js";
import type { Accion } from "../nucleo/estado.js";
import type { RegistroProcesados } from "../nucleo/idempotencia.js";
import { agregarFecha, registrarPeriodo, TIPOS_FECHA } from "../personal/agenda.js";
import { CATEGORIAS_PERSONALES, MEDIOS_PAGO, registrarMovimiento, resumenFinanzasMes } from "../personal/finanzas.js";
import { registrar, resumen, type BasesPersonales } from "../personal/personal.js";

export interface ContextoHerramientas {
  notion: ClienteNotion;
  bases: BasesPersonales & { finanzas: string; ideas: string };
  sheets: ClienteSheets | null;
  procesados: RegistroProcesados;
  /** Datos del mensaje original, para guardar ideas con imagen y remitente. */
  ideaBase: Omit<IdeaEntrante, "texto">;
  ahora: Date;
  /** Acciones hechas en este mensaje (para "deshacer"). */
  acciones: Accion[];
  /** Acciones del mensaje anterior. */
  accionesPrevias: Accion[];
}

const opcional = <T extends z.ZodType>(t: T) => t.nullable();
const SIN_PLANILLA = "La planilla de negocios no está conectada todavía (faltan GOOGLE_CREDENCIALES_JSON y PLANILLA_NEGOCIOS_ID). No se guardó nada.";

const deSheets = (ctx: ContextoHerramientas, e: Escritura) => {
  ctx.acciones.push({ tipo: "sheets", hoja: e.hoja, fila: e.fila, columnas: e.columnas, resumen: e.resumen });
  return `Guardado en planilla (${e.hoja}, fila ${e.fila}): ${e.resumen}`;
};

export function crearHerramientas(ctx: ContextoHerramientas, permisos: "admin" | "ideas") {
  const idea = betaZodTool({
    name: "guardar_idea",
    description:
      "Guarda una idea de contenido, link de TikTok/YouTube/Instagram o referencia en 'Ideas y referencias'. Úsala para cualquier idea para redes, aunque venga mezclada con otras cosas.",
    strict: true,
    inputSchema: z.strictObject({ texto: z.string().describe("La idea tal como la escribió la persona, con sus links") }),
    run: async ({ texto }) => {
      const r = await guardarIdea(ctx.notion, ctx.bases.ideas, ctx.procesados, { ...ctx.ideaBase, idOrigen: `idea:${ctx.ideaBase.idOrigen}:${createHash("sha1").update(texto).digest("hex").slice(0, 10)}`, texto });
      if (!r) return "Esta idea ya estaba guardada.";
      ctx.acciones.push({ tipo: "notion", pageId: r.pagina.id, resumen: `Idea: ${r.idea?.titulo ?? texto.slice(0, 40)}` });
      return JSON.stringify({ guardada: true, titulo: r.idea?.titulo, de_que_trata: r.idea?.de_que_trata, clientes: r.idea?.clientes_sugeridos, url: r.pagina.url });
    },
  });
  if (permisos === "ideas") return [idea];

  const habito = betaZodTool({
    name: "registrar_habito",
    description: "Registra hábitos de hoy en el dashboard: agua (vasos, puede ser negativo para corregir), humor (1 a 5), kine (1 hecha, 0 no), ejercicio (minutos), lectura (minutos), sueño (horas).",
    strict: true,
    inputSchema: z.strictObject({
      tipo: z.enum(["agua", "humor", "kine", "ejercicio", "lectura", "sueno"]),
      cantidad: z.number(),
    }),
    run: async ({ tipo, cantidad }) => {
      const r =
        tipo === "agua" ? { tipo, vasos: Math.round(cantidad) } as const
        : tipo === "humor" ? { tipo, valor: Math.min(5, Math.max(1, Math.round(cantidad))) as 1 | 2 | 3 | 4 | 5 } as const
        : tipo === "kine" ? { tipo, hecha: cantidad >= 1 } as const
        : tipo === "sueno" ? { tipo, horas: cantidad } as const
        : { tipo, minutos: Math.round(cantidad) } as const;
      const props = await registrar(ctx.bases, r, ctx.ahora, ctx.notion);
      if (tipo === "agua") ctx.acciones.push({ tipo: "agua", vasos: Math.round(cantidad), resumen: `${cantidad} vasos de agua` });
      const agua = props["Agua (vasos)"]?.number;
      return `Registrado ${tipo}: ${cantidad}.${agua != null ? ` Agua de hoy: ${agua} vasos.` : ""}`;
    },
  });

  const finanzaPersonal = betaZodTool({
    name: "registrar_finanza_personal",
    description: "Gasto, ingreso o ahorro PERSONAL (no de los negocios). Montos en pesos chilenos enteros.",
    strict: true,
    inputSchema: z.strictObject({
      tipo: z.enum(["Gasto", "Ingreso", "Ahorro"]),
      monto: z.number(),
      categoria: z.enum(CATEGORIAS_PERSONALES),
      descripcion: z.string().describe("Corto: 'Uber a la oficina', 'Sueldo noviembre'"),
      medio_pago: opcional(z.enum(MEDIOS_PAGO)),
      fecha: opcional(z.string().describe("YYYY-MM-DD solo si no es hoy")),
    }),
    run: async (i) => {
      if (!(i.monto > 0)) return "El monto debe ser mayor que 0. Pregunta el monto.";
      const r = await registrarMovimiento(ctx.notion, ctx.bases.finanzas, { ...i, medioPago: i.medio_pago }, ctx.ahora);
      ctx.acciones.push({ tipo: "notion", pageId: r.pagina.id, resumen: r.resumen });
      return `Guardado en Notion: ${r.resumen}`;
    },
  });

  const negocio = z.enum(NEGOCIOS);
  const venta = betaZodTool({
    name: "registrar_venta",
    description: "Venta de uno de los negocios. Si falta el precio o el negocio, NO la registres: pregunta.",
    strict: true,
    inputSchema: z.strictObject({
      negocio,
      producto: z.string(),
      cantidad: z.number(),
      precio_unitario: z.number(),
      descuento: opcional(z.number()),
      canal: opcional(z.string().describe("Instagram, feria, Etsy, WhatsApp, tienda...")),
      medio_pago: opcional(z.string()),
      estado_pago: opcional(z.enum(["Pagado", "Pendiente", "Abonado"])),
      observaciones: opcional(z.string()),
    }),
    run: async (i) => {
      if (!ctx.sheets) return SIN_PLANILLA;
      if (!(i.cantidad > 0) || i.precio_unitario < 0 || (i.descuento ?? 0) < 0) return "Cantidad o precio no válidos. Pregunta los datos correctos.";
      return deSheets(ctx, await registrarVenta(ctx.sheets, { ...i, precioUnitario: i.precio_unitario, medioPago: i.medio_pago, estadoPago: i.estado_pago }, ctx.ahora));
    },
  });

  const gastoNegocio = betaZodTool({
    name: "registrar_gasto_negocio",
    description: "Gasto de un negocio que NO es compra de materiales o productos para vender (arriendo de stand, publicidad, envíos, herramientas).",
    strict: true,
    inputSchema: z.strictObject({
      negocio,
      categoria: z.string().describe("Publicidad, Envíos, Arriendo, Herramientas, Packaging, Comisiones, Otro"),
      concepto: z.string(),
      monto: z.number(),
      tipo: z.enum(["Fijo", "Variable"]),
      proveedor: opcional(z.string()),
      medio_pago: opcional(z.string()),
    }),
    run: async (i) => {
      if (!ctx.sheets) return SIN_PLANILLA;
      if (!(i.monto > 0)) return "El monto debe ser mayor que 0.";
      return deSheets(ctx, await registrarGastoNegocio(ctx.sheets, { ...i, medioPago: i.medio_pago }, ctx.ahora));
    },
  });

  const compra = betaZodTool({
    name: "registrar_compra",
    description: "Compra de materiales o productos para un negocio (entra al inventario). Ej: 'compré 100 limpiapipas a 3 lucas en el centro para Detalles'.",
    strict: true,
    inputSchema: z.strictObject({
      negocio,
      material: z.string(),
      cantidad: z.number(),
      unidad: z.string().describe("unidad, paquete, metro, kilo..."),
      costo_total: z.number(),
      proveedor: opcional(z.string()),
      medio_pago: opcional(z.string()),
    }),
    run: async (i) => {
      if (!ctx.sheets) return SIN_PLANILLA;
      if (!(i.cantidad > 0) || !(i.costo_total > 0)) return "Cantidad y costo deben ser mayores que 0.";
      return deSheets(ctx, await registrarCompra(ctx.sheets, { ...i, costoTotal: i.costo_total, medioPago: i.medio_pago }, ctx.ahora));
    },
  });

  const proveedor = betaZodTool({
    name: "agregar_proveedor",
    description: "Agrega un proveedor encontrado en la ciudad al listado de proveedores.",
    strict: true,
    inputSchema: z.strictObject({
      nombre: z.string(),
      categoria: z.string().describe("Telas, Calzado, Bisutería, Packaging, Flores, Imprenta..."),
      que_vende: z.string(),
      direccion: opcional(z.string()),
      comuna: opcional(z.string()),
      contacto: opcional(z.string()),
      telefono: opcional(z.string()),
      correo: opcional(z.string()),
      web: opcional(z.string().describe("Web o @ de Instagram")),
      precio_referencia: opcional(z.string()),
      condiciones: opcional(z.string().describe("Mínimo de compra, por mayor, despacho...")),
      observaciones: opcional(z.string()),
    }),
    run: async (i) => {
      if (!ctx.sheets) return SIN_PLANILLA;
      return deSheets(ctx, await agregarProveedor(ctx.sheets, { ...i, queVende: i.que_vende, precioReferencia: i.precio_referencia }, ctx.ahora));
    },
  });

  const fecha = betaZodTool({
    name: "agregar_fecha_importante",
    description: "Agrega una fecha importante (cumpleaños, pago, cita médica, entrega). Con hora, también genera alarma.",
    strict: true,
    inputSchema: z.strictObject({
      evento: z.string(),
      fecha: z.string().describe("YYYY-MM-DD"),
      hora: opcional(z.string().describe("HH:MM 24 h")),
      tipo: z.enum(TIPOS_FECHA),
      se_repite_cada_anio: z.boolean(),
      avisar_dias_antes: opcional(z.number()),
    }),
    run: async (i) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(i.fecha) || (i.hora && !/^\d{2}:\d{2}$/.test(i.hora))) return "Fecha u hora con formato no válido (YYYY-MM-DD y HH:MM).";
      const r = await agregarFecha(ctx.notion, ctx.bases.fechas, { ...i, seRepite: i.se_repite_cada_anio, avisarDiasAntes: i.avisar_dias_antes });
      ctx.acciones.push({ tipo: "notion", pageId: r.pagina.id, resumen: r.resumen });
      return `Guardado: ${r.resumen}`;
    },
  });

  const periodo = betaZodTool({
    name: "registrar_periodo",
    description: "Registra inicio o fin del periodo menstrual.",
    strict: true,
    inputSchema: z.strictObject({ accion: z.enum(["inicio", "fin"]), fecha: z.string().describe("YYYY-MM-DD") }),
    run: async ({ accion, fecha: f }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return "Fecha no válida (YYYY-MM-DD).";
      const r = await registrarPeriodo(ctx.notion, ctx.bases.ciclo, accion, f);
      if (r.pagina) ctx.acciones.push({ tipo: "notion", pageId: r.pagina.id, resumen: r.resumen });
      return r.resumen;
    },
  });

  const consultar = betaZodTool({
    name: "consultar",
    description: "Consulta datos sin modificar nada: resumen de hoy, finanzas personales del mes, negocios del mes, proveedores (con filtro opcional) o stock bajo.",
    strict: true,
    inputSchema: z.strictObject({
      que: z.enum(["hoy", "finanzas_personales_mes", "negocios_mes", "proveedores", "stock_bajo"]),
      filtro: opcional(z.string()),
    }),
    run: async ({ que, filtro }) => {
      switch (que) {
        case "hoy": {
          const r = await resumen(ctx.bases, ctx.ahora, ctx.notion);
          return JSON.stringify({ agua: `${r.agua.agua}/${r.agua.metaAgua}`, humor: r.agua.humorTexto, eventos: r.eventos, fechas: r.fechas.slice(0, 5), ciclo: r.ciclo && { dia: r.ciclo.diaDelCiclo, proximo: r.ciclo.proximoInicio } });
        }
        case "finanzas_personales_mes":
          return JSON.stringify(await resumenFinanzasMes(ctx.notion, ctx.bases.finanzas, ctx.ahora));
        case "negocios_mes":
          return ctx.sheets ? JSON.stringify(await resumenNegociosMes(ctx.sheets, ctx.ahora)) : SIN_PLANILLA;
        case "proveedores":
          return ctx.sheets ? (await buscarProveedores(ctx.sheets, filtro)).join("\n") || "Sin proveedores que coincidan." : SIN_PLANILLA;
        case "stock_bajo":
          return ctx.sheets ? (await stockBajo(ctx.sheets)).join("\n") || "Nada bajo el stock mínimo." : SIN_PLANILLA;
      }
    },
  });

  const deshacer = betaZodTool({
    name: "deshacer_ultimo",
    description: "Deshace lo que se guardó en el mensaje ANTERIOR (cuando la persona dice 'borra eso', 'me equivoqué', 'deshacer').",
    strict: true,
    inputSchema: z.strictObject({}),
    run: async () => {
      if (!ctx.accionesPrevias.length) return "No hay nada reciente para deshacer.";
      const hechas: string[] = [];
      for (const a of ctx.accionesPrevias) {
        if (a.tipo === "notion") await ctx.notion.pedir("PATCH", `pages/${a.pageId}`, { archived: true });
        else if (a.tipo === "sheets" && ctx.sheets) await ctx.sheets.vaciarCeldas(a.hoja, a.fila, a.columnas);
        else if (a.tipo === "agua") await registrar(ctx.bases, { tipo: "agua", vasos: -a.vasos }, ctx.ahora, ctx.notion);
        else continue;
        hechas.push(a.resumen);
      }
      ctx.accionesPrevias.length = 0;
      return hechas.length ? `Deshecho: ${hechas.join(" · ")}` : "No se pudo deshacer automáticamente.";
    },
  });

  return [idea, habito, finanzaPersonal, venta, gastoNegocio, compra, proveedor, fecha, periodo, consultar, deshacer];
}

export type Herramienta = ReturnType<typeof crearHerramientas>[number];
