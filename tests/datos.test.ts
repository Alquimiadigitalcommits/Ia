import { beforeEach, describe, expect, it } from "vitest";
import type { BaseDatos } from "../src/datos/bd.js";
import { entidadPorNombre } from "../src/datos/entidades.js";
import { aplicarMigraciones } from "../src/datos/migraciones.js";
import * as repo from "../src/datos/repositorio.js";
import { asegurarPerfil, guardarAccesos, guardarModulos, guardarWidgets, leerConfiguracion } from "../src/datos/usuario.js";
import { ANA, BETO, bdDePrueba, web, whatsapp } from "./ayuda-bd.js";

const tareas = entidadPorNombre("tareas")!;
const eventos = entidadPorNombre("eventos")!;
let bd: BaseDatos;

beforeEach(async () => {
  bd = await bdDePrueba();
  await bd.transaccion(web(ANA), (q) => asegurarPerfil(q, "Ana"));
  await bd.transaccion(web(BETO), (q) => asegurarPerfil(q, "Beto"));
});

const fallaCon = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return repo.traducirError(e);
  }
};

describe("migraciones", () => {
  it("son idempotentes: volver a aplicarlas no hace nada", async () => {
    expect(await aplicarMigraciones(bd, [])).toEqual([]);
  });
  it("detectan si alguien editó una migración ya aplicada", async () => {
    const [{ nombre }] = await bd.consultarComoAdmin<{ nombre: string }>("select nombre from _migraciones limit 1");
    await expect(aplicarMigraciones(bd, [{ nombre, sql: "-- editada" }])).rejects.toThrow(/fue modificada/);
  });
});

describe("privacidad entre personas (RLS)", () => {
  it("cada persona ve solo sus tareas", async () => {
    await bd.transaccion(web(ANA), (q) => repo.crear(q, tareas, { titulo: "Tarea de Ana" }));
    await bd.transaccion(web(BETO), (q) => repo.crear(q, tareas, { titulo: "Tarea de Beto" }));
    const deAna = await bd.transaccion(web(ANA), (q) => repo.listar(q, tareas));
    expect(deAna.map((t) => t.titulo)).toEqual(["Tarea de Ana"]);
  });

  it("no se puede leer ni editar una fila ajena aunque se conozca su id", async () => {
    const t = await bd.transaccion(web(ANA), (q) => repo.crear(q, tareas, { titulo: "Privada" }));
    const lectura = await fallaCon(bd.transaccion(web(BETO), (q) => repo.obtener(q, tareas, t.id)));
    const edicion = await fallaCon(bd.transaccion(web(BETO), (q) => repo.editar(q, tareas, t.id, { titulo: "hackeada" })));
    expect(lectura?.status).toBe(404);
    expect(edicion?.status).toBe(404);
  });

  it("no hay borrado físico: la base lo rechaza", async () => {
    const t = await bd.transaccion(web(ANA), (q) => repo.crear(q, tareas, { titulo: "x" }));
    const e = await fallaCon(bd.transaccion(web(ANA), (q) => q("delete from tareas where id = $1", [t.id])));
    expect(e?.status).toBe(403);
  });
});

describe("permisos por canal y área", () => {
  it("WhatsApp NO ve salud por defecto (privacidad por defecto), la web sí", async () => {
    await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "Pedir hora médica", area: "salud" }));
    await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "Comprar pan", area: "personal" }));
    const desdeWhatsapp = await bd.transaccion(whatsapp(), (q) => repo.listar(q, tareas));
    const desdeWeb = await bd.transaccion(web(), (q) => repo.listar(q, tareas));
    expect(desdeWhatsapp.map((t) => t.titulo)).toEqual(["Comprar pan"]);
    expect(desdeWeb).toHaveLength(2);
  });

  it("WhatsApp no puede escribir en un área sin permiso", async () => {
    const e = await fallaCon(bd.transaccion(whatsapp(), (q) => repo.crear(q, tareas, { titulo: "x", area: "salud" })));
    expect(e?.status).toBe(403);
  });

  it("al autorizar salud desde la web, WhatsApp pasa a verla", async () => {
    await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "Pedir hora médica", area: "salud" }));
    await bd.transaccion(web(), (q) => guardarAccesos(q, [{ canal: "whatsapp", area: "salud", lectura: true, escritura: false }]));
    expect(await bd.transaccion(whatsapp(), (q) => repo.listar(q, tareas))).toHaveLength(1);
  });

  it("WhatsApp NO puede cambiar sus propios permisos", async () => {
    const e = await fallaCon(bd.transaccion(whatsapp(), (q) => guardarAccesos(q, [{ canal: "whatsapp", area: "salud", lectura: true, escritura: true }])));
    expect(e?.status).toBe(403);
  });

  it("dar escritura implica dar lectura", async () => {
    const acc = await bd.transaccion(web(), (q) => guardarAccesos(q, [{ canal: "ia", area: "salud", lectura: false, escritura: true }]));
    expect(acc.find((a) => a.canal === "ia" && a.area === "salud")).toMatchObject({ lectura: true, escritura: true });
  });
});

