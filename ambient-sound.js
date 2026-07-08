// 環境音（Web Audio によるリアルタイム合成・音声ファイル不使用）
// - 波紋のタップ: ポチャンという水音
// - 雨: ノイズによる降雨音（雨量に応じて音量が変わる）
// - 雷: 稲光（artarium:lightning イベント）に少し遅れて轟く雷鳴
// 設定画面のトグルでオン/オフでき、オフの間は AudioContext を作らない。

let enabled = false;
let audioCtx = null;
let rainSource = null;
let rainGain = null;
let rainLevel = 0;

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function noiseBuffer(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// ---- 雨（ループ再生、雨量に応じて音量を変える） ----
function startRainLoop() {
  if (!audioCtx || rainSource) return;
  rainSource = audioCtx.createBufferSource();
  rainSource.buffer = noiseBuffer(audioCtx, 2);
  rainSource.loop = true;
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 1400;
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 350;
  rainGain = audioCtx.createGain();
  rainGain.gain.value = 0;
  rainSource.connect(lowpass).connect(highpass).connect(rainGain).connect(audioCtx.destination);
  rainSource.start();
}

function applyRainVolume() {
  if (!rainGain || !audioCtx) return;
  const target = enabled ? rainLevel * 0.055 : 0;
  rainGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.8);
}

export function setRainSoundLevel(level) {
  rainLevel = Math.max(0, Math.min(1, Number(level) || 0));
  applyRainVolume();
}

// ---- 波紋のポチャン ----
export function playRipplePlop(strength = 0.3) {
  if (!enabled || !audioCtx) return;
  const ctx = ensureContext();
  const t = ctx.currentTime;
  const size = Math.max(0.1, Math.min(1, strength));
  const volume = 0.03 + size * 0.09;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const startFreq = 420 - size * 200 + Math.random() * 60;
  osc.type = "sine";
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(startFreq * 0.4, 50), t + 0.1 + size * 0.08);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 + size * 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.6);
}

// ---- 雷鳴（稲光から少し遅れて轟く） ----
function playThunder() {
  if (!enabled || !audioCtx) return;
  const ctx = ensureContext();
  const delay = 0.3 + Math.random() * 1.2; // 光ってから音が届くまでの間
  const t = ctx.currentTime + delay;
  const duration = 1.6 + Math.random() * 1.2;

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(180, t);
  lowpass.frequency.exponentialRampToValueAtTime(60, t + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.06, t + duration * 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  source.connect(lowpass).connect(gain).connect(ctx.destination);
  source.start(t);
}

// ---- 有効/無効 ----
export function setSoundEnabled(on) {
  enabled = Boolean(on);
  if (enabled) {
    ensureContext();
    startRainLoop();
  }
  applyRainVolume();
}

export function isSoundEnabled() {
  return enabled;
}

// 稲光との連動
window.addEventListener("artarium:lightning", () => playThunder());
// 水面タップとの連動（water-surface.js などが発火する）
window.addEventListener("artarium:ripple", (event) => playRipplePlop(event.detail?.strength ?? 0.3));
// ブラウザの自動再生制限対策: 最初の操作でオーディオを起こす
document.addEventListener("pointerdown", () => {
  if (enabled) ensureContext();
}, { once: true });
