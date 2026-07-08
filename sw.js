const CACHE_NAME = "artarium-shell-v202";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260708-67",
  "./app.js?v=20260708-67",
  "./water-surface.js?v=20260708-67",
  "./sky-background.js?v=20260708-67",
  "./weather.js?v=20260708-67",
  "./ambient-sound.js?v=20260708-67",
  "./plant-effects.js?v=20260708-67",
  "./data/plants.json?v=20260708-67",
  "./vendor/three.module.js",
  "./vendor/GLTFLoader.js",
  "./vendor/BufferGeometryUtils.js",
  "./manifest.webmanifest?v=20260708-67",
  "./icon.svg?v=20260708-67"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const shouldUseNetworkFirst =
    event.request.mode === "navigate" ||
    ["document", "style", "script", "worker"].includes(event.request.destination);

  if (shouldUseNetworkFirst) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}
