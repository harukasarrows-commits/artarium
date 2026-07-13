// 環境音（Web Audio によるリアルタイム合成・音声ファイル不使用）
// - 波紋のタップ: ポチャンという水音
// - 雨: ノイズによる降雨音（雨量に応じて音量が変わる）
// - 雷: 稲光（artarium:lightning イベント）に少し遅れて轟く雷鳴
// - 時刻の音風景: 朝(5-9時)は小鳥のさえずり、夜(19-4時)は虫の音、風は天候に連動
// 設定画面のトグルでオン/オフでき、オフの間は AudioContext を作らない。

let enabled = false;
let audioCtx = null;
let rainSource = null;
let rainGain = null;
let rainLevel = 0;
let windLevel = 0;
let cricketNodes = null;
let windNodes = null;
let timescapeTimer = 0;
let birdTimer = 0;

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
  updateTimescape();
}

// ---- 時刻の音風景（朝の小鳥・夜の虫・風） ----

// 小鳥のさえずり: 短い上昇音を2〜4音、フレーズとして鳴らす
function playBirdChirp() {
  const ctx = ensureContext();
  const start = ctx.currentTime + 0.05;
  const notes = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    const t = start + i * (0.15 + Math.random() * 0.1);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const f0 = 2600 + Math.random() * 900;
    osc.type = "sine";
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.2), t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.11);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.018 + Math.random() * 0.012, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

// 虫の音: 高いサイン波を矩形波で「リリリ」と刻み、ゆっくり満ち引きさせる
function startCricketLoop() {
  if (!audioCtx || cricketNodes) return;
  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 4300;
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 6;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.value = 40;
  vibrato.connect(vibratoGain).connect(osc.frequency);
  const pulse = ctx.createOscillator();
  pulse.type = "square";
  pulse.frequency.value = 23;
  const pulseDepth = ctx.createGain();
  pulseDepth.gain.value = 0.5;
  const am = ctx.createGain();
  am.gain.value = 0.5;
  pulse.connect(pulseDepth).connect(am.gain);
  const phrase = ctx.createOscillator();
  phrase.frequency.value = 0.13;
  const phraseDepth = ctx.createGain();
  phraseDepth.gain.value = 0.006;
  const master = ctx.createGain();
  master.gain.value = 0;
  phrase.connect(phraseDepth).connect(master.gain);
  osc.connect(am).connect(master).connect(ctx.destination);
  osc.start();
  vibrato.start();
  pulse.start();
  phrase.start();
  cricketNodes = { gain: master };
}

// 風: 低く絞ったノイズ。ゆっくりしたうねりで吹き抜ける
function startWindLoop() {
  if (!audioCtx || windNodes) return;
  const ctx = audioCtx;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 3);
  source.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 320;
  lowpass.Q.value = 0.4;
  const sway = ctx.createOscillator();
  sway.frequency.value = 0.07;
  const swayDepth = ctx.createGain();
  swayDepth.gain.value = 140;
  sway.connect(swayDepth).connect(lowpass.frequency);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(lowpass).connect(gain).connect(ctx.destination);
  source.start();
  sway.start();
  windNodes = { gain };
}

function updateTimescape() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const hour = new Date().getHours();
  // 虫の音は夜だけ。強い雨の夜は静まる
  const cricketsOn = enabled && (hour >= 19 || hour < 4) && rainLevel < 0.6;
  if (cricketNodes) cricketNodes.gain.gain.setTargetAtTime(cricketsOn ? 0.014 : 0, t, 2.5);
  // 風は天候連動（快晴の凪は無音のまま）
  if (windNodes) windNodes.gain.gain.setTargetAtTime(enabled ? windLevel * 0.022 : 0, t, 2.0);
}

function scheduleBirds() {
  window.clearTimeout(birdTimer);
  birdTimer = window.setTimeout(() => {
    const hour = new Date().getHours();
    if (enabled && hour >= 5 && hour < 9 && rainLevel < 0.4) playBirdChirp();
    scheduleBirds();
  }, 5000 + Math.random() * 8000);
}

function startTimescape() {
  startCricketLoop();
  startWindLoop();
  if (!timescapeTimer) timescapeTimer = window.setInterval(updateTimescape, 60000);
  scheduleBirds();
  updateTimescape();
}

export function setWindSoundLevel(level) {
  windLevel = Math.max(0, Math.min(1, Number(level) || 0));
  updateTimescape();
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
    startTimescape();
  }
  applyRainVolume();
  updateTimescape();
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
