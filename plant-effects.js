// 植物ごとのエフェクト
// GLBモデル自体は変更せず、揺れ・明滅・粒子などの演出を描画時に重ねる。
// 各植物のモチーフ（名画）に合わせた表現を PLANT_EFFECTS で定義する。

// 天気と連動する風の強さ（0-1、app.js から更新）
let windLevel = 0.25;

export function setPlantWind(level) {
  windLevel = Math.max(0, Math.min(1, Number(level) || 0));
}

// petal: 舞い散る花びらの色。その植物の「花」の色に合わせる（未指定ならパレット3色目）
// shed: 開花後の「散り」演出のテーマ（2026-07-09 ユーザー選択の案1: 植物ごとに名画に合わせる）
//   kind: rise(立ちのぼる) / vortex(渦を巻く) / droplet(滴る) / flutter(ひらひら落ちる) / floatfall(ふわふわ降りて溶ける)
//   shape: mote(光の粒) / star(星屑) / foil(金箔片) / shard(かけら) / droplet(雫) / bubble(泡)
//   shed が無い植物（今後の新規追加など）は従来の花びら散りにフォールバックする
const PLANT_EFFECTS = {
  // 叫び: ぐにゃりと波打つ歪み + 夕焼け色のかけらが渦を巻いて立ちのぼる（あの空のうねり）
  "scream-bloom": {
    warp: 1,
    petal: 0xe0b04e, // 金色の「叫び」の花
    particles: { type: "orbit", color: 0xff8855, count: 30, size: 0.05 },
    shed: { kind: "vortex", shape: "mote", colors: [0xffb066, 0xff8855, 0xffd9a0], additive: true }
  },
  // ひまわり: 風にそよぐ + 光る花粉がふわっと舞い上がる
  "sunflower-bloom": {
    sway: 1,
    petal: 0xf0c435, // ひまわりの黄金色
    particles: { type: "pollen", color: 0xffd77a, count: 34, size: 0.05 },
    shed: { kind: "rise", shape: "mote", colors: [0xffd77a, 0xffe9ad, 0xf0c435], additive: true }
  },
  // 睡蓮(神奈川沖浪裏): 波のしぶきの雫が滴り、水面に波紋が立つ
  "water-lily-bloom": {
    bob: 1,
    sway: 0.35,
    petal: 0xa8bfe0, // 青い睡蓮（白い縁どり）の淡い青
    particles: { type: "glimmer", color: 0xbfe6ec, count: 24, size: 0.044 },
    shed: { kind: "droplet", shape: "droplet", colors: [0xd8edf6, 0xaacfe0, 0xeef8fb] }
  },
  // 水の庭: 浮き沈み + 虹色の光の粒がゆっくり立ちのぼる
  "aquatic-bloom": {
    bob: 1,
    sway: 0.45,
    petal: 0xb9a7dd, // 藤色の花
    particles: { type: "glimmer", color: 0xe8c8dc, count: 24, size: 0.044 },
    shed: { kind: "rise", shape: "mote", colors: [0xe8c8dc, 0xbfe6ec, 0xd9c7f0], additive: true, slow: true }
  },
  // ルネサンス肖像: 木漏れ日のような光斑がふわりと降りて溶ける
  "renaissance-smile-bloom": {
    sway: 0.22,
    petal: 0xd4b16a, // 落ち着いた金褐色
    glow: { color: 0xf4e6c2, amp: 0.06, speed: 0.7 },
    shed: { kind: "floatfall", shape: "mote", colors: [0xf6e8c4, 0xecd9a4, 0xfdf6e0], additive: true }
  },
  // 星月夜: 星屑がまたたきながら降る + 青い明滅
  "nocturne-sky-bloom": {
    sway: 0.4,
    petal: 0x6d8cc9, // 星月夜の渦の青
    glow: { color: 0x3355aa, amp: 0.12, speed: 1.1 },
    particles: { type: "orbit", color: 0xaac8ff, count: 40, size: 0.048 },
    shed: { kind: "floatfall", shape: "star", colors: [0xaac8ff, 0xe0ecff, 0x7d9fe8], additive: true, twinkle: true }
  },
  // 接吻(クリムト): 金箔の小片がきらめきながら舞い落ちる
  "golden-embrace-bloom": {
    sway: 0.3,
    petal: 0xd9b445, // マスタードがかった金
    particles: { type: "sparkle", color: 0xffd75e, count: 32, size: 0.058 },
    shed: { kind: "flutter", shape: "foil", colors: [0xffd75e, 0xd9b445, 0xf6e6a8], glint: true }
  },
  // モノクロ: グリッチ + 墨のかけらが舞う
  "monochrome-fracture-bloom": {
    glitch: 1,
    petal: 0xdedcd4, // モノクロの白
    // 墨のにじみ: 暗い霧の粒がふわりと降りて溶ける（通常合成で影として描く）
    shed: { kind: "floatfall", shape: "mote", colors: [0x2e2c28, 0x6a675f, 0xcfccc2], additive: false }
  },
  // 真珠の少女: 真珠光の泡がゆっくり浮かんでいく
  "pearl-light-bloom": {
    sway: 0.25,
    petal: 0xf0e6cf, // 真珠色
    glow: { color: 0xf6ecd8, amp: 0.1, speed: 0.8 },
    particles: { type: "drift", color: 0xfff2cc, count: 14, size: 0.055 },
    shed: { kind: "rise", shape: "bubble", colors: [0xfff4d8, 0xf6ecd8, 0xffefe2], additive: true, slow: true }
  }
};

