import type { Config } from "@netlify/functions";
import { crearClienteNotion } from "../../src/conectores/notion.js";
import { sheetsDesdeEntorno } from "../../src/conectores/sheets.js";
import { resumenNegociosMes } from "../../src/negocios/negocios.js";
import { claveValida, json } from "../../src/nucleo/acceso.js";
import { resumenFinanzasMes } from "../../src/personal/finanzas.js";
import { basesDesdeEntorno, resumen } from "../../src/personal/personal.js";

export default async (req: Request) => {
  if (!claveValida(req)) return json({ error: "Clave incorrecta" }, 401);
  try {
    const bases = basesDesdeEntorno();
    const notion = crearClienteNotion(bases.token);
    const ahora = new Date();
    const dbFinanzas = process.env.NOTION_DB_FINANZAS_PERSONALES;
    const sheets = await sheetsDesdeEntorno();
    // Las tres lecturas en paralelo. Si finanzas o negocios fallan, el resto del dashboard igual carga.
    const [dia, personal, negocios] = await Promise.all([
      resumen(bases, ahora, notion),
      dbFinanzas ? resumenFinanzasMes(notion, dbFinanzas, ahora).catch((e) => ({ error: String(e.message) })) : null,
      sheets ? resumenNegociosMes(sheets, ahora).catch((e) => ({ error: String(e.message) })) : null,
    ]);
    return json({ ...dia, finanzas: { personal, negocios } });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
};

export const config: Config = { path: "/api/resumen" };
