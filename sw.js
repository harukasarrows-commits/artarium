const CACHE_NAME = "artarium-shell-v364";
const MODEL_CACHE_NAME = `${CACHE_NAME}-models`;
const MODEL_CACHE_LIMIT = 18;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260710-94",
  "./app.js?v=20260710-94",
  "./water-surface.js?v=20260710-94",
  "./sky-background.js?v=20260710-94",
  "./weather.js?v=20260710-94",
  "./ambient-sound.js?v=20260710-94",
  "./plant-effects.js?v=20260710-94",
  "./core/progress.js?v=20260710-94",
  "./storage/progress-store.js?v=20260710-94",
  "./ui/modal-controller.js?v=20260710-94",
  "./views/settings-view.js?v=20260710-94",
  "./views/collection-view.js?v=20260710-94",
  "./views/home-status-view.js?v=20260710-94",
  "./data/plants.json?v=20260710-94",
  "./data/model-settings.json?v=20260710-94",
  "./vendor/three.module.js",
  "./vendor/GLTFLoader.js",
  "./vendor/BufferGeometryUtils.js",
  "./manifest.webmanifest?v=20260710-94",
  "./icon.svg?v=20260710-94"
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
      keys
        .filter((key) => ![CACHE_NAME, MODEL_CACHE_NAME].includes(key))
        .map((key) => caches.delete(key))
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
  const isGlbModel = new URL(event.request.url).pathname.toLowerCase().endsWith(".glb");
  const shouldUseNetworkFirst =
    event.request.mode === "navigate" ||
    isDataJson ||
    ["document", "style", "script", "worker"].includes(event.request.destination);

  if (shouldUseNetworkFirst) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isGlbModel) {
    event.respondWith(cacheModelFirst(event.request));
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

async function cacheModelFirst(request) {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trimCache(cache, MODEL_CACHE_LIMIT);
  }
  return response;
}

async function trimCache(cache, maximumEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maximumEntries;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((request) => cache.delete(request)));
}
