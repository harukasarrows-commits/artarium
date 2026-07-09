// 空の背景レイヤー
// 時間帯（朝焼け・昼・夕暮れ・夜）に合わせて色が移り変わり、雲がゆっくり流れる。
// WebGL2 非対応の環境では何もせず、既存のCSS背景が残る。

const SKY_VERT = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SKY_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloud;
uniform vec3 uSunCol;
uniform vec2 uSunPos;
uniform float uStars;
uniform vec3 uWater;
uniform float uCloudAmount;
uniform float uRain;
uniform float uSnow;
uniform float uFog;
uniform float uDark;
uniform float uFlash;
uniform float uBoltAlpha;
uniform float uBoltSeed;
uniform float uBoltX;
uniform float uCloudScale;
uniform float uGlint;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += valueNoise(p) * amp;
    p = p * 2.03 + vec2(17.3, 9.1);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float ar = uRes.x / uRes.y;

  // 地平線の高さ（画面下からの割合）
  const float HORIZON = 0.3;

  float skyT = clamp((uv.y - HORIZON) / (1.0 - HORIZON), 0.0, 1.0);
  vec2 p = vec2(uv.x * ar, skyT);
  vec2 sp = vec2(uSunPos.x * ar, uSunPos.y);

  vec3 col;
  if (uv.y >= HORIZON) {
    // --- 地平線から上: 空 ---
    col = mix(uHorizon, uZenith, pow(skyT, 1.15));

    // 太陽 / 月（小さな光源 + ほのかな暈）
    float sd = length(p - sp);
    col += uSunCol * (exp(-sd * sd * 900.0) * 0.6 + exp(-sd * 5.0) * 0.12);

    // 星（夜のみ・地平線近くは薄く）
    if (uStars > 0.001) {
      vec2 cell = floor(p * vec2(160.0, 110.0));
      float star = step(0.9972, hash21(cell));
      float twinkle = 0.6 + 0.4 * sin(uTime * 1.4 + hash21(cell + 7.0) * 40.0);
      col += vec3(0.9, 0.95, 1.0) * star * twinkle * uStars * smoothstep(0.1, 0.6, skyT);
    }

    // 雲（2層をゆっくり流す・地平線近くほど平たく密に見える）
    // uCloudAmount（実際の雲量）が多いほどしきい値が下がり、空を覆っていく
    float t = uTime * 0.012;
    float persp = 1.0 / (skyT * 0.85 + 0.22);
    // uCloudScale: 季節による雲の大きさ（夏はもくもくと大きく、秋は細く流れる）
    vec2 cp = vec2(p.x * persp * 0.55, skyT * 5.5) / max(uCloudScale, 0.2);
    float c1 = fbm(cp * vec2(2.2, 1.0) + vec2(t, 0.0));
    float c2 = fbm(cp * vec2(4.4, 1.7) + vec2(-t * 1.5, 7.0));
    float cover = clamp(uCloudAmount, 0.0, 1.0);
    float cloud = smoothstep(0.62 - cover * 0.5, 0.95 - cover * 0.4, c1 * 0.65 + c2 * 0.35);
    float shade = fbm(cp * vec2(3.1, 1.2) + vec2(t * 0.6, -3.0));
    vec3 cloudCol = uCloud * (0.82 + 0.3 * shade);
    // 雨天・荒天の雲は灰色に寄せる
    cloudCol = mix(cloudCol, vec3(0.5, 0.52, 0.56), clamp(max(uRain, uDark * 1.5), 0.0, 0.8));
    float density = cloud * (0.35 + 0.65 * (1.0 - skyT * 0.6));
    col = mix(col, cloudCol, min(density, 0.6 + cover * 0.35));

    // 稲妻（ノイズで折れ曲がる光の筋 + 周囲の輝き）
    if (uBoltAlpha > 0.001) {
      float wiggle = (fbm(vec2(uBoltSeed + skyT * 9.0, uBoltSeed * 1.7)) - 0.5) * 0.35 * (1.0 - skyT * 0.4);
      float boltX = (uBoltX + wiggle) * ar;
      float dist = abs(p.x - boltX);
      float coreLine = exp(-dist * dist * 24000.0);
      float boltGlow = exp(-dist * 26.0) * 0.5;
      col += vec3(1.0, 0.98, 0.9) * (coreLine * 1.7 + boltGlow) * uBoltAlpha * smoothstep(0.02, 0.15, skyT);
    }
    // 稲光（空全体が明滅する）
    col += vec3(0.85, 0.9, 1.0) * uFlash * (0.3 + 0.4 * skyT);
  } else {
    // --- 地平線から下: 一続きの湖 ---
    // 遠くは空を映した色、手前に近づくほど手前の池と同じ色になり、境目なく繋がる
    float g = (HORIZON - uv.y) / HORIZON;
    vec3 far = mix(uHorizon, uZenith, 0.45);
    col = mix(far * 0.95, uWater, pow(g, 0.9));

    // 太陽の光の映り込み（縦の光の道）
    // uGlint: 今日の歩数の達成度。歩くほど光の道が手前まで長く・明るく伸びる
    float glintReach = mix(9.0, 0.9, uGlint);
    float pathWidth = mix(7.0, 2.6, g); // 手前ほど道幅が広がる
    float glint = exp(-abs(p.x - sp.x) * pathWidth) * exp(-g * glintReach);
    float shimmer = 0.7 + 0.3 * valueNoise(vec2(p.x * 40.0, uv.y * 90.0 - uTime * 0.9));
    col += uSunCol * glint * shimmer * (0.08 + 0.65 * uGlint);

    // かすかな水平のゆらぎ
    col *= 0.965 + 0.035 * valueNoise(vec2(uv.x * ar * 36.0, uv.y * 130.0 + uTime * 0.06));

    // 稲光と稲妻の水面への映り込み
    col += vec3(0.85, 0.9, 1.0) * uFlash * 0.28;
    if (uBoltAlpha > 0.001) {
      float boltDist = abs(p.x - uBoltX * ar);
      col += vec3(0.95, 0.95, 0.92) * exp(-boltDist * 12.0) * 0.22 * uBoltAlpha * (1.0 - g);
    }
  }

  // 地平線のもや（ごく淡く・霧の日は強く）
  col += uHorizon * (0.07 + uFog * 0.3) * exp(-abs(uv.y - HORIZON) * (26.0 - uFog * 16.0));

  // 霧: 全体を地平線の色へ押し流す
  col = mix(col, uHorizon, uFog * 0.35);

  // 雨・曇り: 彩度と明るさを落とす
  float gloom = clamp(max(uRain * 0.4, uDark), 0.0, 0.6);
  col = mix(col, vec3(dot(col, vec3(0.333))), gloom * 0.5);
  col *= 1.0 - uDark * 0.5;

  // 雨すじ / 雪（画面全体にうっすら降らせる）
  float precip = max(uRain, uSnow);
  if (precip > 0.001) {
    float isSnow = step(uRain, uSnow);
    float speed = mix(5.5, 0.9, isSnow);
    float slant = mix(14.0, 4.0, isSnow);
    vec2 rp = vec2(uv.x * ar * 60.0 + uv.y * slant, uv.y * 22.0 + uTime * speed);
    float cell = hash21(vec2(floor(rp.x), floor(rp.y)));
    float drop = step(1.0 - precip * 0.09, cell);
    float shape = smoothstep(0.0, 0.25, fract(rp.y)) * (1.0 - smoothstep(0.45, 0.9, fract(rp.y)));
    vec3 precipColor = mix(vec3(0.68, 0.74, 0.82), vec3(0.95, 0.96, 0.98), isSnow);
    col = mix(col, precipColor, drop * shape * (0.22 + isSnow * 0.2));
  }

  // 文字の可読性のため、緩やかなビネット
  vec2 q = uv - 0.5;
  col *= 1.0 - dot(q, q) * 0.4;

  outColor = vec4(col, 1.0);
}`;

// 時刻（時, 0-24）ごとの空の表情。間は滑らかに補間される
const SKY_STOPS = [
  { h: 0,    zenith: [0.04, 0.07, 0.15], horizon: [0.12, 0.15, 0.27], cloud: [0.32, 0.37, 0.52], sun: [0.92, 0.95, 1.0],  sunPos: [0.74, 0.82], stars: 1.0 },
  { h: 4.5,  zenith: [0.06, 0.09, 0.19], horizon: [0.2, 0.18, 0.3],   cloud: [0.4, 0.4, 0.55],   sun: [0.95, 0.92, 0.95], sunPos: [0.6, 0.6],   stars: 0.7 },
  { h: 6,    zenith: [0.35, 0.42, 0.6],  horizon: [0.98, 0.72, 0.55], cloud: [1.0, 0.84, 0.76],  sun: [1.0, 0.85, 0.62],  sunPos: [0.32, 0.2],  stars: 0.1 },
  { h: 9,    zenith: [0.36, 0.58, 0.8],  horizon: [0.87, 0.92, 0.93], cloud: [1.0, 1.0, 1.0],    sun: [1.0, 0.98, 0.9],   sunPos: [0.68, 0.78], stars: 0.0 },
  { h: 15,   zenith: [0.34, 0.55, 0.78], horizon: [0.9, 0.9, 0.88],   cloud: [1.0, 0.99, 0.97],  sun: [1.0, 0.96, 0.86],  sunPos: [0.42, 0.72], stars: 0.0 },
  { h: 18,   zenith: [0.3, 0.26, 0.46],  horizon: [0.98, 0.6, 0.38],  cloud: [0.96, 0.72, 0.62], sun: [1.0, 0.74, 0.48],  sunPos: [0.36, 0.16], stars: 0.05 },
  { h: 20.5, zenith: [0.08, 0.1, 0.22],  horizon: [0.32, 0.22, 0.32], cloud: [0.36, 0.36, 0.5],  sun: [0.95, 0.9, 0.9],   sunPos: [0.7, 0.5],   stars: 0.6 },
  { h: 24,   zenith: [0.04, 0.07, 0.15], horizon: [0.12, 0.15, 0.27], cloud: [0.32, 0.37, 0.52], sun: [0.92, 0.95, 1.0],  sunPos: [0.74, 0.82], stars: 1.0 }
];

// 季節ごとの空の表情（月から判定し、skyAtHourの結果に重ねる）
const SEASON_MODIFIERS = {
  // 春: 霞がかった柔らかい空
  spring: { zenithMix: [[1, 1, 1], 0.08], horizonMix: [[1, 0.95, 0.88], 0.15], cloudScale: 1.0, cloudExtra: 0.05, fogExtra: 0.12, starBoost: 0.85 },
  // 夏: 濃い青空と大きな入道雲
  summer: { zenithMix: [[0.11, 0.44, 0.82], 0.18], horizonMix: [[1, 1, 1], 0.05], cloudScale: 1.6, cloudExtra: 0.08, fogExtra: 0, starBoost: 1 },
  // 秋: 高く澄んだ空に細い雲が流れる
  autumn: { zenithMix: [[0.17, 0.31, 0.54], 0.12], horizonMix: [[1, 0.9, 0.77], 0.1], cloudScale: 0.62, cloudExtra: -0.05, fogExtra: 0, starBoost: 1.05 },
  // 冬: 冷たく澄んだ空、夜は星がよく見える
  winter: { zenithMix: [[0.74, 0.85, 0.94], 0.1], horizonMix: [[0.93, 0.96, 0.98], 0.12], cloudScale: 0.85, cloudExtra: -0.08, fogExtra: 0, starBoost: 1.3 }
};

// デバッグ用: 季節を強制する（null で実際の日付に戻る）
let seasonOverride = null;

export function setSkySeasonOverride(key) {
  seasonOverride = SEASON_MODIFIERS[key] ? key : null;
}

function getSeasonModifier(month) {
  if (seasonOverride) return SEASON_MODIFIERS[seasonOverride];
  if (month >= 3 && month <= 5) return SEASON_MODIFIERS.spring;
  if (month >= 6 && month <= 8) return SEASON_MODIFIERS.summer;
  if (month >= 9 && month <= 11) return SEASON_MODIFIERS.autumn;
  return SEASON_MODIFIERS.winter;
}

function mixColor(base, [target, amount]) {
  return base.map((v, i) => v + (target[i] - v) * amount);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpArray(a, b, t) {
  return a.map((v, i) => lerp(v, b[i], t));
}

function skyAtHour(hour) {
  let prev = SKY_STOPS[0];
  let next = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (hour >= SKY_STOPS[i].h && hour <= SKY_STOPS[i + 1].h) {
      prev = SKY_STOPS[i];
      next = SKY_STOPS[i + 1];
      break;
    }
  }
  const span = next.h - prev.h || 1;
  const t = Math.min(1, Math.max(0, (hour - prev.h) / span));
  return {
    zenith: lerpArray(prev.zenith, next.zenith, t),
    horizon: lerpArray(prev.horizon, next.horizon, t),
    cloud: lerpArray(prev.cloud, next.cloud, t),
    sun: lerpArray(prev.sun, next.sun, t),
    sunPos: lerpArray(prev.sunPos, next.sunPos, t),
    stars: lerp(prev.stars, next.stars, t)
  };
}

const mountedInstances = new WeakMap();

// 実際の天気（weather.js から setSkyWeather で更新される。未取得時は穏やかな晴れ）
let weatherState = { cloud: 0.28, rain: 0, snow: 0, fog: 0, dark: 0, thunder: 0 };

// 現在時刻の太陽（または月）の位置と色。3Dシーンの光源を空と一致させるために使う
// sunPos: [x(0-1 左→右), y(0-1 地平線→天頂)]
export function getSkySunState() {
  const sky = skyAtHour(currentHour());
  return { sunPos: sky.sunPos, sunColor: sky.sun };
}

// 今日の歩数の達成度（0-1）。湖に伸びる「光の道」の長さに反映される
let stepProgress = 0;

export function setSkyStepProgress(ratio) {
  stepProgress = Math.max(0, Math.min(1, Number(ratio) || 0));
}

export function getSkyStepProgress() {
  return stepProgress;
}

export function setSkyWeather(weather) {
  if (!weather) return;
  weatherState = {
    cloud: Number(weather.cloud) || 0,
    rain: Number(weather.rain) || 0,
    snow: Number(weather.snow) || 0,
    fog: Number(weather.fog) || 0,
    dark: Number(weather.dark) || 0,
    thunder: Number(weather.thunder) || 0
  };
}

// デバッグ用: 時間帯を強制する（null で実時刻に戻る）。蛍・朝靄・流れ星の確認に使う
let hourOverride = null;

export function setSkyHourOverride(hour) {
  hourOverride = Number.isFinite(Number(hour)) ? Math.max(0, Math.min(24, Number(hour))) : null;
}

function currentHour() {
  if (hourOverride !== null) return hourOverride;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

// 開花の祝福などから花火を打ち上げる（マウント済みの空FXレイヤーが消費する）
// hue: 色相を指定するとその植物の絵に合った色で開く（未指定はお祝いのランダム色）
let fireworksRequestId = 0;
let fireworksHue = null;

export function launchSkyFireworks(hue = null) {
  fireworksHue = Number.isFinite(Number(hue)) ? Number(hue) : null;
  fireworksRequestId++;
}

// デバッグ用: 流れ星を1本すぐに流す
let shootingStarRequestId = 0;

export function triggerShootingStar() {
  shootingStarRequestId++;
}

export function mountSkyBackground(container, options = {}) {
  if (!container) return null;
  // フラグではなく実際のキャンバスの有無で判定する
  // （innerHTML書き換え直後の再マウントがフラグ残りでスキップされる競合を防ぐ）
  if (container.querySelector(":scope > .sky-canvas")) {
    const existing = mountedInstances.get(container);
    if (existing && options.waterTint) existing.setWaterTint(options.waterTint);
    // FXキャンバスだけが掃除で消えていたら差し戻す
    if (existing?.fxCanvas && !container.querySelector(":scope > .sky-fx-canvas")) {
      existing.canvas.after(existing.fxCanvas);
    }
    return existing || null;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "sky-canvas";
  const gl = canvas.getContext("webgl2", { antialias: false });
  if (!gl) return null;

  let program;
  try {
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, SKY_VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, SKY_FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn("sky-background fallback:", error);
    return null;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(program, "uRes"),
    time: gl.getUniformLocation(program, "uTime"),
    zenith: gl.getUniformLocation(program, "uZenith"),
    horizon: gl.getUniformLocation(program, "uHorizon"),
    cloud: gl.getUniformLocation(program, "uCloud"),
    sunCol: gl.getUniformLocation(program, "uSunCol"),
    sunPos: gl.getUniformLocation(program, "uSunPos"),
    stars: gl.getUniformLocation(program, "uStars"),
    water: gl.getUniformLocation(program, "uWater"),
    cloudAmount: gl.getUniformLocation(program, "uCloudAmount"),
    rain: gl.getUniformLocation(program, "uRain"),
    snow: gl.getUniformLocation(program, "uSnow"),
    fog: gl.getUniformLocation(program, "uFog"),
    dark: gl.getUniformLocation(program, "uDark"),
    flash: gl.getUniformLocation(program, "uFlash"),
    boltAlpha: gl.getUniformLocation(program, "uBoltAlpha"),
    boltSeed: gl.getUniformLocation(program, "uBoltSeed"),
    boltX: gl.getUniformLocation(program, "uBoltX"),
    cloudScale: gl.getUniformLocation(program, "uCloudScale"),
    glint: gl.getUniformLocation(program, "uGlint")
  };

  // 落雷のタイミング管理（雷雨のときだけ数秒おきに光る）
  const STRIKE_DURATION_MS = 550;
  let nextStrikeAt = performance.now() + 1200;
  let strikeStartedAt = -1;
  let boltSeed = 37;
  let boltX = 0.5;

  let waterTint = options.waterTint || [0.63, 0.77, 0.8];

  // ── 空のFXレイヤー（花火・蛍・朝靄・流れ星）──
  // 空シェーダーの上・3D植物の下に重ねる2Dキャンバス。SHIZENの物理を踏襲:
  // 花火=速度+重力+減衰の放物線、蛍=乱れ+減衰の漂いとsin^3の明滅
  const fxCanvas = document.createElement("canvas");
  fxCanvas.className = "sky-fx-canvas";
  fxCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  const fx = fxCanvas.getContext("2d");
  const fxState = {
    lastTs: 0,
    fireworks: [],
    burstsQueued: [],
    lastFireworksId: fireworksRequestId,
    mist: Array.from({ length: 3 }, (_, i) => ({
      x: Math.random(), y: 0.64 + i * 0.04, speed: 0.006 + i * 0.004, w: 0.5 + Math.random() * 0.4
    })),
    star: null,
    lastStarId: shootingStarRequestId,
    // 美術館の塵: 光芒の中をゆっくり降りながらきらめく
    dust: Array.from({ length: 16 }, () => ({
      s: Math.random(),            // 光芒の幅方向の位置（0-1）
      y: Math.random(),            // 上端→地平線の進み（0-1）
      shaft: Math.random() < 0.5 ? 0 : 1,
      speed: 0.012 + Math.random() * 0.02,
      ph: Math.random() * Math.PI * 2
    }))
  };

  const spawnShootingStar = () => {
    const W = fxCanvas.width;
    const H = fxCanvas.height;
    const angle = (25 + Math.random() * 18) * (Math.PI / 180);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = W * (0.8 + Math.random() * 0.4);
    return {
      x: W * (dir > 0 ? 0.1 + Math.random() * 0.4 : 0.5 + Math.random() * 0.4),
      y: H * (0.06 + Math.random() * 0.16),
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
      ttl: 0.8,
      life: 0.8
    };
  };

  const drawSkyFx = (nowMs, hour, starLevel, sunX) => {
    const W = fxCanvas.width;
    const H = fxCanvas.height;
    const dt = Math.min(0.1, fxState.lastTs ? (nowMs - fxState.lastTs) / 1000 : 0.033);
    const t = nowMs / 1000;
    fxState.lastTs = nowMs;
    fx.clearRect(0, 0, W, H);
    const raining = weatherState.rain > 0.05 || weatherState.snow > 0.05;

    // 美術館の光芒と塵: 晴れた昼、太陽側の上端から斜めの光が差し、塵がきらきら漂う
    const dayLevel = Math.max(0, 1 - Math.abs(hour - 12) / 6.5);
    const shaftLevel = dayLevel
      * (1 - Math.min(1, weatherState.cloud * 1.3))
      * (1 - Math.min(1, weatherState.dark * 2))
      * (raining ? 0 : 1);
    if (shaftLevel > 0.04) {
      const horizonY = H * 0.7;
      const sx = (Number.isFinite(sunX) ? sunX : 0.5) * W;
      fx.globalCompositeOperation = "lighter";
      const shafts = [
        { topX: sx - W * 0.06, topW: W * 0.05, botX: sx - W * 0.3, botW: W * 0.2 },
        { topX: sx + W * 0.05, topW: W * 0.04, botX: sx + W * 0.14, botW: W * 0.16 }
      ];
      shafts.forEach((s, i) => {
        // ごくゆっくり呼吸するように強弱がつく
        const breathe = 0.75 + 0.25 * Math.sin(t * 0.23 + i * 2.1);
        const alpha = 0.055 * shaftLevel * breathe;
        const grad = fx.createLinearGradient(0, 0, 0, horizonY);
        grad.addColorStop(0, `rgba(255,248,228,${(alpha * 1.4).toFixed(4)})`);
        grad.addColorStop(0.75, `rgba(255,248,228,${alpha.toFixed(4)})`);
        grad.addColorStop(1, "rgba(255,248,228,0)");
        fx.fillStyle = grad;
        fx.beginPath();
        fx.moveTo(s.topX - s.topW, 0);
        fx.lineTo(s.topX + s.topW, 0);
        fx.lineTo(s.botX + s.botW, horizonY);
        fx.lineTo(s.botX - s.botW, horizonY);
        fx.closePath();
        fx.fill();
      });
      // 塵: 光芒の中をゆっくり降りて、またたく
      fxState.dust.forEach((d) => {
        d.y += d.speed * dt;
        if (d.y > 1) { d.y = 0; d.s = Math.random(); }
        const shaft = shafts[d.shaft];
        const topX = shaft.topX + (d.s * 2 - 1) * shaft.topW;
        const botX = shaft.botX + (d.s * 2 - 1) * shaft.botW;
        const x = topX + (botX - topX) * d.y + Math.sin(t * 0.6 + d.ph) * W * 0.004;
        const y = d.y * horizonY;
        const twinkle = 0.35 + 0.65 * Math.pow(Math.max(Math.sin(t * 1.1 + d.ph * 3), 0), 2);
        const alpha = 0.5 * shaftLevel * twinkle;
        if (alpha < 0.02) return;
        const r = Math.max(0.8, W / 700);
        fx.fillStyle = `rgba(255,250,236,${alpha.toFixed(3)})`;
        fx.fillRect(x - r / 2, y - r / 2, r, r);
      });
      fx.globalCompositeOperation = "source-over";
    }

    // 花火: 開花の祝福で3発、時間差で打ち上がる
    if (fxState.lastFireworksId !== fireworksRequestId) {
      fxState.lastFireworksId = fireworksRequestId;
      for (let i = 0; i < 3; i++) fxState.burstsQueued.push(nowMs + i * 650 + Math.random() * 200);
    }
    for (let i = fxState.burstsQueued.length - 1; i >= 0; i--) {
      if (nowMs >= fxState.burstsQueued[i]) {
        fxState.burstsQueued.splice(i, 1);
        const cx = W * (0.22 + Math.random() * 0.56);
        const cy = H * (0.16 + Math.random() * 0.22);
        const hue = fireworksHue ?? [46, 42, 36, 350, 205][Math.random() * 5 | 0];
        for (let k = 0; k < 64; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = (0.3 + Math.random() * 0.7) * H * 0.5;
          fxState.fireworks.push({
            x: cx, y: cy,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1.1 + Math.random() * 0.5,
            hue: hue + Math.random() * 14
          });
        }
      }
    }
    if (fxState.fireworks.length) {
      fx.globalCompositeOperation = "lighter";
      fx.lineCap = "round";
      for (let i = fxState.fireworks.length - 1; i >= 0; i--) {
        const p = fxState.fireworks[i];
        p.life -= dt;
        if (p.life <= 0) {
          fxState.fireworks.splice(i, 1);
          continue;
        }
        const drag = Math.pow(0.985, dt * 60);
        p.vx *= drag;
        p.vy = p.vy * drag + H * 0.16 * dt; // 重力で放物線に
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = Math.min(1, p.life);
        // 尾を引く火花（速度方向の短い線 + 明るい芯）
        fx.strokeStyle = `hsla(${p.hue},85%,62%,${(alpha * 0.6).toFixed(3)})`;
        fx.lineWidth = Math.max(1.5, W / 230);
        fx.beginPath();
        fx.moveTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
        fx.lineTo(p.x, p.y);
        fx.stroke();
        fx.fillStyle = `hsla(${p.hue},90%,${62 + p.life * 22}%,${alpha.toFixed(3)})`;
        fx.fillRect(p.x - 1.4, p.y - 1.4, 2.8, 2.8);
      }
      fx.globalCompositeOperation = "source-over";
    }

    // 朝靄: 明け方〜朝、地平線のあたりを横にゆっくり流れる（6時半ごろが濃さのピーク）
    const mistLevel = Math.max(0, 1 - Math.abs(hour - 6.5) / 2.5);
    if (mistLevel > 0.03 && weatherState.rain < 0.4) {
      fxState.mist.forEach((band, i) => {
        band.x = (band.x + band.speed * dt) % 1;
        const cx = band.x * W * 1.4 - W * 0.2;
        const cy = band.y * H;
        const rx = W * band.w;
        const gr = fx.createRadialGradient(cx, cy, 0, cx, cy, rx);
        const alpha = 0.1 * mistLevel * (1 - i * 0.2);
        gr.addColorStop(0, `rgba(232,238,240,${alpha.toFixed(3)})`);
        gr.addColorStop(1, "rgba(232,238,240,0)");
        fx.save();
        fx.translate(cx, cy);
        fx.scale(1, 0.07);
        fx.translate(-cx, -cy);
        fx.fillStyle = gr;
        fx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
        fx.restore();
      });
    }

    // 流れ星: 夜にまれに1本、尾を引いて流れる（デモボタンからも呼べる）
    if (fxState.lastStarId !== shootingStarRequestId) {
      fxState.lastStarId = shootingStarRequestId;
      if (!fxState.star) fxState.star = spawnShootingStar();
    }
    const starGate = starLevel > 0.35 && !raining;
    if (!fxState.star && starGate && Math.random() < dt / 28) {
      fxState.star = spawnShootingStar();
    }
    if (fxState.star) {
      const s = fxState.star;
      s.life -= dt;
      if (s.life <= 0) {
        fxState.star = null;
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const alpha = Math.min(1, s.life * 2.2) * Math.min(1, (s.ttl - s.life) * 6);
        const tailX = s.x - s.vx * 0.22;
        const tailY = s.y - s.vy * 0.22;
        const gr = fx.createLinearGradient(tailX, tailY, s.x, s.y);
        gr.addColorStop(0, "rgba(200,220,255,0)");
        gr.addColorStop(1, `rgba(240,246,255,${(alpha * 0.9).toFixed(3)})`);
        fx.strokeStyle = gr;
        fx.lineWidth = Math.max(1.6, W / 320);
        fx.lineCap = "round";
        fx.beginPath();
        fx.moveTo(tailX, tailY);
        fx.lineTo(s.x, s.y);
        fx.stroke();
        // 先端の光
        const headR = Math.max(2.5, W / 220);
        const head = fx.createRadialGradient(s.x, s.y, 0, s.x, s.y, headR);
        head.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
        head.addColorStop(1, "rgba(255,255,255,0)");
        fx.fillStyle = head;
        fx.fillRect(s.x - headR, s.y - headR, headR * 2, headR * 2);
      }
    }
  };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    // 雲は柔らかいので低解像度で描いて引き伸ばす（省電力）
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
    canvas.width = Math.max(2, Math.round(rect.width * scale));
    canvas.height = Math.max(2, Math.round(rect.height * scale));
    // FXレイヤーは線の細さが命なので少し高めの解像度で
    const fxScale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.9;
    fxCanvas.width = Math.max(2, Math.round(rect.width * fxScale));
    fxCanvas.height = Math.max(2, Math.round(rect.height * fxScale));
  };
  resize();
  new ResizeObserver(resize).observe(container);

  const start = performance.now();
  let rafId = 0;
  let frameCount = 0;

  const frame = () => {
    // 再レンダリングでキャンバスが消されたら停止してGPUコンテキストを解放する
    if (!container.isConnected || !canvas.isConnected) {
      cancelAnimationFrame(rafId);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }
    rafId = requestAnimationFrame(frame);
    frameCount++;
    // ホームが非表示のときと、2フレームに1回は描画を省く
    // （offsetParent は position:fixed の鑑賞モードで null になるため getClientRects で判定）
    if (container.getClientRects().length === 0 || frameCount % 2 === 0) return;

    const now = new Date();
    const hour = currentHour();
    const sky = skyAtHour(hour);
    const season = getSeasonModifier(now.getMonth() + 1);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, (performance.now() - start) / 1000);
    gl.uniform3fv(u.zenith, mixColor(sky.zenith, season.zenithMix));
    gl.uniform3fv(u.horizon, mixColor(sky.horizon, season.horizonMix));
    gl.uniform3fv(u.cloud, sky.cloud);
    gl.uniform3fv(u.sunCol, sky.sun);
    gl.uniform2fv(u.sunPos, sky.sunPos);
    const starLevel = sky.stars * season.starBoost * (1.0 - Math.min(1, weatherState.cloud));
    gl.uniform1f(u.stars, starLevel);
    gl.uniform3fv(u.water, waterTint);
    gl.uniform1f(u.cloudAmount, Math.max(0, Math.min(1, weatherState.cloud + season.cloudExtra)));
    gl.uniform1f(u.rain, weatherState.rain);
    gl.uniform1f(u.snow, weatherState.snow);
    gl.uniform1f(u.fog, Math.min(1, weatherState.fog + season.fogExtra));
    gl.uniform1f(u.dark, weatherState.dark);
    gl.uniform1f(u.cloudScale, season.cloudScale);
    gl.uniform1f(u.glint, stepProgress);

    // 落雷: 数秒おきに稲妻 + 明滅（チカチカと減衰する）
    let flash = 0;
    let boltAlpha = 0;
    if (weatherState.thunder > 0) {
      const nowMs = performance.now();
      if (nowMs >= nextStrikeAt) {
        strikeStartedAt = nowMs;
        nextStrikeAt = nowMs + 2500 + Math.random() * 7000;
        boltSeed = Math.random() * 100;
        boltX = 0.15 + Math.random() * 0.7;
        // 環境音モジュールなどが雷鳴を鳴らせるように通知する
        window.dispatchEvent(new CustomEvent("artarium:lightning"));
      }
      const elapsed = nowMs - strikeStartedAt;
      if (strikeStartedAt > 0 && elapsed < STRIKE_DURATION_MS) {
        const decay = 1 - elapsed / STRIKE_DURATION_MS;
        flash = weatherState.thunder * Math.pow(decay, 1.5) * (0.55 + 0.45 * Math.random());
        boltAlpha = elapsed < STRIKE_DURATION_MS * 0.45 ? 0.6 + 0.4 * Math.random() : 0;
      }
    }
    gl.uniform1f(u.flash, flash);
    gl.uniform1f(u.boltAlpha, boltAlpha);
    gl.uniform1f(u.boltSeed, boltSeed);
    gl.uniform1f(u.boltX, boltX);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 空の上に重ねるFX（光芒と塵・花火・朝靄・流れ星）
    drawSkyFx(performance.now(), hour, starLevel, sky.sunPos[0]);
  };

  container.prepend(canvas);
  canvas.after(fxCanvas);
  rafId = requestAnimationFrame(frame);
  const instance = {
    canvas,
    fxCanvas,
    setWaterTint(tint) {
      if (Array.isArray(tint) && tint.length === 3) waterTint = tint;
    }
  };
  mountedInstances.set(container, instance);
  return instance;
}
