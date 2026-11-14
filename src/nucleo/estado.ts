// Estado por persona: últimas frases de la conversación, última acción (para "deshacer")
// y hora del último mensaje recibido (WhatsApp no cobra lo que se envía dentro de 24 h).
// En Netlify vive en Blobs; en el computador y en las pruebas, en memoria.

import { getStore } from "@netlify/blobs";

export type Accion =
  | { tipo: "notion"; pageId: string; resumen: string }
  | { tipo: "sheets"; hoja: string; fila: number; columnas: string[]; resumen: string }
  | { tipo: "agua"; vasos: number; resumen: string };

export interface EstadoPersona {
  historial: { rol: "user" | "assistant"; texto: string }[];
  ultimaAccion?: Accion[];
  ultimoEntrante?: string; // ISO
  recordatoriosEnviados?: string[];
}

export interface AlmacenEstado {
  leer(telefono: string): Promise<EstadoPersona>;
  guardar(telefono: string, estado: EstadoPersona): Promise<void>;
}

const vacio = (): EstadoPersona => ({ historial: [] });
const recortar = (e: EstadoPersona): EstadoPersona => ({
  ...e,
  historial: e.historial.slice(-8), // 4 idas y vueltas: suficiente para "y otro igual"
  recordatoriosEnviados: (e.recordatoriosEnviados ?? []).slice(-60),
});

export function estadoMemoria(): AlmacenEstado {
  const m = new Map<string, EstadoPersona>();
  return {
    async leer(t) {
      return structuredClone(m.get(t) ?? vacio());
    },
    async guardar(t, e) {
      m.set(t, recortar(structuredClone(e)));
    },
  };
}

export function estadoBlobs(): AlmacenEstado {
  const store = getStore({ name: "estado-personas", consistency: "strong" });
  return {
    async leer(t) {
      return ((await store.get(t, { type: "json" })) as EstadoPersona | null) ?? vacio();
    },
    async guardar(t, e) {
      await store.setJSON(t, recortar(e));
    },
  };
}

export function estadoPorDefecto(): AlmacenEstado {
  try {
    return estadoBlobs();
  } catch {
    return estadoMemoria();
  }
}

/** ¿Está abierta la ventana gratuita de 24 h de WhatsApp? (margen de 30 min) */
export const ventanaAbierta = (e: EstadoPersona, ahora = new Date()) =>
  Boolean(e.ultimoEntrante) && ahora.getTime() - Date.parse(e.ultimoEntrante!) < (24 * 60 - 30) * 60_000;
