const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9333);
const APP_URL = process.env.ARTARIUM_URL || "http://127.0.0.1:3025/?demo=1&nosw=1";
const WAIT_MS = Number(process.env.ARTARIUM_WAIT_MS || 10000);
const MAX_TRANSFER_MB = Number(process.env.ARTARIUM_MAX_TRANSFER_MB || 6);
const MAX_INITIAL_GLB_REQUESTS = Number(process.env.ARTARIUM_MAX_GLB_REQUESTS || 6);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targetResponse = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?url=about:blank`, { method: "PUT" });
if (!targetResponse.ok) throw new Error(`Chrome DevTools endpoint unavailable: ${targetResponse.status}`);
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let messageId = 0;
const pending = new Map();
const requests = new Map();
const exceptions = [];
const consoleErrors = [];

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  if (message.method === "Network.responseReceived") {
    requests.set(message.params.requestId, {
      url: message.params.response.url,
      status: message.params.response.status,
      mimeType: message.params.response.mimeType,
      bytes: 0
    });
  }
  if (message.method === "Network.loadingFinished") {
    const request = requests.get(message.params.requestId);
    if (request) request.bytes = message.params.encodedDataLength || 0;
  }
  if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    consoleErrors.push(message.params.args.map((argument) => argument.value || argument.description || "").join(" "));
  }
};

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++messageId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const message = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return message.result?.result?.value;
}

await Promise.all([
  send("Page.enable"),
  send("Network.enable"),
  send("Runtime.enable"),
  send("Performance.enable")
]);
const startedAt = Date.now();
await send("Page.navigate", { url: APP_URL });
await sleep(WAIT_MS);

const pageState = await evaluate(`(() => ({
  title: document.title,
  seedCards: document.querySelectorAll("[data-seed]").length,
  readyModels: document.querySelectorAll('[data-model-viewer][data-ready="true"], [data-seed-thumbnail][data-ready="true"]').length,
  loadingModels: document.querySelectorAll(".model-loading").length,
  canvases: document.querySelectorAll("canvas").length
}))()`);
const performanceMessage = await send("Performance.getMetrics");
const metrics = Object.fromEntries((performanceMessage.result?.metrics || []).map((metric) => [metric.name, metric.value]));
const completedRequests = [...requests.values()].filter((request) => request.bytes > 0);
const totalBytes = completedRequests.reduce((total, request) => total + request.bytes, 0);
const glbRequests = completedRequests.filter((request) => new URL(request.url).pathname.toLowerCase().endsWith(".glb"));
const glbBytes = glbRequests.reduce((total, request) => total + request.bytes, 0);
const largest = [...completedRequests].sort((left, right) => right.bytes - left.bytes).slice(0, 8);

const report = {
  url: APP_URL,
  waitedMs: Date.now() - startedAt,
  pageState,
  requests: completedRequests.length,
  transferMb: +(totalBytes / 1024 / 1024).toFixed(2),
  glbRequests: glbRequests.length,
  glbTransferMb: +(glbBytes / 1024 / 1024).toFixed(2),
  scriptDurationMs: +((metrics.ScriptDuration || 0) * 1000).toFixed(1),
  taskDurationMs: +((metrics.TaskDuration || 0) * 1000).toFixed(1),
  jsHeapMb: +((metrics.JSHeapUsedSize || 0) / 1024 / 1024).toFixed(2),
  largest: largest.map((request) => ({
    kb: +(request.bytes / 1024).toFixed(1),
    path: new URL(request.url).pathname
  })),
  exceptions,
  consoleErrors
};
report.budgets = {
  maxTransferMb: MAX_TRANSFER_MB,
  maxInitialGlbRequests: MAX_INITIAL_GLB_REQUESTS,
  passed: report.transferMb <= MAX_TRANSFER_MB && report.glbRequests <= MAX_INITIAL_GLB_REQUESTS
};

console.log(JSON.stringify(report, null, 2));
socket.close();
process.exit(exceptions.length || consoleErrors.length || !report.budgets.passed ? 1 : 0);
