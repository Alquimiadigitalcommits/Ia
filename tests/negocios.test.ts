import { describe, expect, it } from "vitest";
import type { ClienteSheets } from "../src/conectores/sheets.js";
import { agregarProveedor, fechaDesdePlanilla, fechaPlanilla, registrarVenta, resumenNegociosMes } from "../src/negocios/negocios.js";

const ahora = new Date("2026-11-14T15:00:00Z");

function sheetsFalso(tablas: Record<string, string[][]> = {}) {
  const filas: { hoja: string; valores: Record<string, unknown> }[] = [];
  const columnas: string[][] = [];
  const s: ClienteSheets = {
    async leer(r) { return tablas[r.split("!")[0]] ?? []; },
    async agregarFila(hoja, valores) { filas.push({ hoja, valores }); return 7; },
    async asegurarColumnas(_h, t) { columnas.push(t); return t; },
    async vaciarCeldas() {},
  };
  return { s, filas, columnas };
}

describe("negocios", () => {
  it("fechas en el formato de tu planilla", () => {
    expect(fechaPlanilla("2026-11-14")).toBe("14-11-2026");
    expect(fechaDesdePlanilla("14-11-2026")).toBe("2026-11-14");
    expect(fechaDesdePlanilla("4/1/2026")).toBe("2026-01-04");
    expect(fechaDesdePlanilla("")).toBeNull();
  });

  it("venta: calcula ingreso bruto y usa los títulos exactos de '03 - Ventas'", async () => {
    const { s, filas } = sheetsFalso();
    const r = await registrarVenta(s, { negocio: "Detalles", producto: "Aros", cantidad: 2, precioUnitario: 8000, descuento: 1000, medioPago: "Transferencia" }, ahora);
    expect(filas[0].hoja).toBe("03 - Ventas");
    expect(filas[0].valores).toMatchObject({ Fecha: "14-11-2026", Negocio: "Detalles", "Producto/servicio": "Aros", "Ingreso bruto": 15000, "Medio de pago": "Transferencia" });
    expect(String(filas[0].valores["ID venta"])).toMatch(/^V-20261114-/);
    expect(r).toMatchObject({ fila: 7, hoja: "03 - Ventas" });
    expect(r.resumen).toContain("$15.000");
  });

  it("proveedor: primero asegura las 5 columnas autorizadas", async () => {
    const { s, filas, columnas } = sheetsFalso();
    await agregarProveedor(s, { nombre: "Telas Ñuñoa", categoria: "Telas", queVende: "Lino", comuna: "Ñuñoa" }, ahora);
    expect(columnas[0]).toEqual(["Dirección", "Comuna", "Qué vende", "Precio de referencia", "Fecha de registro"]);
    expect(filas[0].valores).toMatchObject({ Proveedor: "Telas Ñuñoa", "Qué vende": "Lino", Comuna: "Ñuñoa" });
  });

  it("resumen del mes por negocio, sin depender de fórmulas", async () => {
    const { s } = sheetsFalso({
      "03 - Ventas": [
        ["Fecha", "Negocio", "Cantidad", "Precio unitario", "Descuento total", "Ingreso bruto"],
        ["02-11-2026", "Detalles", "2", "8000", "0", ""],
        ["10-11-2026", "Detalles", "1", "5000", "0", "5000"],
        ["30-10-2026", "Detalles", "9", "9000", "0", ""], // otro mes: no cuenta
        ["05-11-2026", "Ropa", "1", "20000", "2000", ""],
      ],
      "04 - Gastos": [["Fecha", "Negocio", "Monto"], ["03-11-2026", "Detalles", "3000"]],
      "05 - Compras": [["Fecha", "Negocio", "Costo total compra"], ["01-11-2026", "Ropa", "10000"]],
    });
    const r = await resumenNegociosMes(s, ahora);
    const det = r.negocios.find((n) => n.negocio === "Detalles")!;
    const ropa = r.negocios.find((n) => n.negocio === "Ropa")!;
    expect(det).toMatchObject({ ventas: 21000, gastos: 3000, resultado: 18000, unidades: 3 });
    expect(ropa).toMatchObject({ ventas: 18000, compras: 10000, resultado: 8000 });
  });
});