describe("historial, papelera y recuperación", () => {
  it("registra crear, editar, eliminar y restaurar, con el canal", async () => {
    const t = await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "Informe" }));
    await bd.transaccion(whatsapp(), (q) => repo.editar(q, tareas, t.id, { prioridad: "alta" }));
    await bd.transaccion(web(), (q) => repo.eliminar(q, tareas, t.id));
    await bd.transaccion(web(), (q) => repo.restaurar(q, tareas, t.id));
    const h = await bd.transaccion(web(), (q) => repo.historial(q, tareas, t.id));
    expect(h.map((x) => x.operacion)).toEqual(["restaurar", "eliminar", "editar", "crear"]);
    expect(h.find((x) => x.operacion === "editar")).toMatchObject({ canal: "whatsapp" });
    expect(h.find((x) => x.operacion === "editar")!.antes.prioridad).toBe("media");
  });

  it("lo eliminado sale de las listas, aparece en la papelera y se recupera", async () => {
    const t = await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "Borrable" }));
    await bd.transaccion(web(), (q) => repo.eliminar(q, tareas, t.id));
    expect(await bd.transaccion(web(), (q) => repo.listar(q, tareas))).toHaveLength(0);
    expect((await bd.transaccion(web(), (q) => repo.papelera(q)))[0]).toMatchObject({ entidad: "tareas", titulo: "Borrable" });
    await bd.transaccion(web(), (q) => repo.restaurar(q, tareas, t.id));
    expect(await bd.transaccion(web(), (q) => repo.listar(q, tareas))).toHaveLength(1);
  });

  it("nadie puede escribir el historial a mano", async () => {
    const e = await fallaCon(
      bd.transaccion(web(), (q) => q("insert into historial (usuario_id, tabla, registro_id, operacion) values ($1, 'tareas', $1, 'crear')", [ANA])),
    );
    expect(e?.status).toBe(403);
  });

  it("exportar incluye la papelera y filtra por área", async () => {
    await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "Trabajo 1", area: "trabajo" }));
    const t = await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "Personal 1" }));
    await bd.transaccion(web(), (q) => repo.eliminar(q, tareas, t.id));
    const todo = await bd.transaccion(web(), (q) => repo.exportar(q));
    const trabajo = await bd.transaccion(web(), (q) => repo.exportar(q, "trabajo"));
    expect(todo.datos.tareas).toHaveLength(2);
    expect(trabajo.datos.tareas.map((x) => x.titulo)).toEqual(["Trabajo 1"]);
    expect(trabajo.datos.bienestar).toBeUndefined(); // bienestar es área personal
    expect(todo.formato).toBe("alquimia-mi-dia/v1");
  });
});

