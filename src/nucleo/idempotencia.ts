// "Idempotencia": procesar el mismo mensaje dos veces da el mismo resultado que una sola vez.
//
// WhatsApp reenvía el webhook si no recibe respuesta rápida, y a veces manda el mismo
// mensaje dos veces casi al mismo tiempo. Antes preguntábamos a Notion "¿ya existe?",
// pero si las dos copias llegan juntas, ambas reciben "no" y se crean dos filas.
//
// Ahora cada mensaje se "reclama" con una escritura atómica: solo la primera copia
// logra escribir la clave; la segunda recibe "ya estaba" y se descarta.

import { getStore } from "@netlify/blobs";

export interface RegistroProcesados {
  /** Devuelve true solo la primera vez que se reclama este id. */
  reclamar(id: string): Promise<boolean>;
  /** Si el procesamiento falló, libera el id para que un reintento lo procese. */
  liberar(id: string): Promise<void>;
}

/** En producción (Netlify): Netlify Blobs con escritura condicional `onlyIfNew`. */
export function registroBlobs(nombreStore = "mensajes-procesados"): RegistroProcesados {
  const store = getStore({ name: nombreStore, consistency: "strong" });
  return {
    async reclamar(id) {
      const r = await store.set(id, new Date().toISOString(), { onlyIfNew: true });
      return r.modified;
    },
    async liberar(id) {
      await store.delete(id);
    },
  };
}

/** En el computador y en las pruebas: memoria del proceso. */
export function registroMemoria(): RegistroProcesados {
  const vistos = new Set<string>();
  return {
    async reclamar(id) {
      if (vistos.has(id)) return false;
      vistos.add(id);
      return true;
    },
    async liberar(id) {
      vistos.delete(id);
    },
  };
}

/** Usa Blobs si está disponible (dentro de Netlify); si no, memoria. */
export function registroPorDefecto(): RegistroProcesados {
  try {
    return registroBlobs();
  } catch {
    return registroMemoria();
  }
}

/**
 * Para el importador del chat (corre en tu computador): guarda los ids en un archivo JSON,
 * así puedes correrlo varias veces y lo ya importado se salta.
 */
export function registroArchivo(ruta: string): RegistroProcesados {
  // Import dinámico para no cargar "fs" en las funciones de Netlify.
  const fs = import("node:fs/promises");
  // Se guarda la PROMESA de la lectura, no el resultado: si 3 trabajadores piden el archivo
  // al mismo tiempo, los 3 esperan la misma lectura y comparten el mismo conjunto.
  // (Guardar el resultado dejaba una ventana donde cada uno creaba su propio conjunto.)
  let carga: Promise<Set<string>> | undefined;
  const cargar = () =>
    (carga ??= fs
      .then((f) => f.readFile(ruta, "utf8"))
      .catch(() => "[]")
      .then((txt) => new Set(JSON.parse(txt) as string[])));
  const guardar = async () => (await fs).writeFile(ruta, JSON.stringify([...(await cargar())]));
  return {
    async reclamar(id) {
      const v = await cargar();
      if (v.has(id)) return false;
      v.add(id);
      await guardar();
      return true;
    },
    async liberar(id) {
      (await cargar()).delete(id);
      await guardar();
    },
  };
}
