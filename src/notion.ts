import type { Config } from "./config.js";
import type { IdeaClasificada } from "./clasificar.js";

const NOTION_VERSION = "2022-06-28";

async function notion(cfg: Config, ruta: string, cuerpo: unknown): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1/${ruta}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.notion.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Notion ${ruta} ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Notion corta rich_text a 2000 caracteres por bloque. */
const texto = (s: string) => ({ rich_text: [{ text: { content: s.slice(0, 2000) } }] });
const select = (s: string) => ({ select: { name: s.replace(/,/g, " ") } });
const multi = (xs: string[]) => ({ multi_select: xs.map((x) => ({ name: x.replace(/,/g, " ") })) });

/** WhatsApp reintenta el webhook; buscamos el ID para no duplicar. */
export async function yaGuardado(cfg: Config, whatsappId: string): Promise<boolean> {
  const r = await notion(cfg, `databases/${cfg.notion.databaseId}/query`, {
    filter: { property: "WhatsApp ID", rich_text: { equals: whatsappId } },
    page_size: 1,
  });
  return r.results.length > 0;
}

export interface NuevaIdea {
  whatsappId: string;
  fecha: Date;
  remitente: string;
  telefono: string;
  fuente: "Cliente" | "Alquimia" | "Referencia externa";
  mensajeOriginal: string;
  links: string[];
  tipoAdjunto?: string;
  clienteForzado?: string;
  idea: IdeaClasificada | null;
}

export async function crearIdea(cfg: Config, n: NuevaIdea): Promise<{ id: string; url: string }> {
  const i = n.idea;
  const cliente = n.clienteForzado ?? i?.cliente ?? "Sin asignar";
  const titulo = i?.titulo ?? n.mensajeOriginal.slice(0, 80) ?? "Idea sin título";

  const properties: Record<string, unknown> = {
    Idea: { title: [{ text: { content: titulo || "Idea sin título" } }] },
    Estado: select(i ? "Nueva" : "Sin clasificar"),
    Cliente: select(cliente),
    Fuente: select(i?.es_referencia_externa ? "Referencia externa" : n.fuente),
    "Enviado por": texto(n.remitente),
    Teléfono: { phone_number: `+${n.telefono}` },
    "Mensaje original": texto(n.mensajeOriginal || `(${n.tipoAdjunto ?? "adjunto"} sin texto)`),
    "WhatsApp ID": texto(n.whatsappId),
    Recibida: { date: { start: n.fecha.toISOString() } },
  };
  if (n.links[0]) properties["Link referencia"] = { url: n.links[0] };
  if (i) {
    Object.assign(properties, {
      Resumen: texto(i.resumen),
      Plataforma: multi(i.plataformas),
      Formato: select(i.formato),
      Pilar: select(i.pilar),
      Prioridad: select(i.prioridad),
      Hook: texto(i.hook),
      Tags: multi(i.tags),
    });
  }

  // Cuerpo de la página: el mensaje completo + todos los links (útil para preproducción).
  const children: unknown[] = [
    { object: "block", type: "heading_3", heading_3: texto("Mensaje recibido") },
    { object: "block", type: "quote", quote: texto(n.mensajeOriginal || "(sin texto)") },
  ];
  if (n.tipoAdjunto) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: texto(`Adjunto recibido por WhatsApp: ${n.tipoAdjunto} (no se sube a Notion en esta versión).`),
    });
  }
  for (const link of n.links) {
    children.push({ object: "block", type: "bookmark", bookmark: { url: link } });
  }
  children.push(
    { object: "block", type: "heading_3", heading_3: texto("Preproducción") },
    { object: "block", type: "to_do", to_do: { ...texto("Guion"), checked: false } },
    { object: "block", type: "to_do", to_do: { ...texto("Locación / props"), checked: false } },
    { object: "block", type: "to_do", to_do: { ...texto("Fecha de grabación"), checked: false } },
  );

  const page = await notion(cfg, "pages", {
    parent: { database_id: cfg.notion.databaseId },
    properties,
    children,
  });
  return { id: page.id, url: page.url };
}
