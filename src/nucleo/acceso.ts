import { timingSafeEqual } from "node:crypto";

/** Los datos personales (salud, ciclo, medicamentos) solo se entregan con la clave del dashboard. */
export function claveValida(req: Request): boolean {
  const esperada = process.env.DASHBOARD_CLAVE ?? "";
  if (esperada.length < 8) return false; // sin clave configurada no se abre nada
  const recibida = req.headers.get("x-clave") ?? new URL(req.url).searchParams.get("clave") ?? "";
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
