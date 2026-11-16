import { MODO_LOCAL, supabase } from "./supabase";

export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

async function token(): Promise<string | null> {
  if (MODO_LOCAL) return "local";
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}

export async function api<T = any>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const t = await token();
  let res: Response;
  try {
    res = await fetch(`/api/v1${ruta}`, {
      method: metodo,
      headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "Sin conexión. Revisa tu internet e intenta de nuevo.");
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(res.status, datos.error ?? `Error ${res.status}`);
  return datos as T;
}

/** Descarga un archivo de la API (exportaciones) usando la sesión actual. */
export async function descargar(ruta: string, nombre: string) {
  const t = await token();
  const res = await fetch(`/api/v1${ruta}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) throw new ErrorApi(res.status, (await res.json().catch(() => ({}))).error ?? "No se pudo exportar.");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
