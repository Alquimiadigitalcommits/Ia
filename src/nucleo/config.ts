import { nombresClientes } from "./clientes.js";

export type Rol = "equipo" | "cliente";

export interface Contacto {
  nombre: string;
  rol: Rol;
  /** Para rol "cliente": a qué cliente pertenecen sus ideas. */
  cliente?: string;
}

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export function cargarConfig() {
  const contactos = JSON.parse(process.env.CONTACTOS_JSON ?? "{}") as Record<string, Contacto>;
  // Los clientes salen de clientes.json (con su ficha).
  const clientes = nombresClientes();

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
      /** Base existente "Ideas y referencias" (relacionada con Clientes). */
      ideasDatabaseId: process.env.NOTION_DB_IDEAS || "c2b5071b2e6d48c384d748b77ac1ab8b",
    },
    contactos,
    clientes,
  };
}

export type Config = ReturnType<typeof cargarConfig>;

/**
 * Opciones de la base "Ideas y referencias" de Notion (deben coincidir exactamente).
 * Si agregas una opción en Notion, agrégala aquí para que Claude pueda elegirla.
 */
export const PLATAFORMAS = ["YouTube", "Kick", "TikTok", "Instagram", "Otra"] as const;
export const FORMATOS = [
  "Video corto vertical",
  "Video largo",
  "Transmisión en vivo",
  "Clip de transmisión",
  "Carrusel",
  "Imagen",
  "Historia",
  "Texto o post",
  "Otro",
] as const;
export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
export const FUENTES = ["Tendencia", "Competidor", "Referente", "Cliente", "Equipo", "Otra"] as const;

/** Guía para Claude (en Notion "Nicho" es texto libre). */
export const NICHOS = ["Videojuegos", "Lifestyle", "Skincare", "Panoramas", "Gastronomía", "Humor", "Historias", "Marketing", "Otro"] as const;
export const TIPOS_VIDEO = [
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
  "Producto / receta",
  "Otro",
] as const;
