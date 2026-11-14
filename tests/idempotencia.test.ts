import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registroArchivo, registroMemoria } from "../src/nucleo/idempotencia.js";

describe("registro de mensajes procesados", () => {
  it("solo la primera copia de un mensaje se procesa", async () => {
    const r = registroMemoria();
    const [a, b] = await Promise.all([r.reclamar("wamid.1"), r.reclamar("wamid.1")]);
    expect([a, b].sort()).toEqual([false, true]);
  });

  it("liberar permite reprocesar (cuando falló a mitad de camino)", async () => {
    const r = registroMemoria();
    await r.reclamar("x");
    await r.liberar("x");
    expect(await r.reclamar("x")).toBe(true);
  });

  it("archivo: 3 trabajadores en paralelo no se pisan (error corregido en 1.3)", async () => {
    const ruta = join(await mkdtemp(join(tmpdir(), "idem-")), "importados.json");
    const r = registroArchivo(ruta);
    await Promise.all(["a", "b", "c", "d", "e", "f"].map((id) => r.reclamar(id)));
    const guardados = JSON.parse(await readFile(ruta, "utf8"));
    expect(guardados.sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
    // Una segunda corrida (registro nuevo, mismo archivo) salta lo ya importado
    expect(await registroArchivo(ruta).reclamar("c")).toBe(false);
    expect(await registroArchivo(ruta).reclamar("z")).toBe(true);
  });
});
