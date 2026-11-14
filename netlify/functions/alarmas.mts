// Alarmas del día para Android (MacroDroid o Tasker).
//   JSON:   /api/alarmas-hoy?clave=XXXX
//   Texto:  /api/alarmas-hoy?clave=XXXX&formato=texto   → una línea por alarma: 08:00|Losartán · 50 mg
import type { Config } from "@netlify/functions";
import { claveValida, json } from "../../src/acceso.js";
import { alarmasDelDia, basesDesdeEntorno, resumen } from "../../src/personal.js";

export default async (req: Request) => {
  if (!claveValida(req)) return json({ error: "Clave incorrecta" }, 401);
  const alarmas = alarmasDelDia(await resumen(basesDesdeEntorno()));
  if (new URL(req.url).searchParams.get("formato") === "texto") {
    return new Response(alarmas.map((a) => `${a.hora}|${a.etiqueta}`).join("\n"), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return json({ alarmas });
};

export const config: Config = { path: "/api/alarmas-hoy" };
