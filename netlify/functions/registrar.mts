import type { Config } from "@netlify/functions";
import { claveValida, json } from "../../src/nucleo/acceso.js";
import { basesDesdeEntorno, registrar, type Registro } from "../../src/personal/personal.js";

const valido = (r: any): r is Registro =>
  (r?.tipo === "agua" && Number.isFinite(r.vasos) && Math.abs(r.vasos) <= 10) ||
  (r?.tipo === "humor" && [1, 2, 3, 4, 5].includes(r.valor)) ||
  (r?.tipo === "kine" && typeof r.hecha === "boolean") ||
  (["ejercicio", "lectura"].includes(r?.tipo) && Number.isFinite(r.minutos) && r.minutos >= 0 && r.minutos <= 600) ||
  (r?.tipo === "sueno" && Number.isFinite(r.horas) && r.horas >= 0 && r.horas <= 24);

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);
  if (!claveValida(req)) return json({ error: "Clave incorrecta" }, 401);
  const cuerpo = await req.json().catch(() => null);
  if (!valido(cuerpo)) return json({ error: "Registro no válido" }, 400);
  try {
    await registrar(basesDesdeEntorno(), cuerpo);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
};

export const config: Config = { path: "/api/registrar" };
