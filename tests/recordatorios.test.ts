import { describe, expect, it } from "vitest";
import { horaChile, recordatoriosPendientes } from "../src/canales/recordatorios.js";
import { ventanaAbierta } from "../src/nucleo/estado.js";

const resumenFalso: any = {
  agua: { metaAgua: 8 },
  eventos: [
    { hora: "08:00", titulo: "Vitamina D", detalle: "1 cápsula", tipo: "medicamento" },
    { hora: "13:00", titulo: "Hierro", detalle: "", tipo: "medicamento" },
    { hora: "—", titulo: "Elongación", detalle: "", tipo: "kine" },
  ],
  fechas: [{ evento: "Pago arriendo", dias: 3, avisar: 3 }, { evento: "Cumple", dias: 10, avisar: 2 }],
  ciclo: { diasParaProximo: 1 },
};
// 11:05 UTC = 08:05 en Chile (horario de verano, UTC-3)
const a_las_0805 = new Date("2026-11-14T11:05:00Z");

describe("recordatorios gratuitos", () => {
  it("hora de Chile", () => expect(horaChile(a_las_0805)).toBe("08:05"));

  it("08:05 → resumen del día + medicamento de las 08:00", () => {
    const r = recordatoriosPendientes(resumenFalso, { historial: [] }, a_las_0805);
    expect(r.map((x) => x.clave)).toEqual(["2026-11-14:resumen", "2026-11-14:08:00:Vitamina D"]);
    expect(r[0].texto).toContain("Pago arriendo: en 3 días");
    expect(r[0].texto).not.toContain("Cumple");
    expect(r[0].texto).toContain("Periodo estimado en 1 días");
  });

  it("no repite lo ya enviado", () => {
    const r = recordatoriosPendientes(resumenFalso, { historial: [], recordatoriosEnviados: ["2026-11-14:resumen", "2026-11-14:08:00:Vitamina D"] }, a_las_0805);
    expect(r).toEqual([]);
  });

  it("avisa 1 hora antes de que se cierre la ventana gratuita, una sola vez", () => {
    const ultimo = new Date(a_las_0805.getTime() - 23 * 3600_000 + 50 * 60_000).toISOString(); // quedan ~50 min
    const r = recordatoriosPendientes({ ...resumenFalso, eventos: [] }, { historial: [], ultimoEntrante: ultimo }, new Date("2026-11-14T16:00:00Z"));
    // a las 13:00 Chile no hay resumen; solo cuenta el aviso si cae en el rango
    const ahora = new Date(Date.parse(ultimo) + 24 * 3600_000 - 50 * 60_000);
    const aviso = recordatoriosPendientes({ ...resumenFalso, eventos: [] }, { historial: [], ultimoEntrante: ultimo }, ahora);
    expect(aviso.some((x) => x.clave.startsWith("renovar:"))).toBe(true);
    expect(r.some((x) => x.clave.startsWith("renovar:"))).toBe(false);
  });

  it("ventana: abierta 23 h después, cerrada a las 24 h", () => {
    const e = { historial: [], ultimoEntrante: "2026-11-13T12:00:00Z" };
    expect(ventanaAbierta(e, new Date("2026-11-14T11:00:00Z"))).toBe(true);
    expect(ventanaAbierta(e, new Date("2026-11-14T12:00:00Z"))).toBe(false);
    expect(ventanaAbierta({ historial: [] }, new Date())).toBe(false);
  });
});
