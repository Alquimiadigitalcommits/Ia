import type { IdeaClasificada, IdeaTikTok } from "./clasificar.js";
import type { Referencia } from "./referencias.js";

const NOTION_VERSION = "2022-06-28";

/** A qué base de Notion se escribe. */
export interface Destino {
  token: string;
  databaseId: string;
}

async function notion(d: Destino, ruta: string, cuerpo: unknown): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1/${ruta}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${d.token}`,
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
const bloque = (type: string, contenido: object) => ({ object: "block", type, [type]: contenido });
const tarea = (s: string) => bloque("to_do", { ...texto(s), checked: false });

/** WhatsApp reintenta el webhook y la importación se puede correr dos veces: no duplicar. */
export async function yaGuardado(d: Destino, idOrigen: string): Promise<boolean> {
  const r = await notion(d, `databases/${d.databaseId}/query`, {
    filter: { property: "WhatsApp ID", rich_text: { equals: idOrigen } },
    page_size: 1,
  });
  return r.results.length > 0;
}

function bloquesReferencias(refs: Referencia[]) {
  return refs.flatMap((r) => [
    ...(r.titulo || r.autor
      ? [bloque("paragraph", texto(`${r.plataforma} · ${r.autor ?? "?"}: ${r.titulo ?? ""}`))]
      : []),
    bloque("bookmark", { url: r.url }),
  ]);
}

// ─────────────────────────── Base agencia: "Banco de ideas" ───────────────────────────

export interface NuevaIdea {
  whatsappId: string;
  fecha: Date;
  remitente: string;
  telefono: string;
  fuente: "Cliente" | "Alquimia" | "Referencia externa";
  mensajeOriginal: string;
  referencias: Referencia[];
  tipoAdjunto?: string;
  clienteForzado?: string;
  idea: IdeaClasificada | null;
}

export async function crearIdea(d: Destino, n: NuevaIdea): Promise<{ id: string; url: string }> {
  const i = n.idea;
  const titulo = i?.titulo || n.mensajeOriginal.slice(0, 80) || "Idea sin título";

  const properties: Record<string, unknown> = {
    Idea: { title: [{ text: { content: titulo } }] },
    Estado: select(i ? "Nueva" : "Sin clasificar"),
    Cliente: select(n.clienteForzado ?? i?.cliente ?? "Sin asignar"),
    Fuente: select(i?.es_referencia_externa ? "Referencia externa" : n.fuente),
    "Enviado por": texto(n.remitente),
    Teléfono: { phone_number: `+${n.telefono}` },
    "Mensaje original": texto(n.mensajeOriginal || `(${n.tipoAdjunto ?? "adjunto"} sin texto)`),
    "WhatsApp ID": texto(n.whatsappId),
    Recibida: { date: { start: n.fecha.toISOString() } },
  };
  if (n.referencias[0]) properties["Link referencia"] = { url: n.referencias[0].url };
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

  const children: unknown[] = [
    bloque("heading_3", texto("Mensaje recibido")),
    bloque("quote", texto(n.mensajeOriginal || "(sin texto)")),
  ];
  if (n.tipoAdjunto) {
    children.push(bloque("paragraph", texto(`Adjunto recibido por WhatsApp: ${n.tipoAdjunto} (no se sube a Notion en esta versión).`)));
  }
  children.push(
    ...bloquesReferencias(n.referencias),
    bloque("heading_3", texto("Preproducción")),
    tarea("Guion"),
    tarea("Locación / props"),
    tarea("Fecha de grabación"),
  );

  const page = await notion(d, "pages", { parent: { database_id: d.databaseId }, properties, children });
  return { id: page.id, url: page.url };
}

// ─────────────────────────── Base personal: "Ideas TikTok" ───────────────────────────

export interface NuevaIdeaTikTok {
  idOrigen: string;
  fecha: Date;
  mensajeOriginal: string;
  referencias: Referencia[];
  tipoAdjunto?: string;
  origen: "WhatsApp" | "Importado del grupo";
  idea: IdeaTikTok | null;
}

export async function crearIdeaTikTok(d: Destino, n: NuevaIdeaTikTok): Promise<{ id: string; url: string }> {
  const i = n.idea;
  const ref = n.referencias[0];
  const titulo = i?.titulo || n.mensajeOriginal.slice(0, 70) || "Idea sin título";

  const properties: Record<string, unknown> = {
    Idea: { title: [{ text: { content: titulo } }] },
    Estado: select(i ? "Nueva" : "Sin clasificar"),
    Origen: select(n.origen),
    "Mensaje original": texto(n.mensajeOriginal || `(${n.tipoAdjunto ?? "adjunto"} sin texto)`),
    "WhatsApp ID": texto(n.idOrigen),
    Recibida: { date: { start: n.fecha.toISOString() } },
  };
  if (ref) properties["Link referencia"] = { url: ref.url };
  if (ref?.autor) properties["Autor referencia"] = texto(ref.autor);
  if (i) {
    Object.assign(properties, {
      Nicho: select(i.nicho),
      Tipo: select(i.tipo),
      Prioridad: select(i.prioridad),
      Caduca: { checkbox: i.caduca },
      "Audio / tendencia": texto(i.audio_o_tendencia),
      Hook: texto(i.hook),
      Resumen: texto(i.resumen),
      Tags: multi(i.tags),
    });
  }

  const children: unknown[] = [
    bloque("heading_3", texto("Lo que me mandé")),
    bloque("quote", texto(n.mensajeOriginal || "(sin texto)")),
  ];
  if (n.tipoAdjunto) children.push(bloque("paragraph", texto(`Adjunto en WhatsApp: ${n.tipoAdjunto}`)));
  if (n.referencias.length) {
    children.push(bloque("heading_3", texto("Referencias")), ...bloquesReferencias(n.referencias));
  }
  if (i?.estructura.length) {
    children.push(
      bloque("heading_3", texto("Estructura sugerida")),
      bloque("callout", { ...texto(`Hook: ${i.hook}`), icon: { emoji: "🎬" } }),
      ...i.estructura.map((paso) => bloque("numbered_list_item", texto(paso))),
    );
  }
  children.push(bloque("heading_3", texto("Producción")), tarea("Grabar"), tarea("Editar"), tarea("Publicar"));

  const page = await notion(d, "pages", { parent: { database_id: d.databaseId }, properties, children });
  return { id: page.id, url: page.url };
}
