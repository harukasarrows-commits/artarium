const CACHE_NAME = "artarium-shell-v218";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260709-82",
  "./app.js?v=20260709-82",
  "./water-surface.js?v=20260709-82",
  "./sky-background.js?v=20260709-82",
  "./weather.js?v=20260709-82",
  "./ambient-sound.js?v=20260709-82",
  "./plant-effects.js?v=20260709-82",
  "./data/plants.json?v=20260709-82",
  "./data/model-settings.json?v=20260709-82",
  "./vendor/three.module.js",
  "./vendor/GLTFLoader.js",
  "./vendor/BufferGeometryUtils.js",
  "./manifest.webmanifest?v=20260709-82",
  "./icon.svg?v=20260709-82"
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

  // 設定・データJSONもネットワーク優先にする。キャッシュ優先だと、
  // SWインストール時点の内容が同じ ?v= キーで固定され、その後の
  // 内容更新（例: model-settings.json の再生成）が届かない事故が起きる
  const isDataJson = new URL(event.request.url).pathname.endsWith(".json");
  const shouldUseNetworkFirst =
    event.request.mode === "navigate" ||
    isDataJson ||
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