describe("validaciones y reglas", () => {
  it("título vacío → 400 con mensaje claro", async () => {
    const e = await fallaCon(bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "   " })));
    expect(e?.status).toBe(400);
    expect(e?.message).toMatch(/título/);
  });
  it("columnas que no existen en el registro se rechazan (no llegan a la base)", async () => {
    const e = await fallaCon(bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "x", usuario_id: BETO })));
    expect(e?.status).toBe(400);
  });
  it("un evento no puede terminar antes de empezar", async () => {
    const e = await fallaCon(bd.transaccion(web(), (q) => repo.crear(q, eventos, { titulo: "Kine", inicio: "2026-11-20T16:00:00-03:00", fin: "2026-11-20T15:00:00-03:00" })));
    expect(e?.status).toBe(400);
  });
  it("las tareas no aceptan el área íntima", async () => {
    const e = await fallaCon(bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "x", area: "salud_intima" })));
    expect(e?.status).toBe(400);
  });
  it("marcar una tarea como hecha guarda cuándo se completó", async () => {
    const t = await bd.transaccion(web(), (q) => repo.crear(q, tareas, { titulo: "x" }));
    const hecha = await bd.transaccion(web(), (q) => repo.editar(q, tareas, t.id, { estado: "hecha" }));
    expect(hecha.completada_en).not.toBeNull();
    const reabierta = await bd.transaccion(web(), (q) => repo.editar(q, tareas, t.id, { estado: "pendiente" }));
    expect(reabierta.completada_en).toBeNull();
  });
  it("id con formato inválido → 400 (no llega a la base)", async () => {
    expect((await fallaCon(bd.transaccion(web(), (q) => repo.obtener(q, tareas, "1 or 1=1"))))?.status).toBe(400);
  });
});

describe("bienestar del día", () => {
  it("el agua se suma, nunca baja de 0 y hay un solo registro por día", async () => {
    await bd.transaccion(web(), (q) => repo.registrarBienestar(q, "2026-11-16", { agua_vasos: 2 }));
    await bd.transaccion(web(), (q) => repo.registrarBienestar(q, "2026-11-16", { agua_vasos: 3, humor: 4 }));
    const r = await bd.transaccion(web(), (q) => repo.registrarBienestar(q, "2026-11-16", { agua_vasos: -10 }));
    expect(r).toMatchObject({ agua_vasos: 0, humor: 4 });
    expect(await bd.transaccion(web(), (q) => repo.listar(q, entidadPorNombre("bienestar")!))).toHaveLength(1);
  });
  it("humor fuera de 1-5 → 400", async () => {
    expect((await fallaCon(bd.transaccion(web(), (q) => repo.registrarBienestar(q, "2026-11-16", { humor: 9 }))))?.status).toBe(400);
  });
});

describe("configuración de módulos y widgets", () => {
  it("valores iniciales: módulos opcionales apagados, todos los widgets", async () => {
    const c = await bd.transaccion(web(), (q) => leerConfiguracion(q));
    expect(c.perfil.nombre).toBe("Ana");
    expect(c.modulos.find((m) => m.modulo === "ciclo")!.activo).toBe(false);
    expect(c.modulos.find((m) => m.modulo === "tareas")!.activo).toBe(true);
    expect(c.accesos.find((a) => a.canal === "whatsapp" && a.area === "salud_intima")).toMatchObject({ lectura: false, escritura: false });
  });
  it("guardar módulos y widgets persiste y respeta el orden", async () => {
    await bd.transaccion(web(), (q) => guardarModulos(q, [{ modulo: "ciclo", activo: true, orden: 0, config: {} }]));
    await bd.transaccion(web(), (q) => guardarWidgets(q, [{ widget: "tareas", visible: false, orden: 0, tamano: "chico", config: {} }]));
    const c = await bd.transaccion(web(), (q) => leerConfiguracion(q));
    expect(c.modulos[0]).toMatchObject({ modulo: "ciclo", activo: true });
    expect(c.widgets.find((w) => w.widget === "tareas")).toMatchObject({ visible: false, tamano: "chico" });
  });
  it("rechaza módulos que no existen", async () => {
    const e = await fallaCon(bd.transaccion(web(), (q) => guardarModulos(q, [{ modulo: "inventado", activo: true, orden: 0, config: {} }])));
    expect(e?.status).toBe(400);
  });
  it("WhatsApp no puede reconfigurar el dashboard", async () => {
    const e = await fallaCon(bd.transaccion(whatsapp(), (q) => guardarWidgets(q, [{ widget: "tareas", visible: false, orden: 0, tamano: "chico", config: {} }])));
    expect(e?.status).toBe(403);
  });
});
