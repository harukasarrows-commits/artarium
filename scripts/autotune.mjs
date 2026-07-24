// 全植物×全ステージの plantScale / plantY を計測ベースで自動調整する。
// 植物のNDC位置（app.jsのデモ計測フック）を読み、目標の高さ・接地位置に
// 収束するまで __artariumTune.set() で調整を繰り返す。
const PORT = 9333;
const VERSION = process.env.ARTARIUM_V;
const APP_URL = `http://127.0.0.1:3025/?demo=1${VERSION ? `&v=${encodeURIComponent(VERSION)}` : ""}`;
const PLANTS = [
  "scream-bloom", "sunflower-bloom", "wave-crest-bloom", "aquatic-bloom",
  "renaissance-smile-bloom", "nocturne-sky-bloom", "golden-embrace-bloom",
  "monochrome-fracture-bloom", "pearl-light-bloom"
];
const WATER_PLANTS = new Set(["wave-crest-bloom", "aquatic-bloom"]);
// ステージごとの目標高さ（NDC: 画面全高=2.0）。
// 方針B（2026-07-09 ユーザー選択）: 花が主役。序盤は小さく、開花に向けて加速して
// s6は画面いっぱいに広がる（縦は題字の下まで・横は端ちかくまで）
const TARGET_H = { 1: 0.12, 2: 0.22, 3: 0.36, 4: 0.56, 5: 0.765, 6: 1.125 }; // S5/S6は2026-07-13のバランス調整（植物×0.9）に合わせる
const TARGET_H_WATER = { 1: 0.10, 2: 0.18, 3: 0.30, 4: 0.46, 5: 0.70, 6: 1.05 };
const SOIL_BOTTOM = -0.70;   // 土: 植物の足元の目標NDC（soilTopNdcYが取れない時のフォールバック）
const SOIL_SINK = 0.06;      // 土: 土の天面よりわずかに沈める量（bbox底は見た目より下に伸びる）
const WATER_SINK = 0.06;     // 水辺: 水面よりわずかに沈める量
const FACING_ROT_Y = -1.57;  // 正面向き（-0.72は斜め向きだったのでユーザー指摘で変更）
// 土サイズ: 序盤は控えめ、開花に向けて花と一緒に育つ（B案・2026-07-09ユーザー選択）
const SOIL_SCALE_BY_STAGE = { 1: 2.5, 2: 2.5, 3: 2.5, 4: 2.7, 5: 3.245, 6: 3.52 }; // S5/S6は土×1.1後の値
const MAX_CENTER_OFF = 0.03; // 左右センタリングの許容ずれ（NDC）
const MAX_W = 1.9;           // 横幅の上限（NDC）: 画面端ちかくまで許容
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: "PUT" });
  return (await res.json()).webSocketDebuggerUrl;
}
const ws = new WebSocket(await getWsUrl());
await new Promise((r) => (ws.onopen = r));
let msgId = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown") {
    logs.push(`[EXCEPTION] ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description ?? ""}`);
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
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description ?? "eval error");
  return res.result?.result?.value;
}

// plantNdc が更新されるのを待つ（設定変更・ステージ切替後）
async function freshMeasure(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const raw = await evaluate(`document.getElementById('home-active-artwork')?.dataset.plantNdc ?? null`);
    if (raw) return JSON.parse(raw);
    await sleep(400);
  }
  throw new Error("plantNdc timeout");
}
async function clearMeasure() {
  await evaluate(`delete document.getElementById('home-active-artwork')?.dataset.plantNdc; true`);
}

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: APP_URL });
await sleep(4000);
// 選択植物がなければ種選択から（名前→種→確定）
await evaluate(`(() => {
  const modal = document.getElementById('name-entry-modal');
  if (modal && !modal.hidden) {
    document.getElementById('name-entry-input').value = 'テスト';
    document.getElementById('name-entry-form').requestSubmit();
  }
})()`);
await sleep(1000);
await evaluate(`document.querySelector('.seed-choice, [data-seed]')?.click()`);
await sleep(1800);
await evaluate(`document.querySelector('[data-seed-confirm]')?.click()`);
await sleep(2500);
const hasBridge = await evaluate(`Boolean(window.__artariumTune)`);
if (!hasBridge) { console.log("NO BRIDGE"); process.exit(1); }

