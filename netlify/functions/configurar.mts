// Sube la credencial de Google (cuenta de servicio) a Netlify Blobs, una sola vez.
// Protegido con DASHBOARD_CLAVE. Ver la página /configurar.html.
import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { claveValida, json } from "../../src/nucleo/acceso.js";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);
  if (!claveValida(req)) return json({ error: "Clave incorrecta" }, 401);
  const cred = await req.json().catch(() => null);
  if (!cred?.client_email || !cred?.private_key || cred.type !== "service_account") {
    return json({ error: "Ese archivo no es una credencial de cuenta de servicio de Google (.json)." }, 400);
  }
  await getStore("configuracion").setJSON("google-credenciales", { client_email: cred.client_email, private_key: cred.private_key });
  // Solo se devuelve el correo (es lo que hay que compartir en la planilla), nunca la llave.
  return json({ ok: true, compartirCon: cred.client_email });
};

export const config: Config = { path: "/api/configurar-google" };
