import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteNotion } from "../src/conectores/notion.js";
import type { IdeaClasificada } from "../src/ideas/clasificar.js";
import { registroMemoria } from "../src/nucleo/idempotencia.js";

// Claude y la lectura de links se reemplazan por versiones falsas: las pruebas no gastan ni usan internet.
const ideaFalsa: IdeaClasificada = {
  titulo: "Picoteo de viernes en 3 pasos",
  de_que_trata: "Tabla de quesos y frutos secos armada en cámara cenital",
  resumen: "Armar una tabla con productos del mesón.",
  clientes_sugeridos: [{ cliente: "Sabor a Semilla", encaje: "Alto", por_que: "Vende quesos y frutos secos", como_adaptarlo: "Tabla con productos del mesón y precios visibles" }],
  plataformas: ["Instagram", "TikTok"],
  formato: "Video corto vertical",
  nicho: "Gastronomía",
  tipo: "Producto / receta",
  hook: "Tu picoteo del viernes por menos de 10 lucas",
  estructura: ["Mostrar productos", "Armar tabla", "Precio total"],
  audio_o_tendencia: "",
  caduca: false,
  prioridad: "Media",
  tags: ["picoteo", "quesos"],
  es_referencia: false,
};
const clasificar = vi.fn();
vi.mock("../src/ideas/clasificar.js", () => ({ clasificarIdea: (...a: unknown[]) => clasificar(...a) }));
vi.mock("../src/conectores/referencias.js", async (original) => ({
  ...(await original<typeof import("../src/conectores/referencias.js")>()),
  leerReferencias: async (links: string[]) => links.map((url) => ({ url, plataforma: "TikTok" })),
}));

const { clienteDesdeHashtag, guardarIdea, propiedadesIdea } = await import("../src/ideas/guardar.js");

const notionFalso = () => {
  const creadas: any[] = [];
  const cli: ClienteNotion = {
    pedir: vi.fn(),
    consultar: vi.fn(),
    actualizarPagina: vi.fn(),
    crearPagina: vi.fn(async (db, properties, children) => {
      creadas.push({ db, properties, children });
      return { id: "p1", url: "https://notion.so/p1" };
    }),
  };
  return { cli, creadas };
};
const entrada = (extra = {}) => ({
  idOrigen: "wamid.1",
  fecha: new Date("2026-11-14T15:00:00Z"),
  texto: "tabla de quesos para el viernes https://www.tiktok.com/@x/video/1",
  remitente: "Tamara",
  origen: "WhatsApp" as const,
  ...extra,
});

beforeEach(() => clasificar.mockReset().mockResolvedValue(ideaFalsa));

describe("#Cliente en el mensaje", () => {
  it.each([
    ["idea para #Plasok", "Plasok"],
    ["#saborasemilla promo", "Sabor a Semilla"],
    ["#Sky día 1 aprendiendo", "Sky · Marca personal"],
    ["#medio_relato", "Medio Relato"],
    ["sin cliente", undefined],
  ])("%s → %s", (texto, esperado) => expect(clienteDesdeHashtag(texto)).toBe(esperado));
});

describe("guardar idea", () => {
  it("crea la fila con las columnas reales de 'Ideas y referencias' y la relación al cliente", async () => {
    const { cli, creadas } = notionFalso();
    const r = await guardarIdea(cli, "db-ideas", registroMemoria(), entrada());
    expect(r?.clientes).toEqual(["Sabor a Semilla"]);
    const p = creadas[0].properties;
    expect(creadas[0].db).toBe("db-ideas");
    expect(p.Idea.title[0].text.content).toBe("Picoteo de viernes en 3 pasos");
    expect(p.Cliente).toEqual({ relation: [{ id: "4046150dcd6881fab81aebcf216caf99" }] });
    expect(p.Formato).toEqual({ select: { name: "Video corto vertical" } });
    expect(p.Potencial).toEqual({ select: { name: "Alto" } });
    expect(p.Fuente).toEqual({ select: { name: "Equipo" } });
    expect(p.Referencia).toEqual({ url: "https://www.tiktok.com/@x/video/1" });
  });

  it("el mismo mensaje dos veces crea UNA sola fila", async () => {
    const { cli, creadas } = notionFalso();
    const registro = registroMemoria();
    const [a, b] = await Promise.all([guardarIdea(cli, "db", registro, entrada()), guardarIdea(cli, "db", registro, entrada())]);
    expect(creadas).toHaveLength(1);
    expect([a, b].filter((x) => x === null)).toHaveLength(1);
  });

  it("si Notion falla, libera el mensaje para que el reintento lo guarde", async () => {
    const { cli } = notionFalso();
    (cli.crearPagina as any).mockRejectedValueOnce(new Error("Notion caído"));
    const registro = registroMemoria();
    await expect(guardarIdea(cli, "db", registro, entrada())).rejects.toThrow("Notion caído");
    await expect(guardarIdea(cli, "db", registro, entrada())).resolves.not.toBeNull();
  });

  it("si Claude falla, la idea igual se guarda (sin clasificar)", async () => {
    clasificar.mockResolvedValueOnce(null);
    const { cli, creadas } = notionFalso();
    const r = await guardarIdea(cli, "db", registroMemoria(), entrada({ texto: "idea suelta" }));
    expect(r?.idea).toBeNull();
    expect(creadas[0].properties.Idea.title[0].text.content).toBe("idea suelta");
  });

  it("si escribe un cliente, queda como Fuente: Cliente y su ficha va primero", () => {
    const p = propiedadesIdea(entrada({ esCliente: true }), ideaFalsa, [], ["Plasok", "Sabor a Semilla"]);
    expect(p.Fuente).toEqual({ select: { name: "Cliente" } });
    expect((p.Cliente as any).relation[0].id).toBe("4046150dcd6881a2b55deb13b0a83496");
  });
});
