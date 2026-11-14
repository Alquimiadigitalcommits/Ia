import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extraerMensajes, firmaValida, verificarWebhook } from "../src/conectores/whatsapp.js";

const payload = {
  entry: [{ changes: [{ value: {
    contacts: [{ wa_id: "56911111111", profile: { name: "Tami" } }],
    messages: [
      { id: "wamid.1", from: "56911111111", timestamp: "1763132400", type: "text", text: { body: "idea #Plasok" } },
      { id: "wamid.2", from: "56911111111", timestamp: "1763132400", type: "image", image: { id: "m1", mime_type: "image/jpeg", caption: "ref" } },
      { id: "wamid.3", from: "56911111111", timestamp: "1763132400", type: "sticker", sticker: {} },
    ],
  } }] }],
};

describe("webhook de WhatsApp", () => {
  it("convierte el payload de Meta en mensajes simples", () => {
    const m = extraerMensajes(payload);
    expect(m.map((x) => [x.id, x.tipo, x.texto])).toEqual([
      ["wamid.1", "text", "idea #Plasok"],
      ["wamid.2", "image", "ref"],
      ["wamid.3", "otro", ""],
    ]);
    expect(m[1].mediaId).toBe("m1");
    expect(m[0].nombrePerfil).toBe("Tami");
  });

  it("ignora avisos de estado (entregado / leído)", () => {
    expect(extraerMensajes({ entry: [{ changes: [{ value: { statuses: [{ status: "read" }] } }] }] })).toEqual([]);
  });

  it("acepta solo mensajes firmados por Meta", () => {
    const cuerpo = JSON.stringify(payload);
    const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
    expect(firmaValida(cuerpo, firma, "secreto")).toBe(true);
    expect(firmaValida(cuerpo + " ", firma, "secreto")).toBe(false); // cuerpo alterado
    expect(firmaValida(cuerpo, "sha256=00", "secreto")).toBe(false);
    expect(firmaValida(cuerpo, null, "secreto")).toBe(false);
  });

  it("responde la verificación de Meta solo con el token correcto", () => {
    const ok = new URLSearchParams("hub.mode=subscribe&hub.verify_token=abc&hub.challenge=42");
    expect(verificarWebhook(ok, "abc")).toBe("42");
    expect(verificarWebhook(ok, "otro")).toBeNull();
  });
});
