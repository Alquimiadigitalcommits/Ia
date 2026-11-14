import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { crearClienteSheets, letraColumna, primeraFilaLibre } from "../src/conectores/sheets.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const cred = { client_email: "robot@proyecto.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

/** Planilla falsa en memoria que entiende las llamadas que hace el conector. */
function planillaFalsa(hojas: Record<string, string[][]>) {
  const escrituras: { range: string; values: unknown[][] }[] = [];
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
    const u = new URL(url);
    if (u.pathname.endsWith("/values:batchUpdate")) {
      const body = JSON.parse(String(init!.body));
      for (const d of body.data) {
        escrituras.push(d);
        const [, hoja, col, fila] = d.range.match(/^'(.+)'!([A-Z]+)(\d+)$/)!;
        const c = col.charCodeAt(0) - 65;
        const f = Number(fila) - 1;
        (hojas[hoja][f] ??= [])[c] = String(d.values[0][0]);
      }
      return new Response("{}");
    }
    const m = decodeURIComponent(u.pathname).match(/values\/'(.+)'!(.+)$/)!;
    const [hoja, r] = [m[1], m[2]];
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      const c = r.charCodeAt(0) - 65;
      body.values[0].forEach((v: string, i: number) => (hojas[hoja][0][c + i] = v));
      return new Response("{}");
    }
    const unaFila = r.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
    const filas = r === "1:1" ? hojas[hoja].slice(0, 1)
      : unaFila && unaFila[1] === unaFila[2] ? [hojas[hoja][Number(unaFila[1]) - 1] ?? []]
      : hojas[hoja];
    return new Response(JSON.stringify({ values: filas }));
  });
  return { fetchFalso, escrituras, hojas };
}

describe("conector de Google Sheets", () => {
  it("letras de columna", () => {
    expect([0, 25, 26, 27, 51].map(letraColumna)).toEqual(["A", "Z", "AA", "AB", "AZ"]);
  });

  it("primera fila libre: salta filas con datos, aunque estén a medio llenar", () => {
    const filas = [["Fecha", "ID", "Descripción"], ["07-11-2026", "1", ""], ["", "", ""]];
    expect(primeraFilaLibre(filas, [0, 2])).toBe(3);
    expect(primeraFilaLibre(filas, [2])).toBe(2);
  });

  it("primera fila libre: una fila preparada solo con fórmulas SÍ está libre (error corregido)", () => {
    const filas = [["Cantidad", "Total"], ["3", "=A2*2"], ["", "=A3*2"]];
    expect(primeraFilaLibre(filas, [0, 1])).toBe(3);
  });

  it("escribe por título de columna y NUNCA pisa una fórmula", async () => {
    const { fetchFalso, escrituras, hojas } = planillaFalsa({
      "03 - Ventas": [
        ["Fecha", "Negocio", "Cantidad", "Precio unitario", "Ingreso bruto"],
        ["", "", "", "", "=C2*D2"], // fila preparada con fórmula
      ],
    });
    const s = crearClienteSheets(cred, "planilla", fetchFalso as any);
    const fila = await s.agregarFila("03 - Ventas", { Fecha: "14-11-2026", Negocio: "Detalles", Cantidad: 2, "Precio unitario": 8000, "Ingreso bruto": 16000 });
    expect(fila).toBe(2);
    expect(hojas["03 - Ventas"][1]).toEqual(["14-11-2026", "Detalles", "2", "8000", "=C2*D2"]);
    expect(escrituras.map((e) => e.range)).not.toContain("'03 - Ventas'!E2");
  });

  it("encuentra columnas aunque cambien tildes o mayúsculas", async () => {
    const { fetchFalso, hojas } = planillaFalsa({ "04 - Gastos": [["FECHA", "categoria", "Monto"]] });
    await crearClienteSheets(cred, "p", fetchFalso as any).agregarFila("04 - Gastos", { Fecha: "x", "Categoría": "Envíos", Monto: 3000 });
    expect(hojas["04 - Gastos"][1]).toEqual(["x", "Envíos", "3000"]);
  });

  it("avisa claro si falta una columna (no escribe en cualquier lado)", async () => {
    const { fetchFalso } = planillaFalsa({ H: [["Fecha"]] });
    await expect(crearClienteSheets(cred, "p", fetchFalso as any).agregarFila("H", { Monto: 1 })).rejects.toThrow(/no tiene la columna "Monto"/);
  });

  it("agrega columnas nuevas a la derecha sin mover las existentes", async () => {
    const { fetchFalso, hojas } = planillaFalsa({ P: [["ID proveedor", "Proveedor"]] });
    const s = crearClienteSheets(cred, "p", fetchFalso as any);
    expect(await s.asegurarColumnas("P", ["Comuna", "Proveedor"])).toEqual(["Comuna"]);
    expect(hojas.P[0]).toEqual(["ID proveedor", "Proveedor", "Comuna"]);
  });

  it("deshacer vacía solo lo escrito y respeta fórmulas", async () => {
    const { fetchFalso, hojas } = planillaFalsa({ V: [["Fecha", "Total"], ["14-11-2026", "=1+1"]] });
    await crearClienteSheets(cred, "p", fetchFalso as any).vaciarCeldas("V", 2, ["Fecha", "Total"]);
    expect(hojas.V[1]).toEqual(["", "=1+1"]);
  });
});
