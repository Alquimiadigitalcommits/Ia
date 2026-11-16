import { describe, expect, it, vi } from "vitest";
import type { ClienteNotion } from "../src/conectores/notion.js";
import type { ClienteSheets } from "../src/conectores/sheets.js";
import { crearHerramientas, type ContextoHerramientas } from "../src/asistente/herramientas.js";
import { instrucciones } from "../src/asistente/asistente.js";
import { registroMemoria } from "../src/nucleo/idempotencia.js";

const ahora = new Date("2026-11-14T15:00:00Z");

function contexto(extra: Partial<ContextoHerramientas> = {}) {
  const creadas: any[] = [];
  const archivadas: string[] = [];
  const notion: ClienteNotion = {
    pedir: vi.fn(async (_m: string, ruta: string, cuerpo: any) => { if (cuerpo?.archived) archivadas.push(ruta); return {}; }) as any,
    consultar: vi.fn(async () => []),
    actualizarPagina: vi.fn(async () => ({ properties: {} })),
    crearPagina: vi.fn(async (db, properties) => { creadas.push({ db, properties }); return { id: `p${creadas.length}`, url: "u" }; }),
  };
  const filas: any[] = [];
  const vaciadas: any[] = [];
  const sheets: ClienteSheets = {
    leer: async () => [],
    agregarFila: async (hoja, valores) => { filas.push({ hoja, valores }); return 12; },
    asegurarColumnas: async () => [],
    vaciarCeldas: async (hoja, fila) => { vaciadas.push({ hoja, fila }); },
  };
  const ctx: ContextoHerramientas = {
    notion,
    bases: { token: "t", registro: "r", medicamentos: "m", plan: "p", fechas: "f", ciclo: "c", lecturas: "l", finanzas: "fin", ideas: "ideas" },
    sheets,
    procesados: registroMemoria(),
    ideaBase: { idOrigen: "wamid.1", fecha: ahora, remitente: "Tamara", origen: "WhatsApp" },
    ahora,
    acciones: [],
    accionesPrevias: [],
    ...extra,
  };
  return { ctx, creadas, archivadas, filas, vaciadas };
}

const herramienta = (lista: ReturnType<typeof crearHerramientas>, nombre: string): any => lista.find((h) => h.name === nombre)!;

describe("asistente: permisos", () => {
  it("equipo y clientes SOLO tienen guardar_idea (no ven finanzas ni salud)", () => {
    expect(crearHerramientas(contexto().ctx, "ideas").map((h) => h.name)).toEqual(["guardar_idea"]);
  });
  it("admin tiene las 11 herramientas", () => {
    expect(crearHerramientas(contexto().ctx, "admin")).toHaveLength(11);
  });
  it("todas las herramientas usan modo estricto", () => {
    for (const h of crearHerramientas(contexto().ctx, "admin")) expect((h as any).strict).toBe(true);
  });
  it("las instrucciones llevan la fecha de hoy en Chile y la regla de las lucas", () => {
    const t = instrucciones(ahora, "Tamara", "admin");
    expect(t).toContain("2026-11-14");
    expect(t).toContain('"5 lucas" = 5.000');
  });
});

describe("asistente: herramientas", () => {
  it("gasto personal → Notion 'Finanzas personales' y queda para deshacer", async () => {
    const { ctx, creadas } = contexto();
    const h = herramienta(crearHerramientas(ctx, "admin"), "registrar_finanza_personal");
    const r = await h.run({ tipo: "Gasto", monto: 5000, categoria: "Transporte", descripcion: "Uber", medio_pago: "Débito", fecha: null });
    expect(r).toContain("$5.000");
    expect(creadas[0].db).toBe("fin");
    expect(creadas[0].properties.Monto).toEqual({ number: 5000 });
    expect(ctx.acciones).toHaveLength(1);
  });

  it("rechaza montos en cero o negativos sin guardar", async () => {
    const { ctx, creadas } = contexto();
    const r = await herramienta(crearHerramientas(ctx, "admin"), "registrar_finanza_personal").run({ tipo: "Gasto", monto: 0, categoria: "Otro", descripcion: "x", medio_pago: null, fecha: null });
    expect(r).toMatch(/mayor que 0/);
    expect(creadas).toHaveLength(0);
  });

  it("venta sin planilla conectada: avisa y no finge que guardó", async () => {
    const { ctx } = contexto({ sheets: null });
    const r = await herramienta(crearHerramientas(ctx, "admin"), "registrar_venta").run({ negocio: "Detalles", producto: "Aros", cantidad: 1, precio_unitario: 5000, descuento: null, canal: null, medio_pago: null, estado_pago: null, observaciones: null });
    expect(r).toMatch(/no está conectada/);
    expect(ctx.acciones).toHaveLength(0);
  });

  it("venta → planilla, fila anotada para deshacer", async () => {
    const { ctx, filas } = contexto();
    const r = await herramienta(crearHerramientas(ctx, "admin"), "registrar_venta").run({ negocio: "Detalles", producto: "Aros", cantidad: 2, precio_unitario: 8000, descuento: null, canal: "Instagram", medio_pago: "Transferencia", estado_pago: null, observaciones: null });
    expect(r).toContain("03 - Ventas, fila 12");
    expect(filas[0].hoja).toBe("03 - Ventas");
    expect(ctx.acciones[0]).toMatchObject({ tipo: "sheets", fila: 12 });
  });

  it("fecha con formato inválido no se guarda", async () => {
    const { ctx, creadas } = contexto();
    const r = await herramienta(crearHerramientas(ctx, "admin"), "agregar_fecha_importante").run({ evento: "Kine", fecha: "viernes", hora: null, tipo: "Cita médica", se_repite_cada_anio: false, avisar_dias_antes: null });
    expect(r).toMatch(/no válido/);
    expect(creadas).toHaveLength(0);
  });

  it("deshacer: archiva en Notion y vacía en la planilla lo del mensaje anterior", async () => {
    const { ctx, archivadas, vaciadas } = contexto({
      accionesPrevias: [
        { tipo: "notion", pageId: "abc", resumen: "Gasto Uber $5.000" },
        { tipo: "sheets", hoja: "03 - Ventas", fila: 12, columnas: ["Fecha"], resumen: "Venta Detalles" },
      ],
    });
    const r = await herramienta(crearHerramientas(ctx, "admin"), "deshacer_ultimo").run({});
    expect(r).toContain("Gasto Uber");
    expect(archivadas).toEqual(["pages/abc"]);
    expect(vaciadas).toEqual([{ hoja: "03 - Ventas", fila: 12 }]);
    expect(await herramienta(crearHerramientas(ctx, "admin"), "deshacer_ultimo").run({})).toMatch(/No hay nada/);
  });
});