function createParticles(THREE, config, stage) {
  const count = config.count;
  const positions = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      phase: Math.random() * Math.PI * 2,
      radius: 0.25 + Math.random() * 0.55,
      speed: 0.6 + Math.random() * 0.8,
      y0: Math.random()
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(config.color),
    size: config.size,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 3;

  const update = (t) => {
    const attr = geometry.getAttribute("position");
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      let x = 0, y = 0, z = 0;
      if (config.type === "pollen") {
        // 下から上へ舞い上がり、上端でループ
        y = ((s.y0 + t * 0.06 * s.speed) % 1) * 1.1;
        x = Math.cos(s.phase) * s.radius * 0.7 + Math.sin(t * 0.7 + s.phase) * 0.08;
        z = Math.sin(s.phase) * s.radius * 0.5 + Math.cos(t * 0.5 + s.phase) * 0.08;
      } else if (config.type === "glimmer") {
        // 水面近くで上下にきらめく
        x = Math.cos(s.phase) * s.radius;
        z = Math.sin(s.phase) * s.radius * 0.7;
        y = -0.45 + Math.abs(Math.sin(t * 1.2 * s.speed + s.phase)) * 0.14;
      } else if (config.type === "orbit") {
        // 渦を巻いて周回（星月夜）
        const angle = s.phase + t * 0.35 * s.speed;
        const r = s.radius * (0.85 + Math.sin(t * 0.4 + s.phase) * 0.15);
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r * 0.7;
        y = (s.y0 - 0.35) * 0.9 + Math.sin(t * 0.8 + s.phase) * 0.1;
      } else if (config.type === "sparkle") {
        // ほぼ固定位置でまたたく
        x = Math.cos(s.phase) * s.radius * 0.7;
        z = Math.sin(s.phase * 2.3) * s.radius * 0.5;
        y = (s.y0 - 0.3) * 0.9 + Math.sin(t * 3 * s.speed + s.phase) * 0.015;
      } else {
        // drift: ゆっくり漂う
        x = Math.cos(t * 0.18 * s.speed + s.phase) * s.radius * 0.8;
        z = Math.sin(t * 0.14 * s.speed + s.phase * 1.7) * s.radius * 0.5;
        y = (s.y0 - 0.3) * 0.8 + Math.sin(t * 0.35 + s.phase) * 0.18;
      }
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
    // またたき（種類によって速さを変える）
    const flickerSpeed = config.type === "sparkle" ? 2.6 : 0.9;
    const stageRatio = Math.min(1, stage / 6);
    material.opacity = (0.45 + 0.35 * Math.abs(Math.sin(t * flickerSpeed))) * stageRatio;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { points, update, dispose };
}

// 部分的な揺れ: 頂点シェーダーで「根元は固定・上にいくほど大きくしなる」変形を仕込む
// メッシュごとに自身の高さ範囲を基準にするので、パーツ分けされたモデルでは
// 葉や花がそれぞれの付け根からしなる
function attachBendSway(THREE, root) {
  const bendTargets = [];
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    child.geometry.computeBoundingBox();
    const box = child.geometry.boundingBox;
    const minY = box.min.y;
    const range = Math.max(0.0001, box.max.y - minY);
    const materials = (Array.isArray(child.material) ? child.material : [child.material]).map((material) => {
      const mat = material.userData.__bendApplied ? material.clone() : material;
      const uniforms = {
        uBendTime: { value: 0 },
        uBendAmp: { value: 0 },
        uBendFreq: { value: 1.4 },
        uBendMinY: { value: minY },
        uBendRange: { value: range }
      };
      mat.userData.__bendApplied = true;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `
uniform float uBendTime;
uniform float uBendAmp;
uniform float uBendFreq;
uniform float uBendMinY;
uniform float uBendRange;
${shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
float bendW = clamp((transformed.y - uBendMinY) / uBendRange, 0.0, 1.0);
bendW *= bendW; // 根元ほど動かず、先端ほど大きく
transformed.x += sin(uBendTime + transformed.y * uBendFreq) * uBendAmp * bendW;
transformed.z += cos(uBendTime * 0.73 + transformed.x * uBendFreq * 0.6) * uBendAmp * 0.45 * bendW;
`)}`;
      };
      mat.needsUpdate = true;
      bendTargets.push({ uniforms, range });
      return mat;
    });
    child.material = Array.isArray(child.material) ? materials : materials[0];
  });
  return bendTargets;
}

// 次のフレームで即座に花びらをまとめて散らす（タップ演出・デバッグ用）
let petalShedRequestId = 0;
let petalShedRequestCount = 5;

export function shedPetalsNow(count = 5) {
  petalShedRequestId++;
  petalShedRequestCount = Math.max(1, Math.round(count));
}

// 植物の「花」の部分（モデルの上半分）が実際に使っているテクスチャ画素から色を採取する。
// 採れた色をそのまま花びらに使うので、モデルの花と同じ色合いの花びらが散る。
// 影用の暗い色と葉の緑は除外し、うまく採れない場合は fallbackColor の1色に戻る
function sampleFlowerColors(THREE, plantRoot, fallbackColor) {
  const colors = [];
  try {
    const box = new THREE.Box3().setFromObject(plantRoot);
    if (!Number.isFinite(box.max.y)) throw new Error("model not ready");
    const yCut = box.min.y + (box.max.y - box.min.y) * 0.55;
    const imageCache = new Map();
    const meshBox = new THREE.Box3();
    plantRoot.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      meshBox.setFromObject(child);
      if ((meshBox.min.y + meshBox.max.y) / 2 < yCut) return; // 茎・葉・土は見ない
      const uv = child.geometry.getAttribute("uv");
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        const image = material?.map?.image ?? material?.map?.source?.data;
        if (image && image.width && uv) {
          let data = imageCache.get(image);
          if (!data) {
            const canvas = document.createElement("canvas");
            const w = (canvas.width = Math.min(128, image.width));
            const h = (canvas.height = Math.min(128, image.height));
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(image, 0, 0, w, h);
            data = { pixels: ctx.getImageData(0, 0, w, h).data, w, h };
            imageCache.set(image, data);
          }
          // このメッシュが実際に使っているUV座標の画素だけを読む
          for (let i = 0; i < 48; i++) {
            const idx = Math.floor(Math.random() * uv.count);
            const u = Math.abs(uv.getX(idx)) % 1;
            let v = Math.abs(uv.getY(idx)) % 1;
            if (material.map.flipY) v = 1 - v;
            const p = (Math.min(data.h - 1, Math.floor(v * data.h)) * data.w + Math.min(data.w - 1, Math.floor(u * data.w))) * 4;
            colors.push(new THREE.Color(data.pixels[p] / 255, data.pixels[p + 1] / 255, data.pixels[p + 2] / 255));
          }
        } else if (material?.color) {
          colors.push(material.color.clone());
        }
      });
    });
  } catch (error) {
    // fallbackへ
  }
  const hsl = { h: 0, s: 0, l: 0 };
  const filtered = colors.filter((color) => {
    color.getHSL(hsl);
    if (hsl.l < 0.22) return false; // 影・輪郭の暗い色
    if (hsl.h > 0.2 && hsl.h < 0.45 && hsl.s > 0.25) return false; // 葉の緑
    return true;
  });
  if (filtered.length < 6) return [new THREE.Color(fallbackColor)];
  // 散る花びらは空の光を受けるので、ほんの少し明るめに寄せる
  return filtered.map((color) => color.lerp(new THREE.Color("#ffffff"), 0.1));
}

// 花びら型のジオメトリ: 付け根が細く先端が丸い輪郭を、中央がすぼむお椀状に反らせる
function createPetalGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.038, 0.008, 0.05, 0.05, 0.012, 0.085);
  shape.bezierCurveTo(0.006, 0.09, -0.006, 0.09, -0.012, 0.085);
  shape.bezierCurveTo(-0.05, 0.05, -0.038, 0.008, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 10);
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // 縁が持ち上がり中央が窪む反り + 先端をわずかに巻き上げる
    pos.setZ(i, x * x * 4.0 + Math.max(0, y - 0.055) * 0.35);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// 花びらの舞い散り: 開花済み(Stage6)の植物から時々花びらが落ち、水面に届くと波紋が立つ
// floorLocalY: 水面（または地面）のグループ座標での高さ。着水後は少し浮かんでから消える
// getSpawnArea: 花冠の上端と横幅の半分（グループ座標）を返す関数。植物の実寸から散らすために使う
// onWater: trueなら水面に浮かんで漂う。false（陸）なら地面を転がりながら溶けるように消える
// getColors: 花のテクスチャから採取した色候補を返す関数。散るたびに1枚ずつ選び直す
function createPetalSystem(THREE, color, onLand, floorLocalY = -0.52, getSpawnArea = null, onWater = true, getColors = null) {
  const group = new THREE.Group();
  const petals = [];
  const baseColor = new THREE.Color(color);
  const geometry = createPetalGeometry(THREE);
  for (let i = 0; i < 8; i++) {
    // 1枚ごとに大きさを少し変えて、同じ花から散った自然なばらつきを出す
    const material = new THREE.MeshBasicMaterial({
      color: baseColor.clone(),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false // 植物の形・大きさによらず、絶対に隠れない
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.renderOrder = 4; // 最後に描く = 常に手前に見える
    mesh.scale.setScalar(0.8 + Math.random() * 0.5);
    group.add(mesh);
    petals.push({ mesh, active: false, floatingUntil: 0, phase: Math.random() * Math.PI * 2, spin: 0, fallSpeed: 0 });
  }

  let nextSpawnAt = 3000 + Math.random() * 4000;
  let lastShedId = petalShedRequestId;

  const spawnOne = () => {
    const idle = petals.find((petal) => !petal.active);
    if (!idle) return;
    idle.active = true;
    idle.floatingUntil = 0;
    idle.mesh.visible = true;
    idle.mesh.material.opacity = 0.9;
    // 花のテクスチャから採った色候補の中から、散るたびに1色選ぶ（白へのばらつきも少し）
    const palette = getColors ? getColors() : null;
    if (palette && palette.length) {
      idle.mesh.material.color
        .copy(palette[Math.floor(Math.random() * palette.length)])
        .lerp(new THREE.Color("#ffffff"), Math.random() * 0.15);
    }
    // 植物より必ず手前（カメラ側 +Z）に、花冠の上端付近・植物の横幅いっぱいから落とす
    const area = getSpawnArea ? getSpawnArea() : null;
    const crown = area ? area.top : 0.33;
    const half = area ? area.half : 0.35;
    const front = area ? area.front : 0.25;
    const top = crown + 0.05;
    const bottom = Math.max(floorLocalY + 0.3, crown - 0.35);
    const y = bottom + Math.random() * Math.max(0.08, top - bottom);
    idle.mesh.position.set((Math.random() * 2 - 1) * half, y, front + Math.random() * 0.25);
    idle.phase = Math.random() * Math.PI * 2;
    idle.spin = (Math.random() - 0.5) * 2.4;
    idle.driftX = (Math.random() - 0.5) * 0.0036; // 落下中に風で横へ流される速さ
    idle.fallSpeed = 0.0032 + Math.random() * 0.0022;
  };

  const update = (t, nowMs) => {
    if (lastShedId !== petalShedRequestId) {
      lastShedId = petalShedRequestId;
      // タップ・デバッグ要求: ひとまとまり散らす
      for (let i = 0; i < petalShedRequestCount; i++) spawnOne();
      nextSpawnAt = nowMs + 3000 + Math.random() * 4000;
    }
    if (nowMs >= nextSpawnAt) {
      // ときどき2〜3枚が続けて散る
      const count = Math.random() < 0.35 ? 2 + (Math.random() < 0.3 ? 1 : 0) : 1;
      for (let i = 0; i < count; i++) spawnOne();
      nextSpawnAt = nowMs + 3500 + Math.random() * 5500;
    }
    petals.forEach((petal) => {
      if (!petal.active) return;
      const mesh = petal.mesh;
      if (petal.floatingUntil > 0) {
        if (onWater) {
          // 着水後: 波に揺られてゆっくり漂い、溶けるように消える
          // （完全に水平まで寝かせると低いカメラから見えなくなるので、少し起こした角度で止める）
          mesh.position.x += Math.sin(t * 0.7 + petal.phase) * 0.0009;
          mesh.rotation.x += (-1.25 - mesh.rotation.x) * 0.08;
          mesh.rotation.z += (0 - mesh.rotation.z) * 0.08;
        } else {
          // 陸: 斜面を転がるようにゆっくり沈み続けながら溶けるように消える
          mesh.position.y -= petal.fallSpeed * 0.4;
          mesh.position.x += (petal.driftX || 0) * 0.6 + Math.sin(t * 1.1 + petal.phase) * 0.0008;
        }
        const remain = petal.floatingUntil - nowMs;
        if (remain < 900) mesh.material.opacity = Math.max(0, 0.9 * (remain / 900));
        if (remain <= 0) {
          petal.active = false;
          mesh.visible = false;
        }
        return;
      }
      mesh.position.y -= petal.fallSpeed;
      mesh.position.x += (petal.driftX || 0) + Math.sin(t * 2.2 + petal.phase) * 0.0028;
      // ひらひら: 左右に大きく揺れ、面がゆっくり翻る
      mesh.rotation.z = Math.sin(t * 1.6 + petal.phase) * 1.2;
      mesh.rotation.x = Math.sin(t * 1.1 + petal.phase * 1.7) * 1.1 + 0.35;
      mesh.rotation.y = t * petal.spin + petal.phase;
      if (mesh.position.y <= floorLocalY) {
        mesh.position.y = floorLocalY;
        petal.floatingUntil = onWater
          ? nowMs + 2200 + Math.random() * 1600
          : nowMs + 1100 + Math.random() * 500;
        if (onLand) onLand(mesh.position.x, mesh.position.z);
      }
    });
  };

  const dispose = () => {
    geometry.dispose();
    petals.forEach((petal) => petal.mesh.material.dispose());
  };

  return { group, update, dispose };
}

// ---- テーマ散り用のスプライトテクスチャ（Canvasで生成、白で描いて色はマテリアルで着ける） ----

// やわらかい光の玉（中心が明るく、縁へ溶ける）
let glowTextureCache = null;
function getGlowTexture(THREE) {
  if (glowTextureCache) return glowTextureCache;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  glowTextureCache = new THREE.CanvasTexture(canvas);
  return glowTextureCache;
}

// 十字の光条つきの星（またたく星屑用）
let starTextureCache = null;
function getStarTexture(THREE) {
  if (starTextureCache) return starTextureCache;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext("2d");
  const core = ctx.createRadialGradient(48, 48, 0, 48, 48, 18);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 96, 96);
  ctx.globalCompositeOperation = "lighter";
  for (const rotate of [0, Math.PI / 2]) {
    ctx.save();
    ctx.translate(48, 48);
    ctx.rotate(rotate);
    const flare = ctx.createLinearGradient(-46, 0, 46, 0);
    flare.addColorStop(0, "rgba(255,255,255,0)");
    flare.addColorStop(0.5, "rgba(255,255,255,0.95)");
    flare.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(-46, -2.4, 92, 4.8);
    ctx.restore();
  }
  starTextureCache = new THREE.CanvasTexture(canvas);
  return starTextureCache;
}

// 金箔片の陰影（斜めに走る光の帯。グレースケールで描き、色はマテリアルで乗せる）
let foilTextureCache = null;
function getFoilTexture(THREE) {
  if (foilTextureCache) return foilTextureCache;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 64, 64);
  gradient.addColorStop(0, "#8a8a8a");
  gradient.addColorStop(0.3, "#ffffff");
  gradient.addColorStop(0.48, "#b9b9b9");
  gradient.addColorStop(0.62, "#f2f2f2");
  gradient.addColorStop(0.8, "#7c7c7c");
  gradient.addColorStop(1, "#d9d9d9");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  foilTextureCache = new THREE.CanvasTexture(canvas);
  return foilTextureCache;
}

// かけらの陰影（中心が明るく、縁へ沈む）
let shardTextureCache = null;
function getShardTexture(THREE) {
  if (shardTextureCache) return shardTextureCache;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(26, 26, 4, 32, 32, 40);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.55, "#c9c9c9");
  gradient.addColorStop(1, "#6f6f6f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  shardTextureCache = new THREE.CanvasTexture(canvas);
  return shardTextureCache;
}

// 泡（縁が明るいリング＋左上のハイライト）
let bubbleTextureCache = null;
function getBubbleTexture(THREE) {
  if (bubbleTextureCache) return bubbleTextureCache;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const ring = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  ring.addColorStop(0, "rgba(255,255,255,0.06)");
  ring.addColorStop(0.68, "rgba(255,255,255,0.1)");
  ring.addColorStop(0.85, "rgba(255,255,255,0.95)");
  ring.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = ring;
  ctx.fillRect(0, 0, 64, 64);
  const highlight = ctx.createRadialGradient(22, 20, 0, 22, 20, 7);
  highlight.addColorStop(0, "rgba(255,255,255,0.95)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, 64, 64);
  bubbleTextureCache = new THREE.CanvasTexture(canvas);
  return bubbleTextureCache;
}

// 名画テーマの散り演出: 花びらの代わりに、植物ごとの kind/shape/colors で
// 「立ちのぼる・渦を巻く・滴る・ひらひら落ちる・ふわふわ溶ける」を出し分ける。
// createPetalSystem と同じ間隔・タップ連動（shedPetalsNow）・着地コールバックを持つ
function createShedSystem(THREE, theme, onLand, floorLocalY = -0.52, getSpawnArea = null, onWater = true) {
  const group = new THREE.Group();
  const items = [];
  const palette = theme.colors.map((value) => new THREE.Color(value));
  // 箔・かけらは「物」なのでメッシュ（通常合成）、光・星・泡・雫は発光スプライト（加算合成）
  const isMeshShape = theme.shape === "foil" || theme.shape === "shard";
  const geometry = isMeshShape
    ? (theme.shape === "foil" ? new THREE.PlaneGeometry(0.055, 0.055) : new THREE.CircleGeometry(0.05, 3))
    : null;
  const texture = theme.shape === "star"
    ? getStarTexture(THREE)
    : theme.shape === "bubble"
      ? getBubbleTexture(THREE)
      : getGlowTexture(THREE);
  // 花が主役、演出は引き立て役。サイズ・明るさは控えめに保つ
  const baseScale = { mote: 0.09, star: 0.14, bubble: 0.075, droplet: 0.07 }[theme.shape] ?? 0.09;
  const baseOpacity = isMeshShape ? 0.92 : 0.82;
  for (let i = 0; i < 32; i++) {
    let node;
    if (isMeshShape) {
      const material = new THREE.MeshBasicMaterial({
        // 単色のベタ塗りは安く見えるので、陰影テクスチャに色を乗せて質感を出す
        map: theme.shape === "foil" ? getFoilTexture(THREE) : getShardTexture(THREE),
        color: palette[i % palette.length].clone(),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false, // 植物の形・大きさによらず、絶対に隠れない
        blending: THREE.NormalBlending
      });
      node = new THREE.Mesh(geometry, material);
    } else {
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: palette[i % palette.length].clone(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        // 暗い色の粒（墨など）は加算だと消えるので通常合成にする
        blending: theme.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending
      });
      node = new THREE.Sprite(material);
    }
    node.visible = false;
    node.renderOrder = 4; // 最後に描く = 常に手前に見える
    group.add(node);
    items.push({ mesh: node, active: false, phase: Math.random() * Math.PI * 2, size: baseScale });
  }

  // 絶え間ない流れ（数百msごとに1-2粒）+ ときどきどっと舞う（フラリー）
  let nextSpawnAt = 600;
  let nextFlurryAt = 4000 + Math.random() * 5000;
  let lastShedId = petalShedRequestId;

  const spawnOne = (nowMs) => {
    const idle = items.find((item) => !item.active);
    if (!idle) return;
    const area = getSpawnArea ? getSpawnArea() : null;
    const crown = area ? area.top : 0.33;
    const half = area ? area.half : 0.35;
    const front = area ? area.front : 0.25;
    idle.active = true;
    idle.landedAt = 0;
    idle.bornAt = nowMs;
    idle.phase = Math.random() * Math.PI * 2;
    idle.spin = (Math.random() - 0.5) * 2.6;
    idle.size = baseScale * (0.65 + Math.random() * 0.85);
    idle.mesh.visible = true;
    idle.mesh.material.color.copy(palette[Math.floor(Math.random() * palette.length)]);
    if (isMeshShape) {
      idle.mesh.rotation.set(0, 0, 0);
      idle.mesh.scale.setScalar(0.8 + Math.random() * 0.6);
    } else if (theme.shape === "droplet") {
      idle.mesh.scale.set(idle.size * 0.6, idle.size * 1.35, 1);
    } else {
      idle.mesh.scale.set(idle.size, idle.size, 1);
      idle.mesh.material.rotation = Math.random() * Math.PI;
    }
    if (theme.kind === "rise") {
      // 花のまわりから立ちのぼる（花粉・泡・虹色の粒）
      idle.ttl = 2600 + Math.random() * 2200;
      idle.riseSpeed = (theme.slow ? 0.0012 : 0.002) + Math.random() * 0.0012;
      idle.mesh.position.set((Math.random() * 2 - 1) * half * 0.8, crown - 0.5 + Math.random() * 0.45, front * 0.8);
    } else if (theme.kind === "vortex") {
      // 植物のまわりを渦を巻きながら立ちのぼる（叫びの空）
      idle.ttl = 3200 + Math.random() * 2400;
      idle.angle = Math.random() * Math.PI * 2;
      idle.radius = Math.max(0.3, half * (0.55 + Math.random() * 0.55));
      idle.angSpeed = 1.6 + Math.random() * 1.2;
      idle.riseSpeed = 0.0011 + Math.random() * 0.0009;
      idle.y = crown - 0.75 + Math.random() * 0.6;
      idle.mesh.position.set(Math.cos(idle.angle) * idle.radius, idle.y, front * 0.6);
    } else if (theme.kind === "droplet") {
      // 花から水面へ滴る（着水で波紋）
      idle.ttl = 6000;
      idle.fallSpeed = 0.0042 + Math.random() * 0.0026;
      idle.driftX = (Math.random() - 0.5) * 0.0022;
      idle.mesh.position.set((Math.random() * 2 - 1) * half * 0.7, crown - 0.15 + Math.random() * 0.2, front + Math.random() * 0.15);
    } else {
      // flutter / floatfall: 花冠のあたりからひらひら・ふわふわ落ちる
      idle.ttl = theme.kind === "floatfall" ? 4200 + Math.random() * 2200 : 12000;
      idle.fallSpeed = (theme.kind === "floatfall" ? 0.0012 : 0.0028) + Math.random() * 0.0016;
      idle.driftX = (Math.random() - 0.5) * 0.0034;
      const top = crown + 0.05;
      const bottom = Math.max(floorLocalY + 0.3, crown - 0.35);
      idle.mesh.position.set(
        (Math.random() * 2 - 1) * half,
        bottom + Math.random() * Math.max(0.08, top - bottom),
        front + Math.random() * 0.25
      );
    }
  };

  const update = (t, nowMs) => {
    if (lastShedId !== petalShedRequestId) {
      lastShedId = petalShedRequestId;
      // タップ演出: どっと舞わせる（見せ場なのでここだけ多め）
      for (let i = 0; i < petalShedRequestCount * 4; i++) spawnOne(nowMs);
      nextSpawnAt = nowMs + 1500 + Math.random() * 1500;
    }
    if (nowMs >= nextSpawnAt) {
      spawnOne(nowMs);
      if (Math.random() < 0.25) spawnOne(nowMs);
      const base = theme.kind === "droplet" ? 1100 : 650;
      nextSpawnAt = nowMs + base + Math.random() * base * 1.2;
    }
    if (nowMs >= nextFlurryAt) {
      // ときどき、ひとしきり舞う
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) spawnOne(nowMs);
      nextFlurryAt = nowMs + 10000 + Math.random() * 9000;
    }
    items.forEach((item) => {
      if (!item.active) return;
      const mesh = item.mesh;
      const age = nowMs - item.bornAt;
      const remain = item.ttl - age;
      if (remain <= 0) {
        item.active = false;
        mesh.visible = false;
        return;
      }
      // 出現300ms・寿命の最後800msでなめらかに現れて消える
      let alpha = Math.min(1, age / 300) * Math.min(1, remain / 800);
      if (theme.kind === "rise") {
        // 蛍の飛び方（SHIZEN参考）: 速度に微小な乱れ＋減衰でふらふらと生き物らしく
        item.vx = (item.vx || 0) + (Math.random() - 0.5) * 0.0005;
        item.vx *= 0.97;
        mesh.position.y += item.riseSpeed;
        mesh.position.x += item.vx + Math.sin(t * 1.3 + item.phase) * 0.0009;
        if (theme.shape === "bubble") {
          // 泡は浮かびながらわずかにふくらむ
          const grow = item.size * (1 + age * 0.00008);
          mesh.scale.set(grow, grow, 1);
        }
      } else if (theme.kind === "vortex") {
        item.angle += 0.016 * item.angSpeed;
        item.y += item.riseSpeed;
        mesh.position.x = Math.cos(item.angle) * item.radius;
        mesh.position.z = 0.3 + Math.sin(item.angle) * item.radius * 0.3;
        mesh.position.y = item.y;
        if (mesh.isSprite) {
          mesh.material.rotation = t * item.spin + item.phase;
        } else {
          mesh.rotation.z = t * item.spin * 2 + item.phase;
        }
      } else if (theme.kind === "droplet") {
        item.fallSpeed += 0.00008; // 重力で加速
        mesh.position.y -= item.fallSpeed;
        mesh.position.x += item.driftX;
        if (mesh.position.y <= floorLocalY) {
          mesh.position.y = floorLocalY;
          if (!item.landedAt) {
            item.landedAt = nowMs;
            if (onLand) onLand(mesh.position.x, mesh.position.z);
          }
          alpha *= Math.max(0, 1 - (nowMs - item.landedAt) / 260);
          if (nowMs - item.landedAt > 260) {
            item.active = false;
            mesh.visible = false;
            return;
          }
        }
      } else {
        // flutter / floatfall
        const floaty = theme.kind === "floatfall";
        mesh.position.y -= item.fallSpeed * (floaty ? 0.7 + 0.3 * Math.sin(t + item.phase) : 1);
        mesh.position.x += item.driftX + Math.sin(t * 2.0 + item.phase) * (floaty ? 0.0012 : 0.0026);
        if (floaty && mesh.isSprite) {
          // 星屑は光条ごとゆっくり回る
          mesh.material.rotation += 0.003 * (item.spin > 0 ? 1 : -1);
        }
        if (!floaty) {
          // 箔・かけらは面を翻しながら落ちる
          mesh.rotation.z = Math.sin(t * 1.7 + item.phase) * 1.3;
          mesh.rotation.x = Math.sin(t * 1.2 + item.phase * 1.7) * 1.15 + 0.3;
          mesh.rotation.y = t * item.spin + item.phase;
        }
        if (mesh.position.y <= floorLocalY) {
          mesh.position.y = floorLocalY;
          if (!item.landedAt) {
            item.landedAt = nowMs;
            if (onWater && onLand) onLand(mesh.position.x, mesh.position.z);
          }
          const meltMs = onWater ? 1800 : 900;
          alpha *= Math.max(0, 1 - (nowMs - item.landedAt) / meltMs);
          if (nowMs - item.landedAt > meltMs) {
            item.active = false;
            mesh.visible = false;
            return;
          }
        }
      }
      // またたき: sinの3乗で「ほぼ静かに、一瞬だけ強く光る」（SHIZENの蛍参考）
      if (theme.twinkle) alpha *= 0.4 + 0.6 * Math.pow(Math.max(Math.sin(t * 2.6 + item.phase * 3), 0), 3);
      // 金箔の照り返し: 高次のべきで鋭いキャッチライトに
      if (theme.glint) alpha *= 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(t * 3.5 + item.phase * 5)), 4);
      mesh.material.opacity = baseOpacity * alpha;
    });
  };

  const dispose = () => {
    if (geometry) geometry.dispose();
    items.forEach((item) => item.mesh.material.dispose());
  };

  return { group, update, dispose };
}

function collectGlowMaterials(root) {
  const materials = [];
  root.traverse((child) => {
    if (!child.isMesh) return;
    (Array.isArray(child.material) ? child.material : [child.material]).forEach((material) => {
      if (material && material.emissive !== undefined) materials.push(material);
    });
  });
  return materials;
}

// plantRoot: createTunedModelGroup で作られた植物のルート（position のみ設定済み）
// anchor: 植物の配置座標（粒子グループの基準位置）
export function createPlantEffects(THREE, plantDefinition, plantRoot, anchor = {}, stage = 1) {
  const config = PLANT_EFFECTS[plantDefinition?.id];
  if (!config) return null;

  const group = new THREE.Group();
  group.position.set(anchor.x || 0, (anchor.y || 0) + 0.55, anchor.z || 0);

  const baseY = plantRoot.position.y;
  const baseX = plantRoot.position.x;
  const seed = Math.random() * 100;

  // 水面の反射（上下反転クローン）も本体と一緒に動かす
  const reflectionRoot = anchor.reflection || null;
  const reflectionBaseY = reflectionRoot ? reflectionRoot.position.y : 0;

  // 粒子（成長後半のみ・種の段階では出さない）
  let particleSystem = null;
  if (config.particles && stage >= 4) {
    particleSystem = createParticles(THREE, config.particles, stage);
    group.add(particleSystem.points);
  }

  // 花びらの舞い散り（開花済みのみ・色はその植物の花に合わせた指定色）
  let petalSystem = null;
  const petalColor = config.petal ?? plantDefinition?.palette?.[2];
  if (stage >= 6 && petalColor) {
    // 水面のワールド高さ（anchor.waterY）をグループ座標に直す
    // 陸（水面なし）の場合、花びらはカメラ側＝土の山の下り斜面側に落ちるので、
    // 植物の根元よりだいぶ下（斜面の裾のあたり）まで落としてから消す
    const onWater = Number.isFinite(anchor.waterY);
    const floorLocalY = onWater ? anchor.waterY - group.position.y + 0.01 : -1.0;
    // 花冠の上端と植物の横幅（グループ座標）。初回の散布時に実測して覚える
    // （根元からの相対値で測るので、シーン側の配置ずれに影響されない）
    let spawnArea = null;
    const getSpawnArea = () => {
      if (!spawnArea) {
        const box = new THREE.Box3().setFromObject(plantRoot);
        const rootWorld = plantRoot.getWorldPosition(new THREE.Vector3());
        const height = box.max.y - rootWorld.y;
        const halfWidth = (box.max.x - box.min.x) / 2;
        const frontEdge = box.max.z - rootWorld.z;
        spawnArea = {
          top: Number.isFinite(height) ? height - 0.55 : 0.33,
          // 花の幅より少し外側まで（風に流された分）広げる
          half: Number.isFinite(halfWidth) ? Math.min(1.8, Math.max(0.55, halfWidth * 1.15)) : 0.55,
          // 葉がどれだけ手前に伸びていても、必ずその外側（カメラ側）から落とす
          front: Number.isFinite(frontEdge) ? Math.min(1.2, Math.max(0.25, frontEdge + 0.06)) : 0.25
        };
      }
      return spawnArea;
    };
    // 花のテクスチャからの色採取は重いので、初回の散布時に一度だけ行って使い回す
    let petalPalette = null;
    const getPetalColors = () => {
      if (!petalPalette) petalPalette = sampleFlowerColors(THREE, plantRoot, petalColor);
      return petalPalette;
    };
    const onLandCallback = (localX, localZ) => {
      if (anchor.onPetalLand) {
        anchor.onPetalLand(group.position.x + localX, group.position.z + localZ);
      }
    };
    // 名画テーマの散り（案1）。テーマ未定義の植物は従来の花びら散りに戻る
    petalSystem = config.shed
      ? createShedSystem(THREE, config.shed, onLandCallback, floorLocalY, getSpawnArea, onWater)
      : createPetalSystem(THREE, petalColor, onLandCallback, floorLocalY, getSpawnArea, onWater, getPetalColors);
    group.add(petalSystem.group);
  }

  // 発光（素材の emissive を脈動させる）
  let glowMaterials = [];
  if (config.glow) {
    glowMaterials = collectGlowMaterials(plantRoot);
    const glowColor = new THREE.Color(config.glow.color);
    glowMaterials.forEach((material) => {
      if (material.emissive.getHex() === 0) material.emissive = glowColor.clone();
    });
  }

  // 部分的な揺れ（根元固定・先端ほどしなる）/ うねる歪み
  // 反射にも同じ変形を仕込む。反射グループはY軸反転で描かれているため、
  // 同じ時間・振幅を渡すだけで鏡写しに同期する
  const usesBend = Boolean(config.sway || config.warp);
  const bendTargets = usesBend ? attachBendSway(THREE, plantRoot) : [];
  if (usesBend && reflectionRoot) {
    bendTargets.push(...attachBendSway(THREE, reflectionRoot));
  }

  // グリッチ用の状態
  let nextGlitchAt = 1500 + Math.random() * 3000;
  let glitchUntil = -1;

  const update = (nowMs) => {
    const t = nowMs / 1000;
    const wind = windLevel;

    if (config.sway && bendTargets.length) {
      const strength = config.sway * (0.35 + wind * 1.4);
      bendTargets.forEach((target) => {
        target.uniforms.uBendTime.value = t * (0.9 + wind * 0.8) + seed;
        target.uniforms.uBendAmp.value = target.range * 0.06 * strength;
      });
    }
    if (config.warp && bendTargets.length) {
      // ぐにゃりとした遅いうねり: 高い周波数で波が体を通り抜けていく
      bendTargets.forEach((target) => {
        target.uniforms.uBendTime.value = t * 0.8 + seed;
        target.uniforms.uBendAmp.value = target.range * 0.1 * config.warp * (0.5 + wind * 0.8);
        target.uniforms.uBendFreq.value = 4.5;
      });
    }
    if (config.tremble) {
      plantRoot.rotation.z = (Math.sin(t * 13.3) * 0.006 + Math.sin(t * 31.7 + seed) * 0.004) * config.tremble;
      plantRoot.rotation.x = Math.sin(t * 17.9 + seed) * 0.004 * config.tremble;
    }
    if (config.bob) {
      const lift = Math.sin(t * 0.9 + seed) * 0.035 * config.bob;
      const tilt = Math.sin(t * 0.7 + seed) * 0.01 * config.bob;
      plantRoot.position.y = baseY + lift;
      plantRoot.rotation.z = tilt;
      if (reflectionRoot) {
        // 鏡写し: 本体が浮くと反射は沈む（縦圧縮率に合わせた量だけ）
        const squashRatio = Math.abs(reflectionRoot.scale.y) || 1;
        reflectionRoot.position.y = reflectionBaseY - lift * squashRatio;
        reflectionRoot.rotation.z = -tilt;
      }
    }
    if (config.glitch) {
      if (nowMs >= nextGlitchAt) {
        glitchUntil = nowMs + 90 + Math.random() * 80;
        nextGlitchAt = nowMs + 1800 + Math.random() * 3500;
      }
      if (nowMs < glitchUntil) {
        plantRoot.position.x = baseX + (Math.random() - 0.5) * 0.06 * config.glitch;
      } else {
        plantRoot.position.x = baseX;
      }
    }
    if (config.glow && glowMaterials.length) {
      const stageRatio = 0.35 + Math.min(1, stage / 6) * 0.65;
      const pulse = (Math.sin(t * config.glow.speed + seed) * 0.5 + 0.5) * config.glow.amp * stageRatio;
      glowMaterials.forEach((material) => {
        material.emissiveIntensity = pulse;
      });
    }
    if (particleSystem) particleSystem.update(t + seed);
    if (petalSystem) petalSystem.update(t + seed, nowMs);
  };

  const dispose = () => {
    if (particleSystem) particleSystem.dispose();
    if (petalSystem) petalSystem.dispose();
  };

  return { group, update, dispose };
}
