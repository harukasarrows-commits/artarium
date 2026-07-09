// リアルタイム水面レイヤー
// `.water-environment` に WebGL の水面シミュレーションを重ねる。
// WebGL2 / float テクスチャ非対応の環境では何もせず、既存のCSS水面が残る。

import { getSkySunState, getSkyStepProgress } from "./sky-background.js?v=20260709-81";

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// 波動方程式: r = 高さ, g = 速度
const SIM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uDamp;
uniform int uDropCount;
uniform vec4 uDrops[16]; // xy = uv, z = 強さ, w = 半径

void main() {
  vec2 s = texture(uState, vUv).rg;
  float h = s.r, v = s.g;

  float l = texture(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float r = texture(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float d = texture(uState, vUv - vec2(0.0, uTexel.y)).r;
  float u = texture(uState, vUv + vec2(0.0, uTexel.y)).r;

  v += ((l + r + u + d) * 0.25 - h) * 1.9;
  v *= uDamp;
  h += v;
  h *= 0.999;

  for (int i = 0; i < 16; i++) {
    if (i >= uDropCount) break;
    vec2 dp = vUv - uDrops[i].xy;
    h += uDrops[i].z * exp(-dot(dp, dp) / (uDrops[i].w * uDrops[i].w));
  }

  float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(0.0, 0.04, 1.0 - vUv.x)
             * smoothstep(0.0, 0.04, vUv.y) * smoothstep(0.0, 0.04, 1.0 - vUv.y);
  h *= mix(0.9, 1.0, edge);

  outColor = vec4(h, v, 0.0, 1.0);
}`;

const RENDER_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec3 uDeep;
uniform vec3 uSkyLow;
uniform vec3 uSkyHigh;
uniform vec3 uLightColor;
uniform vec3 uLightDir;

void main() {
  float h  = texture(uState, vUv).r;
  float hx = texture(uState, vUv + vec2(uTexel.x, 0.0)).r - texture(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float hy = texture(uState, vUv + vec2(0.0, uTexel.y)).r - texture(uState, vUv - vec2(0.0, uTexel.y)).r;

  vec3 n = normalize(vec3(-hx * 110.0, 1.0, -hy * 110.0));
  vec3 eye = normalize(vec3(0.0, 1.0, 0.35));

  vec3 refl = reflect(-eye, n);
  vec3 skyCol = mix(uSkyLow, uSkyHigh, pow(clamp(refl.y, 0.0, 1.0), 1.3));
  float fresnel = pow(1.0 - max(dot(n, eye), 0.0), 3.0) * 0.85 + 0.2;

  vec3 col = mix(uDeep * (1.0 + h * 2.0), skyCol, fresnel);

  vec3 L = normalize(uLightDir);
  col += uLightColor * pow(max(dot(refl, L), 0.0), 200.0) * 1.2;
  col += uLightColor * pow(max(dot(refl, L), 0.0), 10.0) * 0.1;

  // 楕円ビネット（縁を軽く沈ませてCSSの楕円クリップに馴染ませる）
  vec2 q = (vUv - 0.5) * vec2(2.0, 2.0);
  float vig = 1.0 - smoothstep(0.55, 1.0, length(q));
  col *= 0.62 + vig * 0.42;

  outColor = vec4(col, 1.0);
}`;

// 澄んだ水（淡い青緑 + 乳白色の空 + クリーム色の光）
const PALETTE = {
  deep: [0.3, 0.47, 0.53],
  skyLow: [0.55, 0.72, 0.78],
  skyHigh: [0.97, 0.96, 0.9],
  light: [1.0, 0.96, 0.85],
  dir: [0.25, 0.4, -0.55]
};

const MAX_DROPS = 16;
const instances = new Set();
let observer = null;

// 実際の天気が雨のとき、全水面に降らせる雨の強さ（0-1、weather.js から更新）
let ambientRainLevel = 0;

export function setAmbientRain(level) {
  ambientRainLevel = Math.max(0, Math.min(1, Number(level) || 0));
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function makeProgram(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function makeTarget(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, w, h, 0, gl.RG, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo };
}

export function mountWaterSurface(container) {
  if (!container || container.dataset.waterReady) return null;
  container.dataset.waterReady = "true";

  const canvas = document.createElement("canvas");
  canvas.className = "water-surface-canvas";
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: true });
  if (!gl || !(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))) {
    delete container.dataset.waterReady;
    return null; // 既存のCSS水面をそのまま使う
  }

  const rect = container.getBoundingClientRect();
  const aspect = rect.width > 0 && rect.height > 0 ? rect.height / rect.width : 0.52;
  const simW = 224;
  const simH = Math.max(64, Math.round(simW * aspect));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(2, Math.round((rect.width || 360) * dpr));
  canvas.height = Math.max(2, Math.round((rect.height || 190) * dpr));

  let simProg, renProg, a, b;
  try {
    simProg = makeProgram(gl, SIM_FRAG);
    renProg = makeProgram(gl, RENDER_FRAG);
    a = makeTarget(gl, simW, simH);
    b = makeTarget(gl, simW, simH);
    if (!a || !b) throw new Error("framebuffer incomplete");
  } catch (error) {
    console.warn("water-surface fallback:", error);
    delete container.dataset.waterReady;
    return null;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const uSim = {
    state: gl.getUniformLocation(simProg, "uState"),
    texel: gl.getUniformLocation(simProg, "uTexel"),
    damp: gl.getUniformLocation(simProg, "uDamp"),
    dropCount: gl.getUniformLocation(simProg, "uDropCount"),
    drops: gl.getUniformLocation(simProg, "uDrops")
  };
  const uRen = {
    state: gl.getUniformLocation(renProg, "uState"),
    texel: gl.getUniformLocation(renProg, "uTexel"),
    deep: gl.getUniformLocation(renProg, "uDeep"),
    skyLow: gl.getUniformLocation(renProg, "uSkyLow"),
    skyHigh: gl.getUniformLocation(renProg, "uSkyHigh"),
    lightColor: gl.getUniformLocation(renProg, "uLightColor"),
    lightDir: gl.getUniformLocation(renProg, "uLightDir")
  };

  const dropQueue = [];
  const dropData = new Float32Array(MAX_DROPS * 4);
  let texA = a.tex, fboA = a.fbo, texB = b.tex, fboB = b.fbo;
  let rafId = 0;
  let rainUntil = 0;

  const instance = {
    container,
    ripple(u, v, strength = -0.5, radius = 0.035) {
      dropQueue.push([u, v, strength, radius]);
    },
    rain(durationMs = 1600) {
      rainUntil = Math.max(rainUntil, performance.now() + durationMs);
    },
    destroy() {
      cancelAnimationFrame(rafId);
      instances.delete(instance);
      canvas.remove();
      container.classList.remove("is-live");
      delete container.dataset.waterReady;
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
  };

  canvas.addEventListener("pointerdown", (event) => {
    const r = canvas.getBoundingClientRect();
    instance.ripple(
      (event.clientX - r.left) / r.width,
      1 - (event.clientY - r.top) / r.height,
      -0.3,
      0.025
    );
    window.dispatchEvent(new CustomEvent("artarium:ripple", { detail: { strength: 0.3 } }));
  });

  function bindQuad(prog) {
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  function frame() {
    if (!container.isConnected) {
      instance.destroy();
      return;
    }
    rafId = requestAnimationFrame(frame);
    // 省電力: 画面に見えていない間（別画面表示中など）は計算と描画を止める
    if (canvas.getClientRects().length === 0) return;

    // そよ風のゆらぎ + 水やり中の雨 + 実際の天気の雨
    if (Math.random() < 0.02) instance.ripple(Math.random(), Math.random(), -0.05, 0.08);
    if (performance.now() < rainUntil && Math.random() < 0.5) {
      instance.ripple(0.08 + Math.random() * 0.84, 0.08 + Math.random() * 0.84, -0.3, 0.025);
    }
    if (ambientRainLevel > 0 && Math.random() < 0.3 * ambientRainLevel) {
      instance.ripple(Math.random(), Math.random(), -0.1 - 0.12 * ambientRainLevel, 0.018);
    }

    for (let step = 0; step < 2; step++) {
      const n = Math.min(dropQueue.length, MAX_DROPS);
      for (let i = 0; i < n; i++) dropData.set(dropQueue.shift(), i * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
      gl.viewport(0, 0, simW, simH);
      gl.useProgram(simProg);
      bindQuad(simProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(uSim.state, 0);
      gl.uniform2f(uSim.texel, 1 / simW, 1 / simH);
      gl.uniform1f(uSim.damp, 0.99);
      gl.uniform1i(uSim.dropCount, n);
      gl.uniform4fv(uSim.drops, dropData);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      [texA, texB] = [texB, texA];
      [fboA, fboB] = [fboB, fboA];
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(renProg);
    bindQuad(renProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(uRen.state, 0);
    gl.uniform2f(uRen.texel, 1 / simW, 1 / simH);
    gl.uniform3fv(uRen.deep, PALETTE.deep);
    gl.uniform3fv(uRen.skyLow, PALETTE.skyLow);
    gl.uniform3fv(uRen.skyHigh, PALETTE.skyHigh);
    gl.uniform3fv(uRen.lightColor, PALETTE.light);
    gl.uniform3fv(uRen.lightDir, PALETTE.dir);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  container.appendChild(canvas);
  container.classList.add("is-live");
  instances.add(instance);
  instance.ripple(0.5, 0.55, -0.9, 0.05);
  rafId = requestAnimationFrame(frame);
  return instance;
}

export function rainBurst(durationMs = 1600) {
  instances.forEach((instance) => instance.rain(durationMs));
  return instances.size > 0;
}

// ---------- Three.js シーン用の水面 ----------
// GLSL1 で書き、Three.js の ShaderMaterial に変換を任せる

const THREE_SIM_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const THREE_SIM_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uDamp;
uniform int uDropCount;
uniform vec4 uDrops[16];

void main() {
  vec2 s = texture2D(uState, vUv).rg;
  float h = s.r, v = s.g;

  float l = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float r = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float d = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
  float u = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;

  v += ((l + r + u + d) * 0.25 - h) * 1.9;
  v *= uDamp;
  h += v;
  h *= 0.999;

  for (int i = 0; i < 16; i++) {
    if (i >= uDropCount) break;
    vec2 dp = vUv - uDrops[i].xy;
    h += uDrops[i].z * exp(-dot(dp, dp) / (uDrops[i].w * uDrops[i].w));
  }

  float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(0.0, 0.06, 1.0 - vUv.x)
             * smoothstep(0.0, 0.06, vUv.y) * smoothstep(0.0, 0.06, 1.0 - vUv.y);
  h *= mix(0.9, 1.0, edge);

  gl_FragColor = vec4(h, v, 0.0, 1.0);
}`;

const THREE_WATER_VERT = `
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vNdcX;
uniform sampler2D uState;
uniform float uAmp;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += texture2D(uState, uv).r * uAmp;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  vec4 clip = projectionMatrix * viewMatrix * wp;
  vNdcX = clip.x / max(clip.w, 0.0001);
  gl_Position = clip;
}`;

const THREE_WATER_FRAG = `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vNdcX;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec3 uDeep;
uniform vec3 uSkyLow;
uniform vec3 uSkyHigh;
uniform vec3 uLightColor;
uniform vec3 uLightDir;
uniform float uOpacity;
uniform float uGlint;
uniform float uGlintX;

void main() {
  float h  = texture2D(uState, vUv).r;
  float hx = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float hy = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r - texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;

  // 平面は X軸回りに -90度 回転しているので、ローカル (x, y) は ワールド (x, -z)
  vec3 n = normalize(vec3(-hx * 60.0, 1.0, hy * 60.0));
  vec3 eye = normalize(cameraPosition - vWorldPos);

  vec3 refl = reflect(-eye, n);
  vec3 skyCol = mix(uSkyLow, uSkyHigh, pow(clamp(refl.y, 0.0, 1.0), 1.3));
  float fresnel = pow(1.0 - max(dot(n, eye), 0.0), 3.0) * 0.8 + 0.22;

  vec3 col = mix(uDeep * (1.0 + h * 2.2), skyCol, fresnel);

  vec3 L = normalize(uLightDir);
  col += uLightColor * pow(max(dot(refl, L), 0.0), 200.0) * 1.1;
  col += uLightColor * pow(max(dot(refl, L), 0.0), 10.0) * 0.1;

  // 光の道: 今日の歩数の達成度に応じて、太陽の真下（奥）から手前へ光の帯が伸びる
  // 帯は画面座標基準（uGlintX = 太陽のNDC x）なので、視点によらず必ず太陽と縦に揃う
  // 波の高さでちらちらと瞬き、奥（vUv.y大）ほど明るく、手前の先端ほど淡くなる
  if (uGlint > 0.001) {
    float dx = abs(vNdcX - uGlintX);
    float band = exp(-dx * dx * 70.0);        // 中心のはっきりした帯（画面幅の1割ほど）
    float halo = exp(-dx * dx * 14.0) * 0.3;  // 帯のまわりのにじみ
    // 道の先端: 歩数に応じて奥（vUv.y=1）から手前（0）へ伸び、先端までは全輝度を保つ
    float tip = 1.0 - uGlint;
    float reach = smoothstep(tip - 0.18, tip + 0.22, vUv.y) * mix(0.55, 1.0, vUv.y);
    float sparkle = 0.6 + clamp(h * 10.0, -0.3, 1.6);
    col += uLightColor * (band + halo) * reach * sparkle * 1.2;
  }

  // リニア値をsRGBへ（ShaderMaterialは自動変換されず暗く沈むため）
  col = pow(col, vec3(1.0 / 2.2));

  // 楕円マスクで縁を広くぼかし、背景の湖と一続きに見せる
  vec2 q = (vUv - 0.5) * 2.0;
  float mask = 1.0 - smoothstep(0.45, 0.95, length(q));

  gl_FragColor = vec4(col, uOpacity * mask);
}`;

export function createThreeWater(THREE, options = {}) {
  const {
    width = 6.1,
    depth = 3.55,
    deepColor = "#486b62",
    opacity = 0.92,
    simW = 192,
    simH = 112,
    lightDir = null,
    lightColor = null
  } = options;

  try {
    const targetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };
    let targetA = new THREE.WebGLRenderTarget(simW, simH, targetOptions);
    let targetB = new THREE.WebGLRenderTarget(simW, simH, targetOptions);

    const simScene = new THREE.Scene();
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null },
        uTexel: { value: new THREE.Vector2(1 / simW, 1 / simH) },
        uDamp: { value: 0.99 },
        uDropCount: { value: 0 },
        uDrops: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector4()) }
      },
      vertexShader: THREE_SIM_VERT,
      fragmentShader: THREE_SIM_FRAG,
      depthTest: false,
      depthWrite: false
    });
    const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    simScene.add(simQuad);

    // シェーダー内でリニア→sRGB変換するため、表示用の色はリニアに直して渡す
    const toLinear = (rgb) => rgb.map((v) => Math.pow(v, 2.2));
    const deep = new THREE.Color(deepColor).lerp(new THREE.Color("#bfe6ec"), 0.3).multiplyScalar(0.9);
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: targetA.texture },
        uTexel: { value: new THREE.Vector2(1 / simW, 1 / simH) },
        uAmp: { value: 0.14 },
        uDeep: { value: new THREE.Vector3(deep.r, deep.g, deep.b) },
        uSkyLow: { value: new THREE.Vector3(...toLinear(PALETTE.skyLow)) },
        uSkyHigh: { value: new THREE.Vector3(...toLinear(PALETTE.skyHigh)) },
        uLightColor: { value: new THREE.Vector3(...toLinear(lightColor || PALETTE.light)) },
        uLightDir: { value: new THREE.Vector3(...(lightDir || [0.5, 0.62, 0.6])) },
        uOpacity: { value: opacity },
        uGlint: { value: 0 },
        uGlintX: { value: 0 }
      },
      vertexShader: THREE_WATER_VERT,
      fragmentShader: THREE_WATER_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, 96, 56), waterMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;

    const dropQueue = [];
    let rainUntil = 0;
    let disposed = false;

    const instance = {
      mesh,
      ripple(u, v, strength = -0.5, radius = 0.04) {
        dropQueue.push([u, v, strength, radius]);
      },
      rain(durationMs = 1600) {
        rainUntil = Math.max(rainUntil, performance.now() + durationMs);
      },
      update(renderer) {
        if (disposed) return;
        if (Math.random() < 0.02) instance.ripple(Math.random(), Math.random(), -0.04, 0.09);
        if (performance.now() < rainUntil && Math.random() < 0.5) {
          instance.ripple(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, -0.25, 0.03);
        }
        if (ambientRainLevel > 0 && Math.random() < 0.3 * ambientRainLevel) {
          instance.ripple(Math.random(), Math.random(), -0.08 - 0.12 * ambientRainLevel, 0.022);
        }
        const previousTarget = renderer.getRenderTarget();
        for (let step = 0; step < 2; step++) {
          const n = Math.min(dropQueue.length, MAX_DROPS);
          for (let i = 0; i < n; i++) {
            simMaterial.uniforms.uDrops.value[i].fromArray(dropQueue.shift());
          }
          simMaterial.uniforms.uDropCount.value = n;
          simMaterial.uniforms.uState.value = targetA.texture;
          renderer.setRenderTarget(targetB);
          renderer.render(simScene, simCamera);
          [targetA, targetB] = [targetB, targetA];
        }
        renderer.setRenderTarget(previousTarget);
        waterMaterial.uniforms.uState.value = targetA.texture;
        // 光の道: 空モジュールの歩数達成度・太陽位置と毎フレーム同期する
        // 太陽の画面上のx(0-1)をNDC(-1〜1)へ。空と水面のcanvasは同じ幅で重なっている前提
        const sun = getSkySunState();
        waterMaterial.uniforms.uGlint.value = getSkyStepProgress();
        waterMaterial.uniforms.uGlintX.value = sun.sunPos[0] * 2 - 1;
      },
      destroy() {
        if (disposed) return;
        disposed = true;
        instances.delete(instance);
        targetA.dispose();
        targetB.dispose();
        simQuad.geometry.dispose();
        simMaterial.dispose();
        mesh.geometry.dispose();
        waterMaterial.dispose();
      }
    };

    instances.add(instance);
    instance.ripple(0.5, 0.5, -0.7, 0.06);
    return instance;
  } catch (error) {
    console.warn("createThreeWater fallback:", error);
    return null;
  }
}

export function observeWaterSurfaces() {
  document.querySelectorAll(".water-environment").forEach((el) => mountWaterSurface(el));
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.(".water-environment")) mountWaterSurface(node);
        node.querySelectorAll?.(".water-environment").forEach((el) => mountWaterSurface(el));
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
