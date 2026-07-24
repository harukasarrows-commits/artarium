// 過去バージョンの古い設定が localStorage に残っている状態を再現し、
// 焼き込み(JSON)が必ず優先されることを確認する
const PORT = 9333;
const VERSION = process.env.ARTARIUM_V;
const APP_URL = `http://127.0.0.1:3025/?demo=1${VERSION ? `&v=${encodeURIComponent(VERSION)}` : ""}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: "PUT" });
  return (await res.json()).webSocketDebuggerUrl;
}
const ws = new WebSocket(await getWsUrl());
await new Promise((r) => (ws.onopen = r));
let msgId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return res.result?.result?.value;
}

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Page.navigate", { url: APP_URL });
await sleep(2500);
// 旧バージョン相当の「古い巨大配置・斜め向き・大きい土」を demo/production 両方に仕込んで再読込
await evaluate(`(() => {
  const stale = { plantScale: 0.82, plantY: -0.56, plantRotX: 0.08, plantRotY: -0.72, plantRotZ: 1.18, soilScale: 3.12 };
  const old = { plants: {
    "sunflower-bloom": { 6: { ...stale } },
    "wave-crest-bloom": { 6: { ...stale } }
  }, __default: {} };
  localStorage.setItem("artarium-demo-model-settings-v2", JSON.stringify(old));
  localStorage.setItem("artarium-production-model-settings", JSON.stringify(old));
  location.reload();
  return true;
})()`);
// ブリッジ初期化を最大15秒ポーリングで待つ（SWのキャッシュ再インストール直後は読み込みが遅い）
let check = "no bridge";
for (let i = 0; i < 30; i++) {
  await sleep(500);
  check = await evaluate(`(() => {
    if (!window.__artariumTune) return "no bridge";
    const s6 = window.__artariumTune.get("sunflower-bloom", 6);
    const l6 = window.__artariumTune.get("wave-crest-bloom", 6);
    return {
      sunflower: { scale: s6.plantScale, rotY: s6.plantRotY, rotZ: s6.plantRotZ, soilScale: s6.soilScale },
      lily: { scale: l6.plantScale, rotY: l6.plantRotY, rotZ: l6.plantRotZ }
    };
  })()`);
  if (check && typeof check === "object") break;
}
if (!check || typeof check !== "object") {
  console.log("FAIL: ブリッジが初期化されなかった（15秒待っても __artariumTune なし）");
  ws.close();
  process.exit(1);
}
const baked = JSON.parse(await (await fetch("http://127.0.0.1:3025/data/model-settings.json")).text());
const bs = baked.plants["sunflower-bloom"]["6"];
const bl = baked.plants["wave-crest-bloom"]["6"];
await evaluate(`(() => {
  const saved = JSON.parse(localStorage.getItem("artarium-mvp-state") || "{}");
  saved["sunflower-bloom"] = { points: 2500, displayed: false, frameType: "walnut", stepRemainder: 0 };
  saved.__activePlantId = "sunflower-bloom";
  localStorage.setItem("artarium-mvp-state", JSON.stringify(saved));
  location.reload();
  return true;
})()`);
await sleep(2500);
const homeProgressCheck = await evaluate(`(() => {
  const line = document.getElementById("daily-progress-line");
  const before = {
    visible: !line.hidden,
    percent: document.getElementById("growth-progress-percent")?.textContent,
    fill: document.getElementById("daily-progress-fill")?.style.width,
    detailHidden: document.getElementById("growth-progress-detail")?.hidden === true
  };
  line.click();
  return {
    before,
    expanded: line.getAttribute("aria-expanded") === "true",
    detailVisible: document.getElementById("growth-progress-detail")?.hidden === false
  };
})()`);
await evaluate(`(() => {
  const saved = JSON.parse(localStorage.getItem("artarium-mvp-state") || "{}");
  saved["sunflower-bloom"] = { points: 6000, displayed: false, frameType: "walnut", stepRemainder: 0 };
  saved.__activePlantId = "sunflower-bloom";
  localStorage.setItem("artarium-mvp-state", JSON.stringify(saved));
  location.reload();
  return true;
})()`);
await sleep(2500);
const completionPlaqueCheck = await evaluate(`(async () => {
  const plaque = document.getElementById("completion-plaque");
  const initialVisible = !plaque.hidden;
  plaque.querySelector("[data-plaque-close]")?.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const chip = document.querySelector("[data-plaque-reopen]");
  const collapsed = plaque.hidden && Boolean(chip);
  chip?.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { initialVisible, collapsed, reopened: !plaque.hidden };
})()`);
await evaluate(`(() => {
  const saved = JSON.parse(localStorage.getItem("artarium-mvp-state") || "{}");
  saved["sunflower-bloom"] = {
    points: 6000,
    displayed: true,
    frameType: "walnut",
    backgroundType: "nocturne",
    stepRemainder: 0,
    collectedAt: new Date().toISOString()
  };
  saved.__activePlantId = "sunflower-bloom";
  localStorage.setItem("artarium-mvp-state", JSON.stringify(saved));
  location.reload();
  return true;
})()`);
await sleep(2500);
const collectionCheck = await evaluate(`(async () => {
  document.querySelector('[data-view="gallery"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const wall = document.getElementById("gallery-wall");
  const artwork = wall.querySelector("[data-gallery-open]");
  const codex = document.getElementById("codex-grid");
  artwork?.click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const focusModal = document.getElementById("gallery-focus-modal");
  const opened = !focusModal.hidden;
  focusModal.querySelector("[data-gallery-focus-close]")?.click();
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    artworkCount: wall.dataset.artworkCount,
    artworkPresent: Boolean(artwork),
    codexVisible: !codex.hidden && codex.children.length > 0,
    focusOpened: opened,
    focusClosed: focusModal.hidden
  };
})()`);
const cacheCheck = await evaluate(`(async () => {
  if (!("caches" in window)) return { supported: false, modelCache: "", glbCount: 0 };
  const names = await caches.keys();
  const modelCache = names.find((name) => name.endsWith("-models")) || "";
  const requests = modelCache ? await (await caches.open(modelCache)).keys() : [];
  return {
    supported: true,
    modelCache,
    glbCount: requests.filter((request) => new URL(request.url).pathname.endsWith(".glb")).length
  };
})()`);
const storageCheck = await evaluate(`(() => {
  window.Artarium.receiveStepData({ todaySteps: 0, totalSteps: 0 });
  const saved = JSON.parse(localStorage.getItem("artarium-mvp-state") || "{}");
  return { schemaVersion: saved.__schemaVersion ?? 0 };
})()`);
const modalCheck = await evaluate(`(async () => {
  const settingsTab = document.querySelector('[data-view="settings"]');
  settingsTab?.click();
  const opener = document.getElementById("settings-weekly-recap-button");
  opener?.focus();
  opener?.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const modal = document.getElementById("weekly-recap-modal");
  const opened = {
    visible: !modal.hidden,
    bodyLocked: document.body.classList.contains("has-open-modal"),
    backgroundInert: document.querySelector(".app-shell")?.inert === true,
    closeFocused: document.activeElement?.matches?.("[data-recap-close]") === true
  };
  modal.querySelector("[data-recap-close]")?.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    opened,
    closed: {
      hidden: modal.hidden,
      bodyUnlocked: !document.body.classList.contains("has-open-modal"),
      backgroundActive: document.querySelector(".app-shell")?.inert === false,
      focusRestored: document.activeElement === opener
    }
  };
})()`);
await send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: 0,
  uploadThroughput: 0
});
await send("Page.reload", { ignoreCache: false });
await sleep(3500);
const offlineCheck = await evaluate(`(() => {
  // CDPのNetwork.emulateNetworkConditionsは通信を遮断してもnavigator.onLineを
  // 変更しないため、表示側は標準offlineイベントを別途再現して確認する。
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  window.dispatchEvent(new Event("offline"));
  return {
    title: document.title,
    appVisible: Boolean(document.querySelector(".app-shell")),
    tuneBridgeReady: Boolean(window.__artariumTune),
    activePlantReady: Boolean(document.querySelector('[data-home-model-viewer][data-ready="true"]')),
    offlineStatus: document.getElementById("network-status-label")?.textContent || ""
  };
})()`);
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1
});
const settingsOk =
  check.sunflower.scale === bs.plantScale && check.sunflower.rotY === bs.plantRotY &&
  check.sunflower.rotZ === bs.plantRotZ && check.sunflower.soilScale === bs.soilScale &&
  check.lily.scale === bl.plantScale && check.lily.rotY === bl.plantRotY;
const cacheOk = cacheCheck?.supported && cacheCheck.modelCache && cacheCheck.glbCount > 0;
const storageOk = storageCheck?.schemaVersion === 1;
const homeProgressOk = homeProgressCheck?.before?.visible
  && homeProgressCheck.before.percent === "50%"
  && homeProgressCheck.before.fill === "50%"
  && homeProgressCheck.before.detailHidden
  && homeProgressCheck.expanded
  && homeProgressCheck.detailVisible;
const completionPlaqueOk = Object.values(completionPlaqueCheck || {}).every(Boolean);
const collectionOk = collectionCheck?.artworkCount === "1"
  && Object.entries(collectionCheck).filter(([key]) => key !== "artworkCount").every(([, value]) => Boolean(value));
const modalOk = Object.values(modalCheck?.opened || {}).every(Boolean)
  && Object.values(modalCheck?.closed || {}).every(Boolean);
const offlineOk = offlineCheck?.title === "Artarium - 名画の庭"
  && offlineCheck.appVisible
  && offlineCheck.tuneBridgeReady
  && offlineCheck.activePlantReady
  && offlineCheck.offlineStatus.includes("オフライン");
const ok = settingsOk && cacheOk && storageOk && homeProgressOk && completionPlaqueOk && collectionOk && modalOk && offlineOk;
console.log("after reload:", JSON.stringify(check));
console.log("baked:", JSON.stringify({ sunflower: bs, lily: bl }));
console.log("model cache:", JSON.stringify(cacheCheck));
console.log("progress storage:", JSON.stringify(storageCheck));
console.log("home progress:", JSON.stringify(homeProgressCheck));
console.log("completion plaque:", JSON.stringify(completionPlaqueCheck));
console.log("collection view:", JSON.stringify(collectionCheck));
console.log("modal controller:", JSON.stringify(modalCheck));
console.log("offline reload:", JSON.stringify(offlineCheck));
console.log(settingsOk ? "PASS: 焼き込みが旧設定に勝った" : "FAIL: 旧設定が残っている");
console.log(cacheOk ? "PASS: GLBがモデルキャッシュに保存された" : "FAIL: GLBモデルキャッシュが空");
console.log(storageOk ? "PASS: 進行保存にスキーマ版数が付与された" : "FAIL: 進行保存のスキーマ版数が不正");
console.log(homeProgressOk ? "PASS: ホーム進捗の表示と詳細展開が動作した" : "FAIL: ホーム進捗表示が不正");
console.log(completionPlaqueOk ? "PASS: 完成プレートの折りたたみと再表示が動作した" : "FAIL: 完成プレート表示が不正");
console.log(collectionOk ? "PASS: コレクション一覧・図鑑・拡大鑑賞が表示された" : "FAIL: コレクション表示が不正");
console.log(modalOk ? "PASS: モーダルのフォーカスと背景操作が管理された" : "FAIL: モーダル共通制御が不正");
console.log(offlineOk ? "PASS: オフラインでアプリと保存済み3Dが再読込できた" : "FAIL: オフライン再読込が不正");
ws.close();
process.exit(ok ? 0 : 1);
