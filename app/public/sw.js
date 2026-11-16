// Service worker de Mi día.
// - La interfaz (HTML, JS, CSS, íconos) se guarda para abrir rápido y sin conexión.
// - Las llamadas a /api NUNCA se guardan: tus datos personales no quedan en caché del teléfono.
const VERSION = "mi-dia-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icono-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/")) return;
  // Navegación: red primero, y si no hay conexión, la app guardada.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
    return;
  }
  // Archivos con hash (assets/): caché primero.
  e.respondWith(
    caches.match(e.request).then((guardado) =>
      guardado ||
      fetch(e.request).then((r) => {
        if (r.ok && url.pathname.startsWith("/assets/")) {
          const copia = r.clone(); // copiar ANTES de devolverla: después el navegador ya pudo leerla
          caches.open(VERSION).then((c) => c.put(e.request, copia));
        }
        return r;
      }),
    ),
  );
});
