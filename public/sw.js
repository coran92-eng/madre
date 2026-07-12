// MADRE fichaje — service worker para que la tablet cargue sin conexión.
// Alcance mínimo: cachea el shell de /kiosk y los assets estáticos de Next.
const CACHE = "madre-kiosk-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isKiosk = url.pathname === "/kiosk";
  const isAsset = url.pathname.startsWith("/_next/") || url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest";
  if (!isKiosk && !isAsset) return;

  // Network-first for the kiosk page, cache-first for static assets.
  if (isKiosk) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/kiosk")))
    );
  } else {
    event.respondWith(
      caches.match(req).then((m) =>
        m ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
