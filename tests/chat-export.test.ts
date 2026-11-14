import { describe, expect, it } from "vitest";
import { agrupar, leerChat } from "../src/ideas/chat-export.js";

const android = [
  "02/10/2026, 21:14 - Los mensajes y las llamadas están cifrados de extremo a extremo.",
  "02/10/2026, 21:14 - Tamara: https://vm.tiktok.com/ZMabc123/",
  "02/10/2026, 21:15 - Tamara: hacer esto con mi rutina de noche",
  "con el serum de niacinamida",
  "03/10/2026, 9:02 - Tamara: <Multimedia omitido>",
  "05/10/2026, 18:40 - Tamara: storytime del cerro san cristóbal",
].join("\n");
const iphone = [
  "[14/11/26, 10:32:15] Tamara: ‎imagen omitida",
  "[14/11/26, 10:33:01] Tamara: setup gamer tour",
  "[14/11/26, 3:05:00 p. m.] Tamara: cafés para trabajar en providencia",
].join("\n");

describe("chat exportado de WhatsApp", () => {
  it("Android: lee fecha, autor y mensajes de varias líneas; omite avisos del sistema", () => {
    const m = leerChat(android);
    expect(m).toHaveLength(4);
    expect(m[1].texto).toBe("hacer esto con mi rutina de noche\ncon el serum de niacinamida");
    expect(m[2].adjunto).toBe("multimedia");
    expect(m[0].fecha.getMonth()).toBe(9); // octubre: el formato es día/mes
  });

  it("iPhone: entiende 'p. m.' y limpia 'imagen omitida'", () => {
    const m = leerChat(iphone);
    expect(m[0]).toMatchObject({ texto: "", adjunto: "imagen" });
    expect(m[2].fecha.getHours()).toBe(15);
  });

  it("junta link + nota enviados con menos de 3 minutos", () => {
    const ideas = agrupar(leerChat(android));
    expect(ideas[0].texto).toContain("vm.tiktok.com");
    expect(ideas[0].texto).toContain("rutina de noche");
    expect(ideas[0].mensajes).toBe(2);
    expect(ideas).toHaveLength(3);
  });
});
