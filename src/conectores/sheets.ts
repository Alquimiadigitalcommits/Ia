// Conector de Google Sheets con "cuenta de servicio" (un usuario robot de Google).
// La planilla se comparte con el correo del robot como Editor; nada más tiene acceso.
//
// Por qué no se usa "append" de Google: tu planilla trae filas preparadas con fórmulas
// hasta la fila 501. "append" escribiría en la 502. En cambio, este conector:
//   1. busca las columnas por su TÍTULO (si cambias el orden de columnas, sigue funcionando),
//   2. busca la primera fila donde las columnas a escribir están vacías,
//   3. escribe solo esas celdas y NUNCA pisa una celda que tenga fórmula.

import { createSign } from "node:crypto";

export interface CredencialesGoogle {
  client_email: string;
  private_key: string;
}

export interface ClienteSheets {
  leer(rango: string, render?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA"): Promise<string[][]>;
  /** Escribe una fila nueva por títulos de columna. Devuelve el número de fila (1 = títulos). */
  agregarFila(hoja: string, valores: Record<string, string | number | null | undefined>): Promise<number>;
  /** Agrega títulos de columna que falten, a la derecha de los existentes. */
  asegurarColumnas(hoja: string, titulos: string[]): Promise<string[]>;
  /** Vacía las celdas que escribió `agregarFila` (para "deshacer"). */
  vaciarCeldas(hoja: string, fila: number, titulos: string[]): Promise<void>;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Columna 0 → "A", 26 → "AA". */
export const letraColumna = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letraColumna(Math.floor(i / 26) - 1) + letraColumna(i % 26));

const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%$]/g, "");

/**
 * Primera fila (desde la 2) donde todas las columnas indicadas están libres.
 * "Libre" = vacía o con fórmula: tu planilla trae filas preparadas con fórmulas
 * (ej. Ingreso bruto = Cantidad × Precio) que esperan datos. Esas filas se usan,
 * y luego la celda con fórmula no se escribe.
 */
export function primeraFilaLibre(filas: string[][], columnas: number[]): number {
  const libre = (v: unknown) => v === undefined || v === "" || String(v).startsWith("=");
  for (let i = 1; i < Math.max(filas.length, 1) + 1; i++) {
    const fila = filas[i] ?? [];
    if (columnas.every((c) => libre(fila[c]))) return i + 1; // número de fila en la planilla
  }
  return filas.length + 1;
}