const report = {};
for (const plant of PLANTS) {
  report[plant] = {};
  await clearMeasure();
  await evaluate(`(() => {
    const sel = document.querySelector('[data-demo-plant-select]');
    sel.value = "${plant}";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await freshMeasure();
  const isWater = WATER_PLANTS.has(plant);
  const ladder = isWater ? TARGET_H_WATER : TARGET_H;
  for (let stage = 1; stage <= 6; stage++) {
    await clearMeasure();
    await evaluate(`document.querySelector('[data-demo-model-stage="${stage}"]')?.click()`);
    await freshMeasure();
    // 直立＋正面向き＋土サイズ縮小（水辺は土なしなのでsoilScaleは触らない）
    await clearMeasure();
    const posture = isWater
      ? { plantRotX: 0, plantRotZ: 0, plantRotY: FACING_ROT_Y }
      : { plantRotX: 0, plantRotZ: 0, plantRotY: FACING_ROT_Y, soilScale: SOIL_SCALE_BY_STAGE[stage] };
    await evaluate(`window.__artariumTune.set("${plant}", ${stage}, ${JSON.stringify(posture)})`);
    let m = await freshMeasure();
    let rounds = 0;
    let status = "ok";
    while (rounds < 4) {
      rounds++;
      const cur = await evaluate(`window.__artariumTune.get("${plant}", ${stage})`);
      const h = m.maxY - m.minY;
      const w = m.maxX - m.minX;
      const targetH = ladder[stage];
      const targetBottom = isWater
        ? (m.waterNdcY ?? -0.6) - WATER_SINK
        : (m.soilTopNdcY ?? SOIL_BOTTOM) - SOIL_SINK;
      let scaleFix = Math.max(0.4, Math.min(2.5, targetH / Math.max(0.01, h)));
      if (w * scaleFix > MAX_W) scaleFix = MAX_W / w;
      const hOk = Math.abs(h * scaleFix / targetH - 1) < 0.25 || Math.abs(scaleFix - 1) < 0.08;
      const dyNdc = targetBottom - m.minY;
      const centerX = (m.minX + m.maxX) / 2;
      const needScale = Math.abs(scaleFix - 1) > 0.08;
      const needMove = Math.abs(dyNdc) > 0.05;
      const needCenter = Math.abs(centerX) > MAX_CENTER_OFF && Number.isFinite(m.worldPerNdcX);
      if (!needScale && !needMove && !needCenter) break;
      const partial = {};
      if (needScale) partial.plantScale = Math.max(0.08, Math.min(2.4, cur.plantScale * scaleFix));
      if (needMove) partial.plantY = cur.plantY + dyNdc * m.worldPerNdcY;
      if (needCenter) partial.plantX = cur.plantX - centerX * m.worldPerNdcX;
      await clearMeasure();
      await evaluate(`window.__artariumTune.set("${plant}", ${stage}, ${JSON.stringify(partial)})`);
      m = await freshMeasure();
      if (rounds === 4) status = "max-rounds";
      void hOk;
    }
    const final = await evaluate(`window.__artariumTune.get("${plant}", ${stage})`);
    report[plant][stage] = {
      status, rounds,
      ndc: { minY: +m.minY.toFixed(3), maxY: +m.maxY.toFixed(3), w: +(m.maxX - m.minX).toFixed(3) },
      plantScale: +final.plantScale.toFixed(3),
      plantY: +final.plantY.toFixed(3)
    };
    console.log(plant, "s" + stage, JSON.stringify(report[plant][stage]));
  }
}

// 調整結果の全設定を保存（焼き込みJSON生成に使う）
const dump = await evaluate(`JSON.stringify(window.__artariumTune.dump())`);
const { writeFileSync } = await import("node:fs");
writeFileSync(new URL("./tuned-settings.json", import.meta.url), dump);
console.log("dumped tuned-settings.json");
console.log("EXCEPTIONS:", logs.slice(0, 5).join(" | ") || "none");
ws.close();
process.exit(0);
