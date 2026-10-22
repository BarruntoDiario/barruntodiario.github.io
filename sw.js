/* Barrunto: service worker. Red primero para las partidas; caché primero para todo lo demás.
   Al cambiar HTML, CSS, JS o iconos, sube VERSION para que los jugadores reciban la nueva versión. */
const VERSION = "barrunto-v2";
const PARTIDAS = "barrunto-partidas.json";
const NUCLEO = [
  "./",
  "index.html",
  "css/estilos.css",
  "js/logica.js",
  "js/app.js",
  PARTIDAS,
  "manifest.webmanifest",
  "favicon.ico",
  "icons/barrunto-logo.svg",
  "icons/favicon-32.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.endsWith("/" + PARTIDAS)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(PARTIDAS, copia)); }
        return res;
      }).catch(() => caches.match(PARTIDAS))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(hit => hit || fetch(req).then(res => {
      // Guarda también lo que llega después (p. ej. las fuentes de Google) para jugar sin conexión.
      if (res.ok || res.type === "opaque") { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => req.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});
