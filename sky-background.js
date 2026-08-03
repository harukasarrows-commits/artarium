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
uniform float uMoonPhase;
uniform float uSeasonId;    // 0=春 1=夏 2=秋 3=冬（季節の星座の切り替え）
uniform vec3 uShoreTint;    // 対岸の季節色（春霞・夏の深緑・秋の茜・冬の雪化粧）
uniform float uShoreTintAmt;

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

  // 対岸の丘なみ: 遠景の陸地のシルエット。湖を「遠くの湖」にし、
  // 土の丘の庭が「水に浮く島」に見えないようにする（霧の日は霞に呑まれる）
  // 稜線は二重スケール: なだらかな丘なみ + 木立の細かい起伏
  float shoreRidge = 0.012
    + 0.05 * fbm(vec2(p.x * 0.9 + 11.0, 2.0))
    + 0.012 * fbm(vec2(p.x * 7.0 + 3.0, 8.0));
  vec3 shoreCol = mix(uZenith, uHorizon, 0.35) * 0.42;
  // 対岸の季節色: 春霞・夏の深緑・秋の茜・冬の雪化粧（強さはJS側で昼夜も加味）
  shoreCol = mix(shoreCol, uShoreTint, uShoreTintAmt);
  float shoreVisibility = 1.0 - uFog * 0.75;

  vec3 col;
  if (uv.y >= HORIZON) {
    // --- 地平線から上: 空 ---
    col = mix(uHorizon, uZenith, pow(skyT, 1.15));

    // 太陽（夜は月に置き換わるため暈をフェードアウト）
    float sd = length(p - sp);
    float nightMix = smoothstep(0.25, 0.75, uStars);
    col += uSunCol * (exp(-sd * sd * 900.0) * 0.6 + exp(-sd * 5.0) * 0.12) * (1.0 - nightMix);

    // 星（夜のみ・地平線近くは薄く）。
    // セル内のランダム位置に丸い光点を置く（セルごと光る四角い星を避ける）
    if (uStars > 0.001) {
      float horizonFade = smoothstep(0.08, 0.55, skyT);
      vec2 grid = vec2(110.0, 80.0);
      vec2 cell = floor(p * grid);
      vec2 f = fract(p * grid);
      float h = hash21(cell);
      vec2 starPos = vec2(hash21(cell + 3.1), hash21(cell + 5.7)) * 0.8 + 0.1;
      float d = length(f - starPos);
      // 色温度のばらつき: 大半は青白、まれに琥珀色の星
      float hue = hash21(cell + 9.3);
      vec3 starCol = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.9, 0.7), smoothstep(0.72, 0.95, hue));
      // 淡い星屑（多数・星ごとに違う速さでゆっくり瞬く）
      float faint = step(0.955, h) * exp(-d * d * 300.0);
      float twinkleFaint = 0.7 + 0.3 * sin(uTime * (0.8 + h * 1.5) + h * 40.0);
      col += starCol * faint * twinkleFaint * 0.5 * uStars * horizonFade;
      // ひときわ明るい星（まれ・大きめ・十字の煌めき・深い瞬き）
      float bright = step(0.9915, h);
      if (bright > 0.0) {
        float core = exp(-d * d * 120.0);
        float spikes = (exp(-abs(f.x - starPos.x) * 34.0) + exp(-abs(f.y - starPos.y) * 34.0)) * exp(-d * 3.5) * 0.35;
        float twinkleBright = 0.55 + 0.45 * sin(uTime * (1.2 + h * 2.0) + h * 60.0);
        col += starCol * (core + spikes) * twinkleBright * 1.1 * uStars * horizonFade;
      }
      // 天の川: 深夜・快晴のときだけ浮かぶ光の帯（雲・薄明で消える。2026-08-03 強化）。
      // 淡い雲状のむら + 暗黒帯 + 帯の中の微細な星粒で構成する。
      // pow(負値, 2.0) はGLSLで未定義（SafariでNaN化しうる）ため、乗算で二乗する
      float deepNight = smoothstep(0.5, 0.9, uStars); // 21時ごろから見え始め、深夜に濃くなる
      float clearSky = 1.0 - smoothstep(0.12, 0.45, uCloudAmount);
      float mwOn = deepNight * clearSky;
      if (mwOn > 0.004) {
        float bandDist = dot(p - vec2(0.15, 0.9), normalize(vec2(0.55, 1.0)));
        float band = exp(-bandDist * bandDist * 16.0);
        float wisps = fbm(p * 5.0 + 3.0) * 0.65 + fbm(p * 11.0 - 2.0) * 0.35;
        float darkLane = smoothstep(0.3, 0.72, fbm(p * 7.5 + 9.0));
        col += vec3(0.7, 0.78, 0.95) * band * wisps * (0.5 + 0.5 * darkLane) * 0.14 * mwOn * horizonFade;
        // 帯の中の星粒（既存の星より細かく淡い）
        float grain = step(0.986, hash21(cell + 12.7));
        col += vec3(0.85, 0.9, 1.0) * band * grain * exp(-d * d * 220.0) * 0.45 * mwOn * horizonFade;

        // 季節の星座: 深夜の快晴時、季節ごとのひと組が浮かぶ（2026-08-03）。
        // 位置は画面上部の空き（月と重なりにくい左上寄り）。座標は縦横比補正済み
        vec2 cA = vec2(0.3 * ar, 0.68);
        float cs = 0.0;
        float csGlow = 0.0;
        vec2 q;
        if (uSeasonId < 0.5) {
          // 春: 北斗七星（柄杓）
          q = p - (cA + vec2(-0.105, 0.055)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(-0.066, 0.038)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(-0.03, 0.031)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(0.0, 0.015)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(0.045, 0.02)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(0.055, -0.026)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(0.006, -0.03)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
        } else if (uSeasonId < 1.5) {
          // 夏: 夏の大三角（ベガ・デネブ・アルタイル）
          q = p - (cA + vec2(-0.06, 0.07)); cs += exp(-dot(q, q) * 18000.0) * 1.25; csGlow += exp(-dot(q, q) * 2200.0) * 1.2;
          q = p - (cA + vec2(0.075, 0.05)); cs += exp(-dot(q, q) * 20000.0) * 0.95; csGlow += exp(-dot(q, q) * 2400.0);
          q = p - (cA + vec2(0.005, -0.078)); cs += exp(-dot(q, q) * 19000.0) * 1.1; csGlow += exp(-dot(q, q) * 2300.0);
        } else if (uSeasonId < 2.5) {
          // 秋: カシオペヤ座（W字）
          q = p - (cA + vec2(-0.082, 0.012)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(-0.04, 0.048)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(0.0, 0.004)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(0.04, 0.052)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(0.082, 0.02)); cs += exp(-dot(q, q) * 22000.0); csGlow += exp(-dot(q, q) * 2600.0);
        } else {
          // 冬: オリオン座（肩2・三つ星・足2）
          q = p - (cA + vec2(-0.055, 0.078)); cs += exp(-dot(q, q) * 20000.0) * 1.05; csGlow += exp(-dot(q, q) * 2400.0);
          q = p - (cA + vec2(0.056, 0.085)); cs += exp(-dot(q, q) * 22000.0) * 0.9; csGlow += exp(-dot(q, q) * 2600.0);
          q = p - (cA + vec2(-0.02, 0.006)); cs += exp(-dot(q, q) * 24000.0) * 0.85; csGlow += exp(-dot(q, q) * 2800.0);
          q = p - (cA + vec2(0.0, 0.0)); cs += exp(-dot(q, q) * 24000.0) * 0.85; csGlow += exp(-dot(q, q) * 2800.0);
          q = p - (cA + vec2(0.02, -0.006)); cs += exp(-dot(q, q) * 24000.0) * 0.85; csGlow += exp(-dot(q, q) * 2800.0);
          q = p - (cA + vec2(-0.05, -0.082)); cs += exp(-dot(q, q) * 20000.0) * 1.15; csGlow += exp(-dot(q, q) * 2400.0);
          q = p - (cA + vec2(0.052, -0.074)); cs += exp(-dot(q, q) * 22000.0) * 0.9; csGlow += exp(-dot(q, q) * 2600.0);
        }
        float csTwinkle = 0.82 + 0.18 * sin(uTime * 0.9 + uSeasonId * 7.0);
        col += vec3(0.95, 0.97, 1.0) * (cs * 1.05 + csGlow * 0.2) * csTwinkle * mwOn * horizonFade;
      }
    }

    // 月: 夜、今日の実際の月齢の形で昇る（影の円をずらして欠けを作る古典手法）
    // skyT座標は縦に伸びて円がつぶれるため、等方（画面高さ基準）の座標で描く
    if (nightMix > 0.01) {
      vec2 mpos = vec2(sp.x, HORIZON + sp.y * (1.0 - HORIZON));
      vec2 mq = vec2(p.x, uv.y);
      float md = length(mq - mpos);
      float moonR = 0.04;
      float illum = (1.0 - cos(uMoonPhase * 6.2831853)) * 0.5;
      float disc = 1.0 - smoothstep(moonR * 0.88, moonR, md);
      // 球面の法線と光の向きから明暗を出す（半月の欠け際がまっすぐになる正攻法）
      vec2 nxy = (mq - mpos) / moonR;
      float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
      float phaseAngle = uMoonPhase * 6.2831853;
      vec3 moonLight = vec3(sin(phaseAngle), 0.0, -cos(phaseAngle));
      float litF = smoothstep(-0.02, 0.16, dot(vec3(nxy, nz), moonLight));
      // 月の海: 表面のまだら
      float maria = fbm((mq - mpos) * 70.0 + 7.0);
      vec3 moonCol = vec3(0.93, 0.92, 0.86) * (0.76 + 0.24 * maria);
      col = mix(col, moonCol, disc * litF * nightMix);
      // 地球照: 影の側もごくかすかに丸みが見える
      col = mix(col, moonCol * 0.32, disc * (1.0 - litF) * 0.14 * nightMix);
      col += vec3(0.85, 0.88, 0.95) * exp(-md * 7.0) * (0.04 + 0.16 * illum) * nightMix;
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

    // 対岸の丘なみ（太陽・星・雲より手前のシルエット）。麓ほど霞に溶ける
    float shoreH = uv.y - HORIZON;
    float shoreMask = (1.0 - smoothstep(shoreRidge - 0.01, shoreRidge, shoreH)) * shoreVisibility;
    vec3 hazyShore = mix(shoreCol, uHorizon * 0.85, smoothstep(0.03, 0.0, shoreH));
    col = mix(col, hazyShore, shoreMask * 0.85);

    // 対岸の灯り: 夜、丘の麓に遠い家々の灯がぽつぽつとともる
    // （p.x と uv.y はどちらも「画面高さ」単位なので、そのまま等方の距離が取れる）
    float lightsOn = smoothstep(0.25, 0.7, uStars) * shoreVisibility;
    if (lightsOn > 0.01 && shoreH < shoreRidge) {
      float cellX = floor(p.x * 46.0);
      float lh = hash21(vec2(cellX, 4.7));
      if (lh > 0.76) {
        float lx = (cellX + 0.25 + 0.5 * hash21(vec2(cellX, 9.1))) / 46.0;
        float ly = shoreRidge * (0.12 + 0.35 * hash21(vec2(cellX, 6.3)));
        vec2 dl = vec2(p.x - lx, shoreH - ly);
        float g2 = dot(dl, dl);
        float flicker = 0.75 + 0.25 * sin(uTime * (0.6 + lh) + lh * 30.0);
        float bri = 0.45 + 0.55 * hash21(vec2(cellX, 12.9));
        col += vec3(1.0, 0.72, 0.4) * (exp(-g2 * 90000.0) + exp(-g2 * 11000.0) * 0.3) * flicker * bri * lightsOn;
      }
    }
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

    // 対岸の映り込み（水際にうっすら滲む）
    col = mix(col, shoreCol, exp(-g * 26.0) * 0.4 * shoreVisibility);

    // 対岸の灯りの映り込み（夜・水際に縦ににじむ）
    float lightsOnW = smoothstep(0.25, 0.7, uStars) * shoreVisibility;
    if (lightsOnW > 0.01) {
      float cellXW = floor(p.x * 46.0);
      float lhW = hash21(vec2(cellXW, 4.7));
      if (lhW > 0.76) {
        float lxW = (cellXW + 0.25 + 0.5 * hash21(vec2(cellXW, 9.1))) / 46.0;
        float dxW = p.x - lxW;
        float flickerW = 0.75 + 0.25 * sin(uTime * (0.6 + lhW) + lhW * 30.0);
        float briW = 0.45 + 0.55 * hash21(vec2(cellXW, 12.9));
        col += vec3(1.0, 0.72, 0.4) * exp(-dxW * dxW * 20000.0) * exp(-g * 34.0) * 0.32 * flickerW * briW * lightsOnW;
      }
    }

    // かすかな水平のゆらぎ
    col *= 0.965 + 0.035 * valueNoise(vec2(uv.x * ar * 36.0, uv.y * 130.0 + uTime * 0.06));

    // 稲光と稲妻の水面への映り込み
    col += vec3(0.85, 0.9, 1.0) * uFlash * 0.28;
    if (uBoltAlpha > 0.001) {
      float boltDist = abs(p.x - uBoltX * ar);
      col += vec3(0.95, 0.95, 0.92) * exp(-boltDist * 12.0) * 0.22 * uBoltAlpha * (1.0 - g);
    }
  }

  // 地平線のもや: 大気の霞で遠くの湖を遠景に押しやる
  // （土の丘の庭が「水に浮く島」に見えないための常時レイヤー。霧の日はさらに強く）
  col += uHorizon * (0.16 + uFog * 0.3) * exp(-abs(uv.y - HORIZON) * (14.0 - uFog * 6.0));

  // 霧: 全体を地平線の色へ押し流す
  col = mix(col, uHorizon, uFog * 0.35);

  // 雨・曇り: 彩度と明るさを落とす
  float gloom = clamp(max(uRain * 0.4, uDark), 0.0, 0.6);
  col = mix(col, vec3(dot(col, vec3(0.333))), gloom * 0.5);
  col *= 1.0 - uDark * 0.5;

  // 雪: ふわりと横に揺れながら落ちる丸い粒。2層で奥行きをつける
  if (uSnow > 0.001 && uSnow >= uRain) {
    for (int i = 0; i < 2; i++) {
      float t01 = float(i);
      float colsN = mix(26.0, 44.0, t01);
      float rowsN = mix(15.0, 24.0, t01);
      vec2 rp = vec2(uv.x * ar * colsN + float(i) * 19.0, uv.y * rowsN + uTime * mix(1.1, 0.72, t01));
      float colId = floor(rp.x);
      rp.y += hash21(vec2(colId, 77.3));
      vec2 cellId = vec2(colId, floor(rp.y));
      float h = hash21(cellId + float(i) * 41.7);
      float hasFlake = step(1.0 - uSnow * mix(0.3, 0.45, t01), h);
      if (hasFlake > 0.0) {
        vec2 f = vec2(fract(rp.x), fract(rp.y));
        // 粒はセルの中でゆっくり左右に揺れる
        float cx = 0.3 + 0.4 * hash21(cellId + 9.1) + sin(uTime * (0.7 + h * 0.8) + h * 21.0) * 0.15;
        vec2 fd = vec2(f.x - cx, (f.y - 0.5) * (colsN / rowsN));
        float d2 = dot(fd, fd);
        float flake = exp(-d2 * mix(120.0, 220.0, t01));
        col = mix(col, vec3(0.95, 0.96, 0.98), flake * mix(0.55, 0.32, t01) * (0.5 + 0.5 * uSnow));
      }
    }
  } else if (uRain > 0.001) {
    // 雨: 奥行きの違う3層の細い筋。近い層ほど速く・長く・濃く、遠い層は細かな霧雨。
    // 風でゆっくり斜めが揺れ、本降りほど筋が長く密になる
    // 小雨と本降りの表情差: rainT=0 はまばらな点描がほぼ垂直に落ち、
    // rainT=1 は長い筋が風に強く流される。量だけでなく降り方が変わる
    float rainT = smoothstep(0.15, 0.9, uRain);
    float gust = (0.10 + 0.05 * sin(uTime * 0.37) + 0.04 * sin(uTime * 0.11 + 2.0)) * mix(0.45, 1.7, rainT);
    // 夜はほとんど見えないのが本物（月明かりでうっすら）
    float nightDim = 1.0 - smoothstep(0.25, 0.75, uStars) * 0.6;
    for (int i = 0; i < 3; i++) {
      float t01 = float(i) * 0.5;
      float colsN = mix(70.0, 150.0, t01);
      float rowsN = mix(10.0, 22.0, t01) * mix(1.5, 0.85, rainT);
      float speedN = mix(16.0, 20.0, t01) * mix(0.75, 1.15, rainT);
      float slant = gust * mix(1.25, 0.7, t01);
      vec2 rp = vec2((uv.x * ar + uv.y * slant + float(i) * 0.37) * colsN,
                     uv.y * rowsN + uTime * speedN + float(i) * 9.0);
      // 列ごとに落下の位相をずらす（筋の先端が横一列に揃う格子縞を消す）
      float colId = floor(rp.x);
      rp.y += hash21(vec2(colId, 51.7));
      vec2 cellId = vec2(colId, floor(rp.y));
      float h = hash21(cellId + float(i) * 37.1);
      float hasDrop = step(1.0 - mix(0.035, 0.22, rainT) * mix(1.0, 1.5, t01), h);
      if (hasDrop > 0.0) {
        vec2 f = vec2(fract(rp.x), fract(rp.y));
        float cx = 0.25 + 0.5 * hash21(cellId + 7.3);
        float dx = f.x - cx;
        float thin = exp(-dx * dx * mix(14.0, 8.0, t01) * mix(1.35, 0.9, rainT));
        float tip = smoothstep(0.0, 0.18, f.y) * (1.0 - smoothstep(0.7, 1.0, f.y));
        col = mix(col, vec3(0.72, 0.78, 0.88), thin * tip * mix(0.26, 0.09, t01) * mix(0.5, 1.0, rainT) * nightDim);
      }
    }
    // 雨の靄: 地平線のあたりが白っぽく煙る
    col = mix(col, uHorizon, (0.03 + 0.15 * rainT) * exp(-abs(uv.y - HORIZON) * 3.0));
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

function getSeasonKey(month) {
  if (seasonOverride) return seasonOverride;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function getSeasonModifier(month) {
  return SEASON_MODIFIERS[getSeasonKey(month)];
}

const SEASON_IDS = { spring: 0, summer: 1, autumn: 2, winter: 3 };

// 対岸の季節色（2026-08-03）: 春霞のくすんだ薄紅・夏の深緑・秋の茜・冬の雪化粧。
// amount は昼の最大値。夜は描画側で控えめにする
const SHORE_SEASON_TINTS = {
  spring: { color: [0.5, 0.46, 0.44], amount: 0.28 },
  summer: { color: [0.15, 0.28, 0.19], amount: 0.34 },
  autumn: { color: [0.42, 0.24, 0.13], amount: 0.34 },
  winter: { color: [0.72, 0.76, 0.8], amount: 0.58 }
};

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

// 月齢（0=新月, 0.5=満月）。2000-01-06 18:14 UTC の新月を基準に平均朔望月で概算
let moonPhaseOverride = null;

export function setSkyMoonPhaseOverride(phase) {
  moonPhaseOverride = Number.isFinite(Number(phase)) ? ((Number(phase) % 1) + 1) % 1 : null;
}

function currentMoonPhase() {
  if (moonPhaseOverride !== null) return moonPhaseOverride;
  const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return ((days / 29.53058867) % 1 + 1) % 1;
}

// 渡り鳥が空を渡っている間、環境音側が鳴き交わしを流せるように通知する
let flockListener = null;

export function setSkyFlockListener(fn) {
  flockListener = typeof fn === "function" ? fn : null;
}

// 雨上がりの虹: 雨→晴れの遷移を setSkyWeather で検知し、数分だけ弧を架ける
let rainbowStart = 0;
let rainbowUntil = 0;

export function setSkyWeather(weather) {
  if (!weather) return;
  const prevRain = weatherState.rain;
  weatherState = {
    cloud: Number(weather.cloud) || 0,
    rain: Number(weather.rain) || 0,
    snow: Number(weather.snow) || 0,
    fog: Number(weather.fog) || 0,
    dark: Number(weather.dark) || 0,
    thunder: Number(weather.thunder) || 0
  };
  // 本降りだった雨がほぼ止み、空が明るければ虹が架かる
  if (prevRain > 0.22 && weatherState.rain < 0.08 && weatherState.cloud < 0.8) {
    rainbowStart = performance.now();
    rainbowUntil = rainbowStart + 150000;
  }
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
    glint: gl.getUniformLocation(program, "uGlint"),
    moonPhase: gl.getUniformLocation(program, "uMoonPhase"),
    seasonId: gl.getUniformLocation(program, "uSeasonId"),
    shoreTint: gl.getUniformLocation(program, "uShoreTint"),
    shoreTintAmt: gl.getUniformLocation(program, "uShoreTintAmt")
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
    flock: null,
    nextFlockAt: 0,
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

    // 渡り鳥: 朝と夕方、ときどき数羽の鳥影がゆっくり空を渡る
    const birdLevel = Math.max(
      Math.max(0, 1 - Math.abs(hour - 7) / 2.2),
      Math.max(0, 1 - Math.abs(hour - 17.5) / 2.2)
    );
    if (!fxState.flock && birdLevel > 0.15 && !raining) {
      // 時間帯に入って最初の群れは早めに来る。以降は45〜105秒おき
      if (!fxState.nextFlockAt) fxState.nextFlockAt = nowMs + 4000 + Math.random() * 6000;
      if (nowMs >= fxState.nextFlockAt) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        fxState.flock = {
          dir,
          x: dir > 0 ? -0.08 : 1.08,
          y: 0.2 + Math.random() * 0.2,
          speed: 0.028 + Math.random() * 0.012,
          birds: Array.from({ length: 3 + (Math.random() * 4 | 0) }, (_, i) => ({
            dx: -i * (0.018 + Math.random() * 0.008) * dir,
            dy: (i % 2 ? 1 : -1) * i * 0.008 + (Math.random() - 0.5) * 0.006,
            ph: Math.random() * Math.PI * 2,
            flap: 2.6 + Math.random() * 1.2
          }))
        };
        if (flockListener) flockListener(true);
      }
    } else if (birdLevel <= 0.15) {
      fxState.nextFlockAt = 0;
    }
    if (fxState.flock) {
      const flock = fxState.flock;
      flock.x += flock.dir * flock.speed * dt;
      if (flock.x < -0.25 || flock.x > 1.25) {
        fxState.flock = null;
        fxState.nextFlockAt = nowMs + 45000 + Math.random() * 60000;
        if (flockListener) flockListener(false);
      } else {
        const size = Math.max(3, W * 0.011);
        fx.strokeStyle = "rgba(28, 32, 34, 0.55)";
        fx.lineWidth = Math.max(1, W / 500);
        fx.lineCap = "round";
        flock.birds.forEach((bird) => {
          const bx = (flock.x + bird.dx) * W;
          const by = (flock.y + bird.dy) * H + Math.sin(t * 1.1 + bird.ph) * H * 0.004;
          const wing = Math.sin(t * bird.flap * Math.PI + bird.ph);
          const lift = size * 0.55 * wing;
          fx.beginPath();
          fx.moveTo(bx - size, by - lift);
          fx.quadraticCurveTo(bx - size * 0.3, by + size * 0.18, bx, by);
          fx.quadraticCurveTo(bx + size * 0.3, by + size * 0.18, bx + size, by - lift);
          fx.stroke();
        });
      }
    }

    // 雨上がりの虹: 雨が止んだ直後の明るい空に、うっすら弧が架かる
    if (rainbowUntil > nowMs && starLevel < 0.25 && !raining) {
      const env = Math.min(1, (nowMs - rainbowStart) / 6000) * Math.min(1, (rainbowUntil - nowMs) / 25000);
      if (env > 0.01) {
        const cx = W * 0.5;
        const cy = H * 0.7;
        const R = H * 0.42;
        const bw = Math.max(2, H * 0.0075);
        const hues = [356, 25, 52, 110, 195, 230, 268];
        fx.globalCompositeOperation = "lighter";
        hues.forEach((hue, i) => {
          fx.strokeStyle = `hsla(${hue}, 65%, 62%, ${(0.05 * env).toFixed(3)})`;
          fx.lineWidth = bw;
          fx.beginPath();
          fx.arc(cx, cy, R - i * bw * 0.92, Math.PI, Math.PI * 2);
          fx.stroke();
        });
        fx.globalCompositeOperation = "source-over";
      }
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
    gl.uniform1f(u.moonPhase, currentMoonPhase());
    // 対岸の季節色と季節の星座（星座は深夜・快晴のみシェーダー側で表示判断）
    const seasonKey = getSeasonKey(now.getMonth() + 1);
    const shoreTint = SHORE_SEASON_TINTS[seasonKey];
    const shoreDay = 1 - sky.stars; // 夜は季節色を控えめに（シルエットの闇を保つ）
    gl.uniform1f(u.seasonId, SEASON_IDS[seasonKey]);
    gl.uniform3fv(u.shoreTint, shoreTint.color);
    gl.uniform1f(u.shoreTintAmt, shoreTint.amount * (0.3 + 0.7 * shoreDay));

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