export function crearClienteSheets(cred: CredencialesGoogle, planillaId: string, fetchImpl: typeof fetch = fetch): ClienteSheets {
  let token: { valor: string; vence: number } | undefined;

  // Token de acceso: JWT firmado con la llave del robot → Google entrega un token de 1 hora.
  async function obtenerToken(): Promise<string> {
    if (token && token.vence > Date.now() + 60_000) return token.valor;
    const ahora = Math.floor(Date.now() / 1000);
    const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const datos = b64url(
      JSON.stringify({
        iss: cred.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: ahora,
        exp: ahora + 3600,
      }),
    );
    const firma = createSign("RSA-SHA256").update(`${cabecera}.${datos}`).sign(cred.private_key.replace(/\\n/g, "\n"));
    const res = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${cabecera}.${datos}.${b64url(firma)}`,
      }),
    });
    const json: any = await res.json();
    if (!res.ok) throw new Error(`Google no entregó acceso: ${json.error_description ?? json.error ?? res.status}`);
    token = { valor: json.access_token, vence: Date.now() + json.expires_in * 1000 };
    return token.valor;
  }

  async function api(metodo: "GET" | "POST" | "PUT", ruta: string, cuerpo?: unknown, intento = 0): Promise<any> {
    const res = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${planillaId}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${await obtenerToken()}`, "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if ((res.status === 429 || res.status >= 500) && intento < 4) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** intento));
      return api(metodo, ruta, cuerpo, intento + 1);
    }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${json.error?.message ?? res.statusText}`);
    return json;
  }

  const rango = (hoja: string, r: string) => encodeURIComponent(`'${hoja.replace(/'/g, "''")}'!${r}`);

  async function leer(r: string, render: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA" = "FORMATTED_VALUE") {
    const [hoja, celdas] = r.split("!");
    const json = await api("GET", `/values/${rango(hoja, celdas)}?valueRenderOption=${render}&dateTimeRenderOption=FORMATTED_STRING`);
    return (json.values ?? []) as string[][];
  }

  async function titulos(hoja: string) {
    return (await leer(`${hoja}!1:1`))[0] ?? [];
  }

  function indices(cabecera: string[], nombres: string[]) {
    const n = cabecera.map(normal);
    return nombres.map((nombre) => {
      const i = n.indexOf(normal(nombre));
      if (i < 0) throw new Error(`La hoja no tiene la columna "${nombre}". Columnas: ${cabecera.join(", ")}`);
      return i;
    });
  }

  return {
    leer,

    async asegurarColumnas(hoja, nuevas) {
      const cab = await titulos(hoja);
      const faltan = nuevas.filter((t) => !cab.map(normal).includes(normal(t)));
      if (faltan.length) {
        const desde = letraColumna(cab.length);
        await api("PUT", `/values/${rango(hoja, `${desde}1`)}?valueInputOption=RAW`, { values: [faltan] });
      }
      return faltan;
    },

    async agregarFila(hoja, valores) {
      const nombres = Object.keys(valores).filter((k) => valores[k] !== undefined && valores[k] !== null && valores[k] !== "");
      const cab = await titulos(hoja);
      const cols = indices(cab, nombres);
      const ultima = letraColumna(Math.max(...cols, cab.length - 1));
      const filas = await leer(`${hoja}!A1:${ultima}2000`, "FORMULA");
      const fila = primeraFilaLibre(filas, cols);
      const actual = filas[fila - 1] ?? [];
      // Solo celdas vacías y sin fórmula
      const data = nombres
        .map((nombre, k) => ({ nombre, col: cols[k] }))
        .filter(({ col }) => !String(actual[col] ?? "").startsWith("="))
        .map(({ nombre, col }) => ({ range: `'${hoja}'!${letraColumna(col)}${fila}`, values: [[valores[nombre]]] }));
      await api("POST", "/values:batchUpdate", { valueInputOption: "USER_ENTERED", data });
      return fila;
    },

    async vaciarCeldas(hoja, fila, nombres) {
      const cols = indices(await titulos(hoja), nombres);
      const actual = (await leer(`${hoja}!A${fila}:${letraColumna(Math.max(...cols))}${fila}`, "FORMULA"))[0] ?? [];
      const data = cols
        .filter((c) => !String(actual[c] ?? "").startsWith("="))
        .map((c) => ({ range: `'${hoja}'!${letraColumna(c)}${fila}`, values: [[""]] }));
      await api("POST", "/values:batchUpdate", { valueInputOption: "RAW", data });
    },
  };
}

/**
 * La credencial de Google pesa ~2,3 KB y Netlify limita TODAS las variables de entorno
 * a ~4 KB en total. Por eso se guarda en Netlify Blobs (subida una vez desde
 * /configurar con la clave del dashboard). En el computador se puede usar la variable.
 */
export async function sheetsDesdeEntorno(): Promise<ClienteSheets | null> {
  const id = process.env.PLANILLA_NEGOCIOS_ID;
  if (!id) return null;
  let cred: CredencialesGoogle | null = process.env.GOOGLE_CREDENCIALES_JSON ? JSON.parse(process.env.GOOGLE_CREDENCIALES_JSON) : null;
  if (!cred) {
    try {
      const { getStore } = await import("@netlify/blobs");
      cred = (await getStore("configuracion").get("google-credenciales", { type: "json" })) as CredencialesGoogle | null;
    } catch {
      cred = null;
    }
  }
  return cred?.client_email && cred.private_key ? crearClienteSheets(cred, id) : null;
}
