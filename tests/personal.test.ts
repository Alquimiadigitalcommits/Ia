import { describe, expect, it } from "vitest";
import { calcularCiclo, fechaISO, horarios, proximaOcurrencia, sumarDias } from "../src/personal/personal.js";

describe("dashboard: cálculos", () => {
  it("ciclo: promedio, día actual y próximo inicio", () => {
    const c = calcularCiclo(
      [{ inicio: "2026-10-20", fin: "2026-10-24" }, { inicio: "2026-09-22", fin: null }, { inicio: "2026-08-24", fin: null }],
      "2026-11-14",
    )!;
    expect(c.duracionPromedio).toBe(29); // (29 + 28) / 2 redondeado
    expect(c.diaDelCiclo).toBe(26);
    expect(c.proximoInicio).toBe("2026-11-18");
    expect(c.enPeriodo).toBe(false);
    expect(c.diasPeriodo).toHaveLength(5);
  });

  it("ciclo: sin registros no inventa nada", () => expect(calcularCiclo([], "2026-11-14")).toBeNull());

  it("ciclo: ignora diferencias imposibles (registro duplicado o mes olvidado)", () => {
    const c = calcularCiclo([{ inicio: "2026-11-01", fin: null }, { inicio: "2026-10-30", fin: null }, { inicio: "2026-08-01", fin: null }], "2026-11-14")!;
    expect(c.duracionPromedio).toBe(28); // 2 días y 90 días se descartan → valor por defecto
  });

  it("cumpleaños que se repiten: próxima ocurrencia", () => {
    expect(proximaOcurrencia("1990-03-02", true, "2026-11-14")).toBe("2027-03-02");
    expect(proximaOcurrencia("1990-12-02", true, "2026-11-14")).toBe("2026-12-02");
    expect(proximaOcurrencia("2026-11-20", false, "2026-11-14")).toBe("2026-11-20");
  });

  it("horarios de medicamentos: acepta '8:00, 20:00' y descarta texto suelto", () => {
    expect(horarios("8:00, 20:00 después de comer")).toEqual(["08:00", "20:00"]);
  });

  it("usa la hora de Chile: 23:00 del 14 en Santiago sigue siendo el 14", () => {
    expect(fechaISO(new Date("2026-11-15T02:00:00Z"))).toBe("2026-11-14");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});
