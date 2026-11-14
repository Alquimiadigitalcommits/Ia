import { describe, expect, it, vi } from "vitest";
import { crearClienteNotion, ErrorNotion, escribir, leer } from "../src/conectores/notion.js";

const respuesta = (status: number, cuerpo: object = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers });

describe("conector de Notion", () => {
  it("reintenta cuando Notion responde 429 y luego entrega el resultado", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuesta(429))
      .mockResolvedValueOnce(respuesta(429))
      .mockResolvedValueOnce(respuesta(200, { id: "p1", url: "https://notion.so/p1" }));
    const notion = crearClienteNotion("token", fetchFalso as any, 1);
    await expect(notion.crearPagina("db", {})).resolves.toEqual({ id: "p1", url: "https://notion.so/p1" });
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it("respeta el tiempo que pide Notion en Retry-After", async () => {
    const fetchFalso = vi.fn().mockResolvedValueOnce(respuesta(429, {}, { "retry-after": "0.05" })).mockResolvedValueOnce(respuesta(200, {}));
    const inicio = Date.now();
    await crearClienteNotion("t", fetchFalso as any, 1).pedir("GET", "x");
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(45);
  });

  it("se rinde después de 4 reintentos si Notion sigue caído", async () => {
    const fetchFalso = vi.fn().mockImplementation(async () => respuesta(503, { code: "service_unavailable", message: "caído" }));
    await expect(crearClienteNotion("t", fetchFalso as any, 1).pedir("GET", "x")).rejects.toBeInstanceOf(ErrorNotion);
    expect(fetchFalso).toHaveBeenCalledTimes(5); // 1 intento + 4 reintentos
  });

  it("NO reintenta un 400 (dato mal enviado)", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respuesta(400, { code: "validation_error", message: "Formato no existe" }));
    await expect(crearClienteNotion("t", fetchFalso as any, 1).pedir("POST", "pages", {})).rejects.toThrow(/validation_error/);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("reintenta un corte de red", async () => {
    const fetchFalso = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(respuesta(200, { ok: 1 }));
    await expect(crearClienteNotion("t", fetchFalso as any, 1).pedir("GET", "x")).resolves.toEqual({ ok: 1 });
  });

  it("pide todas las páginas de una consulta (paginación)", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuesta(200, { results: [1, 2], has_more: true, next_cursor: "c2" }))
      .mockResolvedValueOnce(respuesta(200, { results: [3], has_more: false }));
    const filas = await crearClienteNotion("t", fetchFalso as any, 1).consultar("db");
    expect(filas).toEqual([1, 2, 3]);
    expect(JSON.parse(fetchFalso.mock.calls[1][1].body).start_cursor).toBe("c2");
  });

  it("lee y escribe propiedades con el formato de Notion", () => {
    expect(leer.texto({ title: [{ plain_text: "Hola " }, { plain_text: "mundo" }] })).toBe("Hola mundo");
    expect(leer.opcion({ status: { name: "Capturada" } })).toBe("Capturada");
    expect(escribir.opcion("Ropa, calzado")).toEqual({ select: { name: "Ropa  calzado" } }); // Notion no acepta comas
    expect(escribir.texto("x".repeat(3000)).rich_text[0].text.content).toHaveLength(2000);
    expect(escribir.relacion(["a", "b"])).toEqual({ relation: [{ id: "a" }, { id: "b" }] });
  });
});
