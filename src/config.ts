export type Rol = "equipo" | "cliente";

export interface Contacto {
  nombre: string;
  rol: Rol;
  /** Para rol "cliente": a qué cliente pertenecen sus ideas. */
  cliente?: string;
  /** "tiktok" = sus mensajes van a la base personal "Ideas TikTok". Por defecto "agencia". */
  destino?: "agencia" | "tiktok";
}

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export function cargarConfig() {
  const contactos = JSON.parse(process.env.CONTACTOS_JSON ?? "{}") as Record<string, Contacto>;
  const clientes = (process.env.CLIENTES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  return {
    whatsapp: {
      token: requerida("WHATSAPP_TOKEN"),
      phoneNumberId: requerida("WHATSAPP_PHONE_NUMBER_ID"),
      verifyToken: requerida("WHATSAPP_VERIFY_TOKEN"),
      appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
      apiVersion: process.env.WHATSAPP_API_VERSION ?? "v21.0",
    },
    notion: {
      token: requerida("NOTION_TOKEN"),
      databaseId: requerida("NOTION_DATABASE_ID"),
      /** Base "Ideas TikTok" (opcional). */
      tiktokDatabaseId: process.env.NOTION_TIKTOK_DATABASE_ID ?? "",
    },
    contactos,
    clientes,
  };
}

export type Config = ReturnType<typeof cargarConfig>;

/** Opciones fijas de la base de Notion. Si cambias una aquí, cámbiala también en Notion. */
export const PLATAFORMAS = ["TikTok", "Instagram", "YouTube", "Kick", "Otra"] as const;
export const FORMATOS = [
  "Reel / TikTok",
  "Carrusel",
  "Historia",
  "Post estático",
  "Short",
  "Video largo",
  "Stream",
  "Sin definir",
] as const;
export const PILARES = [
  "Educativo",
  "Entretenimiento",
  "Comunidad",
  "Venta / Promoción",
  "Detrás de cámaras",
  "Tendencia",
] as const;
export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;

/** Base personal "Ideas TikTok". */
export const NICHOS = ["Videojuegos", "Lifestyle", "Skincare", "Panoramas", "Otro"] as const;
export const TIPOS_TIKTOK = [
  "Tendencia / audio",
  "Storytime",
  "Tutorial / paso a paso",
  "Review / opinión",
  "GRWM",
  "Día conmigo / vlog",
  "Clip de stream / gameplay",
  "Humor / sketch",
  "Recomendación / panorama",
  "Respuesta a comentario",
  "Otro",
] as const;
