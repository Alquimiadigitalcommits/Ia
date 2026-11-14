// Único punto de contacto con la API de Notion.
// Todo el sistema (ideas, dashboard, finanzas) pasa por aquí, así los reintentos,
// la versión de la API y el formato de propiedades se arreglan en un solo lugar.

const NOTION_VERSION = "2022-06-28";
const REINTENTOS = 4;

export class ErrorNotion extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(`Notion ${status} ${codigo}: ${mensaje}`);
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ClienteNotion {
  pedir<T = any>(metodo: "GET" | "POST" | "PATCH", ruta: string, cuerpo?: unknown): Promise<T>;
  consultar(databaseId: string, cuerpo?: object): Promise<any[]>;
  crearPagina(databaseId: string, properties: object, children?: object[]): Promise<{ id: string; url: string }>;
  actualizarPagina(pageId: string, properties: object): Promise<any>;
}

/**
 * Crea un cliente de Notion.
 * - Reintenta si Notion responde 429 (demasiadas solicitudes) o 5xx (falla de ellos),
 *   esperando lo que indica `Retry-After` o un tiempo que crece: 0,5 s · 1 s · 2 s · 4 s.
 * - No reintenta errores 4xx (datos mal enviados): repetir no los arregla.
 * - `fetchImpl` se puede reemplazar en las pruebas para simular respuestas.
 */
export function crearClienteNotion(token: string, fetchImpl: typeof fetch = fetch, esperaBase = 500): ClienteNotion {
  async function pedir<T>(metodo: "GET" | "POST" | "PATCH", ruta: string, cuerpo?: unknown): Promise<T> {
    for (let intento = 0; ; intento++) {
      let res: Response;
      try {
        res = await fetchImpl(`https://api.notion.com/v1/${ruta}`, {
          method: metodo,
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
          },
          body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (e) {
        // Corte de red o timeout: se reintenta igual que un 5xx.
        if (intento >= REINTENTOS) throw e;
        await esperar(esperaBase * 2 ** intento);
        continue;
      }

      if (res.ok) return (await res.json()) as T;

      const reintentable = res.status === 429 || res.status >= 500;
      if (reintentable && intento < REINTENTOS) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await esperar(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : esperaBase * 2 ** intento);
        continue;
      }
      const json: any = await res.json().catch(() => ({}));
      throw new ErrorNotion(res.status, json.code ?? "desconocido", json.message ?? res.statusText);
    }
  }

  return {
    pedir,
    async consultar(databaseId, cuerpo = {}) {
      const resultados: any[] = [];
      let cursor: string | undefined;
      // Notion entrega máximo 100 filas por vez: se piden páginas hasta completar
      // (o hasta el page_size pedido, si es menor).
      const limite = (cuerpo as any).page_size ?? Infinity;
      do {
        const r: any = await pedir("POST", `databases/${databaseId}/query`, {
          ...cuerpo,
          page_size: Math.min(100, limite - resultados.length),
          ...(cursor ? { start_cursor: cursor } : {}),
        });
        resultados.push(...r.results);
        cursor = r.has_more ? r.next_cursor : undefined;
      } while (cursor && resultados.length < limite);
      return resultados;
    },
    async crearPagina(databaseId, properties, children) {
      const p: any = await pedir("POST", "pages", {
        parent: { database_id: databaseId },
        properties,
        ...(children?.length ? { children: children.slice(0, 100) } : {}),
      });
      return { id: p.id, url: p.url };
    },
    actualizarPagina(pageId, properties) {
      return pedir("PATCH", `pages/${pageId}`, { properties });
    },
  };
}

// ─────────────────────────── Leer propiedades ───────────────────────────

export const leer = {
  texto: (p: any): string => (p?.title ?? p?.rich_text ?? []).map((t: any) => t.plain_text).join(""),
  numero: (p: any): number | null => (typeof p?.number === "number" ? p.number : null),
  opcion: (p: any): string | null => p?.select?.name ?? p?.status?.name ?? null,
  opciones: (p: any): string[] => (p?.multi_select ?? []).map((o: any) => o.name),
  casilla: (p: any): boolean => Boolean(p?.checkbox),
  fecha: (p: any): string | null => p?.date?.start?.slice(0, 10) ?? null,
  fechaHora: (p: any): string | null => p?.date?.start ?? null,
};

// ─────────────────────────── Escribir propiedades ───────────────────────────

/** Notion corta cada bloque de texto a 2000 caracteres y no acepta comas en opciones. */
const limpiarOpcion = (s: string) => s.replace(/,/g, " ").slice(0, 100);

export const escribir = {
  titulo: (s: string) => ({ title: [{ text: { content: s.slice(0, 2000) || "Sin título" } }] }),
  texto: (s: string) => ({ rich_text: [{ text: { content: s.slice(0, 2000) } }] }),
  numero: (n: number | null) => ({ number: n }),
  opcion: (s: string) => ({ select: { name: limpiarOpcion(s) } }),
  estado: (s: string) => ({ status: { name: s } }),
  opciones: (xs: string[]) => ({ multi_select: xs.map((x) => ({ name: limpiarOpcion(x) })) }),
  casilla: (b: boolean) => ({ checkbox: b }),
  fecha: (iso: string) => ({ date: { start: iso } }),
  url: (u: string | null) => ({ url: u }),
  telefono: (t: string) => ({ phone_number: t }),
  relacion: (ids: string[]) => ({ relation: ids.map((id) => ({ id })) }),
};

// ─────────────────────────── Bloques de contenido ───────────────────────────

const rt = (s: string) => ({ rich_text: [{ text: { content: s.slice(0, 2000) } }] });

export const bloque = {
  titulo3: (s: string) => ({ object: "block", type: "heading_3", heading_3: rt(s) }),
  parrafo: (s: string) => ({ object: "block", type: "paragraph", paragraph: rt(s) }),
  cita: (s: string) => ({ object: "block", type: "quote", quote: rt(s) }),
  marcador: (url: string) => ({ object: "block", type: "bookmark", bookmark: { url } }),
  numerado: (s: string) => ({ object: "block", type: "numbered_list_item", numbered_list_item: rt(s) }),
  tarea: (s: string) => ({ object: "block", type: "to_do", to_do: { ...rt(s), checked: false } }),
  aviso: (s: string, emoji: string) => ({ object: "block", type: "callout", callout: { ...rt(s), icon: { emoji } } }),
};
