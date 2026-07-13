// 過去バージョンの古い設定が localStorage に残っている状態を再現し、
// 焼き込み(JSON)が必ず優先されることを確認する
const PORT = 9333;
const APP_URL = "http://127.0.0.1:3025/?demo=1&v=20260709-84";
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
const ok =
  check.sunflower.scale === bs.plantScale && check.sunflower.rotY === bs.plantRotY &&
  check.sunflower.rotZ === bs.plantRotZ && check.sunflower.soilScale === bs.soilScale &&
  check.lily.scale === bl.plantScale && check.lily.rotY === bl.plantRotY;
console.log("after reload:", JSON.stringify(check));
console.log("baked:", JSON.stringify({ sunflower: bs, lily: bl }));
console.log(ok ? "PASS: 焼き込みが旧設定に勝った" : "FAIL: 旧設定が残っている");
ws.close();
process.exit(0);
