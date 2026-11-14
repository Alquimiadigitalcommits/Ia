import type { Config } from "@netlify/functions";
import { claveValida, json } from "../../src/nucleo/acceso.js";
import { basesDesdeEntorno, resumen } from "../../src/personal/personal.js";

export default async (req: Request) => {
  if (!claveValida(req)) return json({ error: "Clave incorrecta" }, 401);
  try {
    return json(await resumen(basesDesdeEntorno()));
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
};

export const config: Config = { path: "/api/resumen" };
