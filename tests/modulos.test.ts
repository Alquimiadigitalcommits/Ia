import { describe, expect, it } from "vitest";
import { aISOConZona, desfaseMinutos, hoyISO } from "../app/src/lib/fechas.js";
import { completarModulos, completarWidgets, mover, MODULOS, WIDGETS, widgetsVisibles } from "../shared/modulos.js";

describe("sistema de módulos y widgets", () => {
  it("una cuenta nueva: módulos opcionales apagados, básicos encendidos", () => {
    const m = completarModulos([]);
    expect(m).toHaveLength(MODULOS.length);
    expect(m.find((x) => x.modulo === "intimo")!.activo).toBe(false);
    expect(m.find((x) => x.modulo === "agenda")!.activo).toBe(true);
  });

  it("los módulos nuevos que se agreguen en el futuro aparecen solos en cuentas existentes", () => {
    const guardados = [{ modulo: "tareas", activo: false, orden: 0, config: {} }];
    const m = completarModulos(guardados);
    expect(m[0]).toMatchObject({ modulo: "tareas", activo: false });
    expect(m).toHaveLength(MODULOS.length);
  });

  it("el dashboard no muestra widgets de módulos apagados ni de módulos sin construir", () => {
    const modulos = completarModulos([{ modulo: "tareas", activo: false, orden: 0, config: {} }]);
    const ids = widgetsVisibles(completarWidgets([]), modulos).map((w) => w.widget);
    expect(ids).not.toContain("tareas"); // módulo apagado
    expect(ids).not.toContain("finanzas"); // fase 3, todavía no construido
    expect(ids).toContain("resumen"); // no depende de módulo
  });

  it("ocultar un widget lo saca del dashboard", () => {
    const w = completarWidgets([{ widget: "agenda", visible: false, orden: 0, tamano: "mediano", config: {} }]);
    expect(widgetsVisibles(w, completarModulos([])).map((x) => x.widget)).not.toContain("agenda");
  });

  it("mover reordena y renumera; en los bordes no hace nada", () => {
    const lista = [{ id: "a", orden: 0 }, { id: "b", orden: 1 }, { id: "c", orden: 2 }];
    expect(mover(lista, 2, -1).map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(mover(lista, 0, -1).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(mover(lista, 0, 1).map((x) => x.orden)).toEqual([0, 1, 2]);
  });

  it("cada widget apunta a un módulo que existe", () => {
    for (const w of WIDGETS) if (w.modulo) expect(MODULOS.some((m) => m.id === w.modulo)).toBe(true);
  });
});

describe("fechas en la zona horaria de la persona", () => {
  it("Chile en verano es UTC-3 y en invierno UTC-4", () => {
    expect(desfaseMinutos("America/Santiago", new Date("2026-11-16T15:00:00Z"))).toBe(-180);
    expect(desfaseMinutos("America/Santiago", new Date("2026-07-16T15:00:00Z"))).toBe(-240);
  });
  it("un evento a las 18:30 se guarda con el desfase correcto según la fecha", () => {
    expect(aISOConZona("2026-11-20", "18:30", "America/Santiago")).toBe("2026-11-20T18:30:00-03:00");
    expect(aISOConZona("2026-07-20", "18:30", "America/Santiago")).toBe("2026-07-20T18:30:00-04:00");
    expect(aISOConZona("2026-07-20", "18:30", "Europe/Madrid")).toBe("2026-07-20T18:30:00+02:00");
  });
  it("'hoy' respeta la zona: 23:30 del 16 en Chile sigue siendo el 16", () => {
    expect(hoyISO("America/Santiago", new Date("2026-11-17T02:30:00Z"))).toBe("2026-11-16");
  });
});
