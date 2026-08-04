import { observeWaterSurfaces, rainBurst, createThreeWater, setAmbientRain } from "./water-surface.js?v=20260710-111";
import { mountSkyBackground, setSkyWeather, getSkySunState, setSkyStepProgress, setSkySeasonOverride, setSkyHourOverride, triggerShootingStar, setSkyFlockListener } from "./sky-background.js?v=20260710-111";
import { initWeatherSync, WEATHER_PRESETS } from "./weather.js?v=20260710-111";
import { createPlantEffects, setPlantWind, setPlantRain, calmPlantEffects, shedPetalsNow } from "./plant-effects.js?v=20260710-111";
import { setSoundEnabled, isSoundEnabled, setRainSoundLevel, setWindSoundLevel, playRipplePlop, setFlockCalls, setAmbienceQuiet } from "./ambient-sound.js?v=20260710-111";
import {
  STAGE_THRESHOLDS,
  COMPLETION_THRESHOLD,
  STEPS_PER_POINT,
  applyStepsToProgress,
  getStage,
  getNextThreshold,
  isPlantComplete,
  trimStepHistory
} from "./core/progress.js?v=20260710-111";
import {
  loadProgressState,
  saveProgressState,
  clearProgressState
} from "./storage/progress-store.js?v=20260710-111";
import { createModalController } from "./ui/modal-controller.js?v=20260710-111";
import { bindSettingsView, renderSettingsView } from "./views/settings-view.js?v=20260710-111";
import { bindCollectionView, renderCodexView, renderCollectionView } from "./views/collection-view.js?v=20260710-111";
import {
  bindHomeStatusView,
  renderCompletionPlaqueView,
  renderHomeProgressView
} from "./views/home-status-view.js?v=20260710-111";

// 渡り鳥が空を渡っている間だけ、遠くの鳴き交わしを流す（目と耳の同期）
setSkyFlockListener(setFlockCalls);

// 図鑑: 各植物の元になった名画の解説（教養コンテンツ）
const CODEX_NOTES = {
  "scream-bloom": {
    source: "エドヴァルド・ムンク《叫び》1893",
    note: "フィヨルドに沈む夕日が空を血の色に染めた夕暮れ、ムンクは「自然を貫く果てしない叫び」を聴いたと日記に残しました。この植物のうねる葉と金色の花は、その波打つ空気そのものを育てます。"
  },
  "sunflower-bloom": {
    source: "フィンセント・ファン・ゴッホ《ひまわり》1888",
    note: "南仏アルルの光を集めて描かれた連作。ゴッホにとってひまわりは「感謝」の象徴でした。歩くたびに深まる黄金の花弁は、画家が塗り重ねた厚いインパストの筆致に倣っています。"
  },
  "wave-crest-bloom": {
    source: "葛飾北斎《神奈川沖浪裏》1831頃",
    note: "『富嶽三十六景』の一枚。爪を立てるような大波が船を呑み、遠くに小さな富士が座る——北斎が70歳を過ぎて到達した一瞬の構図は、海を渡ってモネやゴッホをも驚かせました。波頭の白い飛沫をまとって水面に咲くこの花は、あの止まった波の永遠を育てます。"
  },
  "aquatic-bloom": {
    source: "クロード・モネ《水の庭（日本の橋）》1899",
    note: "モネが自ら設計した庭には日本の太鼓橋が架かり、藤と柳が水面に垂れていました。淡い藤色の花は、画家が愛した日本趣味（ジャポニスム）の記憶を宿しています。"
  },
  "renaissance-smile-bloom": {
    source: "レオナルド・ダ・ヴィンチ《モナ・リザ》1503頃",
    note: "輪郭を煙のようにぼかすスフマート技法が、見る者ごとに違う微笑を生みます。この植物の金褐色の花は、500年間答えを明かさないその静けさを目指して、ゆっくりと開きます。"
  },
  "nocturne-sky-bloom": {
    source: "フィンセント・ファン・ゴッホ《星月夜》1889",
    note: "サン＝レミの療養院の窓から見た夜空を、ゴッホは渦を巻く生き物のように描きました。深い青に金の渦を宿すこの花は、夜にいちばん美しく光ります。"
  },
  "golden-embrace-bloom": {
    source: "グスタフ・クリムト《接吻》1907-08",
    note: "ウィーン分離派の頂点で、クリムトは本物の金箔を画面に貼り込みました。抱擁する二人を包む金のマントのように、この花はきらめく金の粒子をまとって咲きます。"
  },
  "monochrome-fracture-bloom": {
    source: "パブロ・ピカソ《ゲルニカ》1937",
    note: "色を捨てた白と黒だけの大画面が、どんな色彩よりも強く時代の痛みを語りました。モノクロームに咲くこの花は、色がなくても失われない生命の形を示します。"
  },
  "pearl-light-bloom": {
    source: "ヨハネス・フェルメール《真珠の耳飾りの少女》1665頃",
    note: "暗闇の中、少女の耳元で一粒の真珠だけが光を集めます。フェルメールが愛した「一点の光」を、この植物は真珠色の球にたたえて育ちます。"
  },
  "milk-pour-bloom": {
    source: "ヨハネス・フェルメール《牛乳を注ぐ女》1658頃",
    note: "窓辺の台所で、女性が静かにミルクを注ぎ続けています。何気ない日常の一瞬を永遠に変えたその白い流れを、この植物は花びらの白にうけて育ちます。"
  }
};
const DAILY_STEP_GOAL = 8000; // 光の道の演出が最大になる1日の歩数
const AMBIENT_SOUND_STORAGE_KEY = "artarium-ambient-sound";
const STORAGE_KEY = "artarium-mvp-state";
const USER_PROFILE_STORAGE_KEY = "artarium-user-name";
const DEMO_MODEL_STORAGE_KEY = "artarium-demo-model-settings-v2";
const PRODUCTION_MODEL_STORAGE_KEY = "artarium-production-model-settings";
const DEMO_SOIL_STORAGE_KEY = "artarium-demo-soil-assignments";
const PRODUCTION_SOIL_STORAGE_KEY = "artarium-production-soil-assignments";
const PRODUCTION_SYNC_STORAGE_KEY = "artarium-production-sync";
const INSTALL_HINT_KEY = "artarium-install-hinted";
const MOTION_AUTO_KEY = "artarium-motion-auto";
const PLANT_EFFECTS_STORAGE_KEY = "artarium-plant-effects";
// デモパネルで明示的に調整した値だけを覚えておく別枠（焼き込みより優先）。
// 旧作からの自動保存値と違い、ユーザーの意図した操作のみが入るので起動時に勝たせてよい
const TUNED_OVERRIDES_STORAGE_KEY = "artarium-tuned-overrides";

function arePlantEffectsEnabled() {
  return localStorage.getItem(PLANT_EFFECTS_STORAGE_KEY) !== "off";
}
const THREE_CDN_VERSION = "0.164.1";
const ASSET_VERSION = "20260710-111";
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
const modalController = createModalController(document);
const MODEL_STAGE_COUNT = 6;
const MODEL_STAGE_KEYS = Object.freeze(
  Array.from({ length: MODEL_STAGE_COUNT }, (_, index) => String(index + 1))
);
const LEGACY_MODEL_SETTINGS_PLANT_ID = "sunflower-bloom";
const WATER_SURFACE_REFERENCE_PLANT_ID = "wave-crest-bloom";
// 改名した植物の旧ID → 新ID（保存データ移行用。2026-07-10: 波の植物の名前取り違えを解消）
const RENAMED_PLANT_IDS = { "water-lily-bloom": "wave-crest-bloom" };

function migratePlantIdKeys(saved) {
  if (!saved || typeof saved !== "object") return saved;
  for (const [oldId, newId] of Object.entries(RENAMED_PLANT_IDS)) {
    if (saved[oldId] !== undefined && saved[newId] === undefined) {
      saved[newId] = saved[oldId];
      delete saved[oldId];
    }
    if (saved.__activePlantId === oldId) saved.__activePlantId = newId;
  }
  return saved;
}
const DEFAULT_MODEL_SETTINGS = {
  plantScale: 0.82,
  plantX: -0.04,
  plantY: -0.56,
  plantZ: 0.18,
  plantRotX: 0,
  plantRotY: -1.57,
  plantRotZ: 0,
  soilScale: 2.5,
  soilX: 0,
  soilY: -0.62,
  soilZ: -0.08,
  soilRotX: 0,
  soilRotY: 0,
  soilRotZ: 0,
  reflectionOpacity: 0.2,
  shadowOpacity: 1,
  shadowLength: 1,
  shadowZ: 0,
  reflectionY: 0,
  reflectionZ: 0,
  reflectionSquash: 0.2,
  reflectionScale: 0.96,
  waterX: 0,
  waterY: 0,
  waterZ: 0,
  waterScale: 1,
  waterOpacity: 0.5
};
const DEFAULT_WATER_SURFACE_MODEL_SETTINGS = {
  ...DEFAULT_MODEL_SETTINGS,
  plantScale: 0.82,
  plantX: -0.04,
  plantY: -0.46,
  plantZ: 0.2,
  plantRotX: 0,
  plantRotY: -1.57,
  plantRotZ: 0,
  soilScale: 2.95,
  soilX: 0,
  soilY: -0.62,
  soilZ: -0.1,
  soilRotX: 0,
  soilRotY: 0,
  soilRotZ: 0,
  reflectionOpacity: 0.2,
  reflectionY: 0.02,
  reflectionZ: -0.1,
  reflectionSquash: 0.28,
  reflectionScale: 1.05
};
let deferredInstallPrompt = null;
let modelRenderSerial = 0;

// 天気デバッグ（デモ版）: 空文字なら実際の天気、キー指定でプリセット強制
const WEATHER_DEBUG_LABELS = {
  clear: "快晴",
  cloudy: "曇り",
  overcast: "厚曇り",
  fog: "霧",
  rain: "雨",
  downpour: "大雨",
  snow: "雪",
  thunder: "雷雨"
};
let debugWeatherKey = "";
let lastRealWeather = null;
// デモ版の確認用: 季節・光の道の強制値と、PC用マウス視差
let debugSeasonKey = "";
let debugGlintOverride = null;
let debugHourOverride = null;
let demoMouseParallax = false;

// 雨の日は土が湿って暗くなる。シーン再生成をまたいで効くよう、土の材質をWeakRefで追跡する
const soilMaterialRefs = new Set();
let currentSoilDampness = 0;

function registerSoilMaterial(material) {
  material.userData.dryColor = material.color.clone();
  soilMaterialRefs.add(new WeakRef(material));
  applySoilDampnessTo(material, currentSoilDampness);
}

function applySoilDampnessTo(material, damp) {
  if (!material.userData.dryColor) return;
  material.color.copy(material.userData.dryColor).multiplyScalar(1 - damp * 0.22);
}

function applySoilDampness(damp) {
  currentSoilDampness = Math.max(0, Math.min(1, damp));
  soilMaterialRefs.forEach((ref) => {
    const material = ref.deref();
    if (!material) {
      soilMaterialRefs.delete(ref);
      return;
    }
    applySoilDampnessTo(material, currentSoilDampness);
  });
}

function applyWeatherToScene(weather) {
  setSkyWeather(weather);
  applySoilDampness((weather.rain || 0) * 1.1 + (weather.fog || 0) * 0.15);
  setAmbientRain(weather.rain);
  setRainSoundLevel(weather.rain);
  // 風の強さ: 雨・嵐で強く、雲が多い日も少し揺れる（植物の揺れと風の音を同じ値で連動）
  const windStrength = Math.min(1, 0.2 + Math.max(weather.rain || 0, (weather.dark || 0) * 1.5) + (weather.cloud || 0) * 0.2);
  setPlantWind(windStrength);
  setWindSoundLevel(windStrength);
  // 雨の日は葉先に露が宿る
  setPlantRain(weather.rain || 0);
}

function setDebugWeather(key) {
  debugWeatherKey = WEATHER_PRESETS[key] ? key : "";
  if (debugWeatherKey) maybeShowWeatherGreeting(WEATHER_PRESETS[debugWeatherKey]);
  if (debugWeatherKey) {
    applyWeatherToScene(WEATHER_PRESETS[debugWeatherKey]);
  } else {
    applyWeatherToScene(lastRealWeather || { cloud: 0.28, rain: 0, snow: 0, fog: 0, dark: 0 });
  }
}
const FRAME_TYPES = {
  walnut: {
    label: "Walnut Shadow Box",
    jp: "胡桃の深箱",
    story: "深く艶めく木目が、花をしずかに抱く。",
    modelPath: "./models/frames/walnut-shadow-box/frame.glb",
    material: "#5a3b25",
    materialDeep: "#31200f",
    finish: "wood",
    matBoard: true
  },
  "museum-black": {
    label: "Museum Black",
    jp: "美術館の黒",
    story: "光を呑む漆黒が、色彩だけを浮かび上がらせる。",
    modelPath: "./models/frames/museum-black/picture+frame+3d+model+1k.glb",
    material: "#171716",
    materialDeep: "#050505",
    finish: "lacquer",
    matBoard: false,
    lip: false
  },
  "floating-maple": {
    label: "Floating Maple",
    jp: "浮かぶ楓",
    story: "額と作品のあいだに光の隙間。花が宙に浮いて見える。",
    modelPath: "./models/frames/floating-maple/frame.glb",
    material: "#b98248",
    materialDeep: "#7d5227",
    finish: "wood",
    matBoard: false
  },
  "gilded-gold": {
    label: "Gilded Gold",
    jp: "金箔の額",
    story: "金箔のきらめきが、祝祭の光を纏わせる。",
    modelPath: "",
    material: "#c9a44f",
    materialDeep: "#7a5a1e",
    finish: "gold",
    matBoard: true
  },
  "white-gallery": {
    label: "White Gallery",
    jp: "白の画廊",
    story: "白の余白が、作品に呼吸をあたえる。",
    modelPath: "",
    material: "#e8e4da",
    materialDeep: "#b9b2a4",
    finish: "gesso",
    matBoard: true
  },
  "antique-silver": {
    label: "Antique Silver",
    jp: "古銀の額",
    story: "古びた銀が、月の光をしずかに映す。",
    modelPath: "",
    material: "#9aa0a6",
    materialDeep: "#4d5257",
    finish: "silver",
    matBoard: true
  },
  "ebony-gold": {
    label: "Ebony & Gold",
    jp: "黒檀と金",
    story: "闇と金のあわいに、色彩が目を覚ます。",
    modelPath: "",
    material: "#1b1712",
    materialDeep: "#060402",
    finish: "ebony",
    matBoard: true
  }
};
const BACKDROP_TYPES = {
  nocturne: {
    label: "夜の展示室",
    colors: ["rgba(34, 38, 48, 0.72)", "rgba(7, 8, 11, 0.92)", "rgba(169, 140, 74, 0.2)"]
  },
  aureole: {
    label: "金の光",
    colors: ["rgba(128, 91, 28, 0.66)", "rgba(22, 17, 10, 0.92)", "rgba(242, 183, 38, 0.34)"]
  },
  mineral: {
    label: "石の余白",
    colors: ["rgba(86, 97, 96, 0.66)", "rgba(20, 22, 22, 0.94)", "rgba(232, 221, 200, 0.16)"]
  }
};
const SOIL_TYPES = {
  "gallery-loam": {
    label: "土の丘",
    modelPath: "./models/shared/soil/soil+pile+3d+model+512.glb"
  },
  "water-surface": {
    label: "水面",
    environmentType: "water",
    modelPath: "./models/shared/bases/water-surface/water+dish+3d+model+1k.glb"
  }
};

const state = {
  plants: [],
  progress: {},
  steps: {
    todaySteps: 0,
    totalSteps: 0,
    date: getTodayKey(),
    sourceStatus: "歩数データは未同期です",
    motionEnabled: false,
    lastMagnitude: 0,
    lastStepAt: 0
  },
  selectedPlantId: "",
  currentView: "home",
  newlyCompletedPlantId: "",
  newlyCollectedPlantId: "",
  frameChoicePlantId: "",
  galleryFocusPlantId: "",
  galleryFocusAngle: 0,
  demoModelStage: 1,
  demoStageGrowth: 1,
  demoModelSettings: loadDemoModelSettings(),
  productionModelSettings: loadProductionModelSettings(),
  demoSoilAssignments: loadSoilAssignments(DEMO_SOIL_STORAGE_KEY),
  productionSoilAssignments: loadSoilAssignments(PRODUCTION_SOIL_STORAGE_KEY),
  tunedOverrides: loadJsonObject(TUNED_OVERRIDES_STORAGE_KEY, "Tuned overrides"),
  userName: loadUserName()
};

const fallbackPlants = [
  {
    id: "scream-bloom",
    name: "The Scream Bloom",
    motif: "The Scream",
    artist: "Artarium Archive",
    year: "1893",
    palette: [
      "#f26a3d",
      "#f5c55b",
      "#1e6076",
      "#1d2b3a"
    ],
    temperament: "不安げな渦と夕焼け色をまとった、感情の花。",
    copy: {
      seedLabel: "夕暮れの感情を宿す種",
      homeCaption: "渦巻く空と静かな叫びを、花の輪郭に育てます。",
      completionNote: "渦巻いていた空が、一輪の花にしずまりました。",
      collectionTitle: "渦まく夕空",
      collectionLabel: "夕焼けの色とゆれる感情をイメージした植物作品"
    },
    modelPath: "./models/plants/scream-bloom/stage-01-seed/seed+pod+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/scream-bloom/stage-01-seed/seed+pod+3d+model+1k.glb",
      2: "./models/plants/scream-bloom/stage-02-sprout/y-shaped+plant+3d+model+1k.glb",
      3: "./models/plants/scream-bloom/stage-03-leaves/ornamental+plant+3d+model+1k.glb",
      4: "./models/plants/scream-bloom/stage-04-bud/paint+splash+3d+model+1k.glb",
      5: "./models/plants/scream-bloom/stage-05-pre-bloom/alien+plant+3d+model+1k.glb",
      6: "./models/plants/scream-bloom/stage-06-bloom/demonic+splash+3d+model+1k.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "walnut",
    frameOptions: [
      "walnut",
      "museum-black",
      "floating-maple"
    ],
    stageNames: [
      "Seed",
      "Curl",
      "Whisper",
      "Cry",
      "Echo",
      "Bloom"
    ]
  },
  {
    id: "sunflower-bloom",
    name: "Sunflower Bloom",
    motif: "Sunflowers",
    artist: "Artarium Archive",
    year: "1888",
    palette: [
      "#f2b705",
      "#d98b1f",
      "#6f8a39",
      "#64412a"
    ],
    temperament: "厚い筆あとみたいに、明るさを何層にも重ねる花。",
    copy: {
      seedLabel: "陽だまりを重ねる種",
      homeCaption: "歩くほど、厚い筆あとの黄色が濃くなっていきます。",
      completionNote: "厚い筆あとの黄色が、まぶしく咲きました。",
      collectionTitle: "太陽の筆あと",
      collectionLabel: "明るい黄色と筆あとをイメージした植物作品"
    },
    modelPath: "./models/plants/sunflower-bloom/stage-01-seed/seed+pod+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/sunflower-bloom/stage-01-seed/seed+pod+3d+model+1k.glb",
      2: "./models/plants/sunflower-bloom/stage-02-sprout/abstract+tree+sculpture+3d+1k.glb",
      3: "./models/plants/sunflower-bloom/stage-03-leaves/plant+3d+model+1k.glb",
      4: "./models/plants/sunflower-bloom/stage-04-bud/green+plant+3d+model+1k.glb",
      5: "./models/plants/sunflower-bloom/stage-05-pre-bloom/artichoke+plant+3d+model+1k.glb",
      6: "./models/plants/sunflower-bloom/stage-06-bloom/sunflower+3d+model+1k.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "floating-maple",
    frameOptions: [
      "floating-maple",
      "walnut",
      "museum-black"
    ],
    stageNames: [
      "Seed",
      "Leaf",
      "Bud",
      "Ray",
      "Crown",
      "Bloom"
    ]
  },
  {
    id: "wave-crest-bloom",
    name: "Wave Crest Bloom",
    motif: "Ocean Wave",
    artist: "Artarium Archive",
    year: "1899",
    palette: [
      "#86b6c6",
      "#b8d6a0",
      "#d9a8c7",
      "#486b62"
    ],
    temperament: "水面の光を吸って、静かにひらく浮遊する花。",
    copy: {
      seedLabel: "波の力を宿す種",
      homeCaption: "歩みを重ねると、波がしらが少しずつ立ち上がります。",
      completionNote: "打ち寄せる波が、ひとつの花のかたちで留まりました。",
      collectionTitle: "波がしらの花",
      collectionLabel: "うねる波と白い飛沫をイメージした植物作品"
    },
    modelPath: "./models/plants/wave-crest-bloom/stage-01-seed/wave+leaf+ornament+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/wave-crest-bloom/stage-01-seed/wave+leaf+ornament+3d+model+1k.glb",
      2: "./models/plants/wave-crest-bloom/stage-02-sprout/stylized+plant+3d+model+1k.glb",
      3: "./models/plants/wave-crest-bloom/stage-03-leaves/plant+3d+model+1k.glb",
      4: "./models/plants/wave-crest-bloom/stage-04-bud/stylized+flower+3d+model+1k.glb",
      5: "./models/plants/wave-crest-bloom/stage-05-pre-bloom/ornamental+flower+3d+model+1k.glb",
      6: "./models/plants/wave-crest-bloom/stage-06-bloom/decorative+flower+3d+model+1k.glb"
    },
    environmentType: "water",
    soilType: "water-surface",
    defaultFrameType: "museum-black",
    frameOptions: [
      "museum-black",
      "floating-maple",
      "walnut"
    ],
    stageNames: [
      "Seed",
      "Ripple",
      "Swell",
      "Curl",
      "Crest",
      "Bloom"
    ]
  },
  {
    id: "aquatic-bloom",
    name: "Aquatic Bloom",
    motif: "Water Garden",
    artist: "Artarium Archive",
    year: "1900",
    palette: [
      "#79b7c2",
      "#d7c68a",
      "#b9a7dd",
      "#315f68"
    ],
    temperament: "水面の光と淡い色彩をまとい、静かに浮かぶ花。",
    copy: {
      seedLabel: "水面の光を宿す種",
      homeCaption: "歩いたぶんだけ、水面の花がふくらみます。",
      completionNote: "水のゆらぎが、淡い花に結ばれました。",
      collectionTitle: "水鏡の庭",
      collectionLabel: "水面の光と淡い花をイメージした植物作品"
    },
    modelPath: "./models/plants/aquatic-bloom/stage-01-seed/iridescent+mosaic+egg+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/aquatic-bloom/stage-01-seed/iridescent+mosaic+egg+3d+model+1k.glb",
      2: "./models/plants/aquatic-bloom/stage-02-sprout/watercolor+sprout+3d+model+1k.glb",
      3: "./models/plants/aquatic-bloom/stage-03-leaves/watercolor+plant+3d+model+1k.glb",
      4: "./models/plants/aquatic-bloom/stage-04-bud/lily+pads+3d+model+1k.glb",
      5: "./models/plants/aquatic-bloom/stage-05-pre-bloom/stylized+plant+3d+model+1k.glb",
      6: "./models/plants/aquatic-bloom/stage-06-bloom/lotus+flower+3d+model+1k.glb"
    },
    environmentType: "water",
    soilType: "water-surface",
    defaultFrameType: "museum-black",
    frameOptions: [
      "museum-black",
      "floating-maple",
      "walnut"
    ],
    stageNames: [
      "Seed",
      "Sprout",
      "Leaf",
      "Pad",
      "Bud",
      "Bloom"
    ]
  },
  {
    id: "renaissance-smile-bloom",
    name: "Renaissance Smile Bloom",
    motif: "Renaissance Portrait",
    artist: "Artarium Archive",
    year: "1503",
    palette: [
      "#d4b16a",
      "#6f7f55",
      "#5a3326",
      "#1d1a18"
    ],
    temperament: "静かな微笑みと深い陰影をまとった、肖像画のような植物。",
    copy: {
      seedLabel: "静かな微笑みを宿す種",
      homeCaption: "穏やかな表情と深い色合いを、植物の輪郭に育てます。",
      completionNote: "深い陰影の中に、微笑がひらきました。",
      collectionTitle: "静かな微笑",
      collectionLabel: "やわらかな表情と深い陰影をイメージした植物作品"
    },
    modelPath: "./models/plants/renaissance-smile-bloom/stage-01-seed/seed+pod+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/renaissance-smile-bloom/stage-01-seed/seed+pod+3d+model+1k.glb",
      2: "./models/plants/renaissance-smile-bloom/stage-02-sprout/ornamental+plant+3d+model+1k.glb",
      3: "./models/plants/renaissance-smile-bloom/stage-03-leaves/ornamental+plant+3d+model+1k-2.glb",
      4: "./models/plants/renaissance-smile-bloom/stage-04-bud/ornamental+plant+3d+model+1k-3.glb",
      5: "./models/plants/renaissance-smile-bloom/stage-05-pre-bloom/ornamental+plant+3d+model.glb",
      6: "./models/plants/renaissance-smile-bloom/stage-06-bloom/fantasy+plant+creature+3d+model.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "walnut",
    frameOptions: [
      "walnut",
      "museum-black",
      "floating-maple"
    ],
    stageNames: [
      "Seed",
      "Gaze",
      "Shade",
      "Veil",
      "Portrait",
      "Bloom"
    ]
  },
  {
    id: "nocturne-sky-bloom",
    name: "Nocturne Sky Bloom",
    motif: "Night Sky",
    artist: "Artarium Archive",
    year: "1889",
    palette: [
      "#1d3f8f",
      "#f0c74d",
      "#78a7d8",
      "#111827"
    ],
    temperament: "夜空の渦と星の光をまとった、静かに輝く植物。",
    copy: {
      seedLabel: "夜空の光を宿す種",
      homeCaption: "歩くほど、夜空の星がまたたきを増します。",
      completionNote: "夜空の星が、花のかたちで瞬いています。",
      collectionTitle: "星のめぐる夜",
      collectionLabel: "深い青と星のきらめきをイメージした植物作品"
    },
    modelPath: "./models/plants/nocturne-sky-bloom/stage-01-seed/starry+night+egg+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/nocturne-sky-bloom/stage-01-seed/starry+night+egg+3d+model+1k.glb",
      2: "./models/plants/nocturne-sky-bloom/stage-02-sprout/stylized+leaf+3d+model+1k.glb",
      3: "./models/plants/nocturne-sky-bloom/stage-03-leaves/stylized+starry+flower+3d+model+1k.glb",
      4: "./models/plants/nocturne-sky-bloom/stage-04-bud/stylized+flower+3d+model+1k.glb",
      5: "./models/plants/nocturne-sky-bloom/stage-05-pre-bloom/blue+starry+flower+3d+model+1k.glb",
      6: "./models/plants/nocturne-sky-bloom/stage-06-bloom/blue+flower+3d+model+1k.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "museum-black",
    frameOptions: [
      "museum-black",
      "walnut",
      "floating-maple"
    ],
    stageNames: [
      "Seed",
      "Glimmer",
      "Spiral",
      "Night",
      "Star",
      "Bloom"
    ]
  },
  {
    id: "golden-embrace-bloom",
    name: "Golden Embrace Bloom",
    motif: "Golden Embrace",
    artist: "Artarium Archive",
    year: "1908",
    palette: [
      "#d8a93d",
      "#f1d682",
      "#46331f",
      "#1b1712"
    ],
    temperament: "金色の装飾とやわらかな抱擁をまとった、モザイクのような植物。",
    copy: {
      seedLabel: "金色の抱擁を宿す種",
      homeCaption: "歩みを重ねると、金の文様が広がっていきます。",
      completionNote: "金の文様が、抱きしめるように咲きそろいました。",
      collectionTitle: "金色の抱擁",
      collectionLabel: "金の装飾とやわらかな抱擁をイメージした植物作品"
    },
    modelPath: "./models/plants/golden-embrace-bloom/stage-01-seed/ornate+golden+egg+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/golden-embrace-bloom/stage-01-seed/ornate+golden+egg+3d+model+1k.glb",
      2: "./models/plants/golden-embrace-bloom/stage-02-sprout/golden+leaf+jewelry+3d+model+1k.glb",
      3: "./models/plants/golden-embrace-bloom/stage-03-leaves/ornamental+plant+3d+model+1k.glb",
      4: "./models/plants/golden-embrace-bloom/stage-04-bud/golden+ornamental+tree+3d+model+1k.glb",
      5: "./models/plants/golden-embrace-bloom/stage-05-pre-bloom/ornate+golden+plant+3d+model+1k.glb",
      6: "./models/plants/golden-embrace-bloom/stage-06-bloom/ornamental+gold+flower+3d+model+1k.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "museum-black",
    frameOptions: [
      "museum-black",
      "walnut",
      "floating-maple"
    ],
    stageNames: [
      "Seed",
      "Gold",
      "Pattern",
      "Embrace",
      "Mosaic",
      "Bloom"
    ]
  },
  {
    id: "monochrome-fracture-bloom",
    name: "Monochrome Fracture Bloom",
    motif: "Monochrome Fracture",
    artist: "Artarium Archive",
    year: "1937",
    palette: [
      "#f2f0e8",
      "#9b9b96",
      "#44413d",
      "#111111"
    ],
    temperament: "モノクロームの断片と鋭い構成をまとった、静かな緊張感の植物。",
    copy: {
      seedLabel: "断片の光を宿す種",
      homeCaption: "歩くたび、白と黒の断片が組み上がっていきます。",
      completionNote: "白と黒の断片が、静かな均衡にたどりつきました。",
      collectionTitle: "白黒の断片",
      collectionLabel: "モノクロームと断片的な形をイメージした植物作品"
    },
    modelPath: "./models/plants/monochrome-fracture-bloom/stage-01-seed/pomegranate+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/monochrome-fracture-bloom/stage-01-seed/pomegranate+3d+model+1k.glb",
      2: "./models/plants/monochrome-fracture-bloom/stage-02-sprout/geometric+plant+3d+model+1k.glb",
      3: "./models/plants/monochrome-fracture-bloom/stage-03-leaves/crystal+tree+3d+model+1k.glb",
      4: "./models/plants/monochrome-fracture-bloom/stage-04-bud/stylized+tree+3d+model+1k.glb",
      5: "./models/plants/monochrome-fracture-bloom/stage-05-pre-bloom/abstract+plant+sculpture+1k.glb",
      6: "./models/plants/monochrome-fracture-bloom/stage-06-bloom/collage+flower+3d+model+1k.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "museum-black",
    frameOptions: [
      "museum-black",
      "walnut",
      "floating-maple"
    ],
    stageNames: [
      "Seed",
      "Line",
      "Shard",
      "Form",
      "Tension",
      "Bloom"
    ]
  },
  {
    id: "pearl-light-bloom",
    name: "Pearl Light Bloom",
    motif: "Pearl Portrait",
    artist: "Artarium Archive",
    year: "1665",
    palette: [
      "#f5efe2",
      "#2f6e8f",
      "#d9b45f",
      "#121820"
    ],
    temperament: "真珠の光と静かな横顔をまとった、柔らかく輝く植物。",
    copy: {
      seedLabel: "真珠の光を宿す種",
      homeCaption: "静かな光が、青と金の余韻を持つ植物へと育ちます。",
      completionNote: "真珠のひかりが、ほのかに実を結びました。",
      collectionTitle: "真珠のあかり",
      collectionLabel: "真珠の光と静かな色合いをイメージした植物作品"
    },
    modelPath: "./models/plants/pearl-light-bloom/stage-01-seed/ornamental+sphere+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/pearl-light-bloom/stage-01-seed/ornamental+sphere+3d+model+1k.glb",
      2: "./models/plants/pearl-light-bloom/stage-02-sprout/ornamental+leaves+3d+model+1k.glb",
      3: "./models/plants/pearl-light-bloom/stage-03-leaves/decorative+plant+3d+model+1k.glb",
      4: "./models/plants/pearl-light-bloom/stage-04-bud/ornamental+flower+3d+model+1k.glb",
      5: "./models/plants/pearl-light-bloom/stage-05-pre-bloom/ornamental+flower+3d+model+1k.glb",
      6: "./models/plants/pearl-light-bloom/stage-06-bloom/ornamental+flower+3d+model+1k.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "museum-black",
    frameOptions: [
      "museum-black",
      "walnut",
      "floating-maple"
    ],
    stageNames: [
      "Seed",
      "Luster",
      "Veil",
      "Pearl",
      "Light",
      "Bloom"
    ]
  },
  {
    id: "milk-pour-bloom",
    name: "Milk Pour Bloom",
    motif: "Morning Milk",
    artist: "Artarium Archive",
    year: "1658",
    palette: [
      "#f4efe0",
      "#3f6ea6",
      "#d9a648",
      "#8f4f38"
    ],
    temperament: "注がれるミルクの白い流れと、朝の台所の静けさをまとった植物。",
    copy: {
      seedLabel: "朝の光を宿す種",
      homeCaption: "白いミルクの流れが、青と黄の静かな朝へと育ちます。",
      completionNote: "そそがれた白が、静かな朝の花になりました。",
      collectionTitle: "そそがれる朝",
      collectionLabel: "注がれるミルクと朝の台所の光をイメージした植物作品"
    },
    modelPath: "./models/plants/milk-pour-bloom/stage-01-seed/fig+fruit+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/milk-pour-bloom/stage-01-seed/fig+fruit+3d+model+1k.glb",
      2: "./models/plants/milk-pour-bloom/stage-02-sprout/leaf+pair+3d+model+1k.glb",
      3: "./models/plants/milk-pour-bloom/stage-03-leaves/stylized+plant+3d+model+1k.glb",
      4: "./models/plants/milk-pour-bloom/stage-04-bud/ornamental+flower+3d+model+1k.glb",
      5: "./models/plants/milk-pour-bloom/stage-05-pre-bloom/ornamental+plant+3d+model+1k.glb",
      6: "./models/plants/milk-pour-bloom/stage-06-bloom/botanical+flower+3d+model+1k.glb"
    },
    soilType: "gallery-loam",
    defaultFrameType: "white-gallery",
    frameOptions: [
      "museum-black",
      "walnut",
      "floating-maple"
    ],
    stageNames: [
      "Seed",
      "Drop",
      "Pour",
      "Vessel",
      "Cream",
      "Bloom"
    ]
  }
];

async function init() {
  document.body.classList.toggle("is-demo-mode", DEMO_MODE);
  state.plants = await loadPlants();
  const saved = loadSavedState();
  state.progress = loadProgress(state.plants, saved);
  state.steps = loadStepState(saved);
  state.selectedPlantId = saved.__activePlantId ?? "";
  // デモ版: 表示ステージ（demoModelStage）を実際の成長段階に同期して起動する。
  // 既定の1のままだと、ヘッダーの段階表示とモデル（常に種）が食い違う
  if (DEMO_MODE) {
    const activeProgress = state.progress[state.selectedPlantId];
    if (activeProgress) state.demoModelStage = Math.max(1, getStage(activeProgress.points));
  }
  migrateWaterSurfaceAssignments();
  normalizeCompletedPlants();
  // 永続ストレージを要求: 端末のストレージ整理でサイトデータが自動削除されるのを防ぐ
  // （2026-07-31 実機で進行データ消失の報告があったため。インストール済みPWAは通常許可される）
  navigator.storage?.persist?.().catch(() => {});
  // 焼き込み値は「初期値」ボタンの戻し先としても使うため保持しておく
  state.bakedModelSettings = await loadBakedModelSettings();
  applyBakedModelSettings(state.bakedModelSettings);
  // ユーザーが明示的に調整した値は焼き込みの上に重ねる（保存が巻き戻らないように）
  applyTunedOverrides();
  saveDemoModelSettings();
  saveProductionModelSettings();
  bindEvents();
  bindAppLifecycleEvents();
  bindDeviceTiltParallax();
  exposeStepBridge();
  exposeTuneBridge();
  render();
  if (window.ArtariumStepBridge?.getTodaySteps) syncSmartphoneSteps();
  resumeMotionCounterIfEnabled();
  // 試作「今日の習作」（2026-07-10 不採用）の保存データを掃除する
  localStorage.removeItem("artarium-studies-v1");
  observeWaterSurfaces();
  initWeatherSync((weather) => {
    lastRealWeather = weather;
    if (!debugWeatherKey) {
      applyWeatherToScene(weather);
      maybeShowWeatherGreeting(weather);
    }
  });
  maybeOfferWeeklyRecap();
  if (DEMO_MODE) {
    // デモ版のみ: URLの ?weather=rain などで天気を強制できる
    const forcedWeather = new URLSearchParams(window.location.search).get("weather");
    if (forcedWeather && WEATHER_PRESETS[forcedWeather]) setDebugWeather(forcedWeather);
  }
}

async function loadPlants() {
  try {
    const response = await fetch(`./data/plants.json?v=${ASSET_VERSION}`);
    if (!response.ok) throw new Error("plants.json could not be loaded");
    return response.json();
  } catch (error) {
    console.warn(error);
    return fallbackPlants;
  }
}

// リポジトリに焼き込んだ植物ごとの配置調整（data/model-settings.json）。
// 配置調整の正はこのJSONで、起動時に localStorage の設定へ常に上書きする。
// 過去バージョンが自動保存した古い値が残っていても必ず最新の調整になる。
// デモパネルでの調整はセッション内の実験用（リロードで焼き込みに戻る）。
async function loadBakedModelSettings() {
  try {
    const response = await fetch(`./data/model-settings.json?v=${ASSET_VERSION}`);
    if (!response.ok) throw new Error("model-settings.json could not be loaded");
    return await response.json();
  } catch (error) {
    console.warn("焼き込み済みモデル設定を読み込めませんでした:", error);
    return null;
  }
}

function applyBakedModelSettings(baked) {
  if (!baked?.plants) return;
  for (const settings of [state.demoModelSettings, state.productionModelSettings]) {
    if (!settings.plants) settings.plants = {};
    for (const [plantId, stages] of Object.entries(baked.plants)) {
      for (let stage = 1; stage <= MODEL_STAGE_COUNT; stage++) {
        const partial = stages?.[String(stage)];
        if (!partial) continue;
        // JSONに入っているキーだけを上書きし、それ以外（土・反射など）は
        // 現在の解決値を保つ。全キー上書きは意図しない見た目変更を生むため禁止
        const current = getModelSettings(settings, plantId, stage);
        setModelSettingsForStage(settings, plantId, stage, { ...current, ...partial });
      }
    }
  }
}

// 調整オーバーライド: デモパネルで明示的に動かした値だけを覚え、
// 起動時に焼き込みの上へ重ねる。これが無いと「保存」しても
// 再読み込みで焼き込み値に巻き戻ってしまう（2026-07-23 ユーザー報告）
function recordTunedOverride(plantId, stage, key, value) {
  if (!plantId) return;
  const overrides = state.tunedOverrides;
  if (!overrides.plants) overrides.plants = {};
  const stages = (overrides.plants[plantId] ??= {});
  const entry = (stages[String(stage)] ??= {});
  entry[key] = value;
}

function clearTunedOverridesForStage(plantId, stage) {
  const stages = state.tunedOverrides?.plants?.[plantId];
  if (!stages) return;
  delete stages[String(stage)];
  if (!Object.keys(stages).length) delete state.tunedOverrides.plants[plantId];
}

function saveTunedOverrides() {
  saveJson(TUNED_OVERRIDES_STORAGE_KEY, state.tunedOverrides);
}

function applyTunedOverrides() {
  const plants = state.tunedOverrides?.plants;
  if (!plants) return;
  for (const settings of [state.demoModelSettings, state.productionModelSettings]) {
    if (!settings.plants) settings.plants = {};
    for (const [plantId, stages] of Object.entries(plants)) {
      for (const [stage, partial] of Object.entries(stages)) {
        if (!partial || !Object.keys(partial).length) continue;
        const current = getModelSettings(settings, plantId, Number(stage));
        setModelSettingsForStage(settings, plantId, Number(stage), { ...current, ...partial });
      }
    }
  }
}

function loadSavedState() {
  return migratePlantIdKeys(loadProgressState(localStorage, STORAGE_KEY, (error) => {
    console.warn("Saved state could not be loaded:", error);
  }));
}

function loadUserName() {
  return localStorage.getItem(USER_PROFILE_STORAGE_KEY) || "";
}

function saveUserName(name) {
  const normalizedName = String(name || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 24);
  if (!normalizedName) return false;
  state.userName = normalizedName;
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, normalizedName);
  return true;
}

function loadDemoModelSettings() {
  return loadStoredModelSettings(DEMO_MODEL_STORAGE_KEY, "Demo model settings");
}

function saveDemoModelSettings() {
  saveJson(DEMO_MODEL_STORAGE_KEY, state.demoModelSettings);
}

// デモの調整値を焼き込み（data/model-settings.json）と同じ形でダウンロードする。
// 手動調整の結果をスクショや転記なしで受け渡すための開発用機能（?demo=1 のみ）。
// 書き出すのは焼き込み対象のキーだけ（鉄則1: 意図したキー以外を固定化しない）
const BAKED_EXPORT_KEYS = ["plantScale", "plantX", "plantY", "plantRotX", "plantRotY", "plantRotZ", "soilScale", "waterOpacity", "reflectionOpacity", "shadowOpacity", "shadowLength", "shadowZ"];

function exportDemoModelSettings() {
  const plants = {};
  for (const plant of state.plants) {
    const stages = {};
    for (let stage = 1; stage <= MODEL_STAGE_COUNT; stage++) {
      const resolved = getModelSettings(state.demoModelSettings, plant.id, stage);
      const entry = {};
      for (const key of BAKED_EXPORT_KEYS) {
        if (Number.isFinite(resolved?.[key])) entry[key] = resolved[key];
      }
      stages[String(stage)] = entry;
    }
    plants[plant.id] = stages;
  }
  const payload = { exportedAt: new Date().toISOString(), plants };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "artarium-tuned-settings.json";
  link.click();
  URL.revokeObjectURL(url);
}

function loadProductionModelSettings() {
  return loadStoredModelSettings(PRODUCTION_MODEL_STORAGE_KEY, "Production model settings");
}

function saveProductionModelSettings() {
  saveJson(PRODUCTION_MODEL_STORAGE_KEY, state.productionModelSettings);
}

function loadSoilAssignments(storageKey) {
  return migratePlantIdKeys(loadJsonObject(storageKey, "Soil assignments"));
}

function saveDemoSoilAssignments() {
  saveJson(DEMO_SOIL_STORAGE_KEY, state.demoSoilAssignments);
}

function saveProductionSoilAssignments() {
  saveJson(PRODUCTION_SOIL_STORAGE_KEY, state.productionSoilAssignments);
}

function loadJsonObject(storageKey, label) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (error) {
    console.warn(`${label} could not be loaded:`, error);
    return {};
  }
}

function saveJson(storageKey, value) {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function loadStoredModelSettings(storageKey, label) {
  return normalizeModelSettings(migratePlantIdKeys(loadJsonObject(storageKey, label)));
}

function migrateWaterSurfaceAssignments() {
  let demoChanged = false;
  let productionChanged = false;
  state.plants.forEach((plant) => {
    if (plant.soilType !== "water-surface") return;
    if (!state.demoSoilAssignments[plant.id] || state.demoSoilAssignments[plant.id] === "gallery-loam") {
      state.demoSoilAssignments[plant.id] = "water-surface";
      demoChanged = true;
    }
    if (!state.productionSoilAssignments[plant.id] || state.productionSoilAssignments[plant.id] === "gallery-loam") {
      state.productionSoilAssignments[plant.id] = "water-surface";
      productionChanged = true;
    }
  });
  if (demoChanged) saveDemoSoilAssignments();
  if (productionChanged) saveProductionSoilAssignments();
}

function createStageModelSettings(seed = DEFAULT_MODEL_SETTINGS) {
  return MODEL_STAGE_KEYS.reduce((settings, stage) => {
    settings[stage] = { ...DEFAULT_MODEL_SETTINGS, ...seed };
    return settings;
  }, {});
}

function createModelSettings(seed = DEFAULT_MODEL_SETTINGS) {
  return {
    __default: createStageModelSettings(seed),
    plants: {}
  };
}

function normalizeModelSettings(saved) {
  if (saved?.__default || saved?.plants) {
    const normalized = {
      __default: normalizeStageModelSettings(saved.__default || saved.stages || {}),
      plants: Object.entries(saved.plants || {}).reduce((plants, [plantId, settings]) => {
        plants[plantId] = normalizeStageModelSettings(settings);
        return plants;
      }, {})
    };
    return isolateLegacySharedModelSettings(normalized);
  }

  const legacySettings = normalizeStageModelSettings(saved || {});
  return isolateLegacySharedModelSettings({
    __default: legacySettings,
    plants: {}
  });
}

function normalizeStageModelSettings(saved) {
  const stageSettings = createStageModelSettings();
  const hasStageSettings = saved?.stages || MODEL_STAGE_KEYS.some((stage) => saved?.[stage]);
  const flatSettings = Object.keys(DEFAULT_MODEL_SETTINGS).some((key) => saved?.[key] !== undefined)
    ? Object.keys(DEFAULT_MODEL_SETTINGS).reduce((settings, key) => {
        settings[key] = saved[key] === undefined ? DEFAULT_MODEL_SETTINGS[key] : Number(saved[key]);
        return settings;
      }, { ...DEFAULT_MODEL_SETTINGS })
    : null;

  if (flatSettings) return createStageModelSettings(flatSettings);

  if (hasStageSettings) {
    const source = saved.stages || saved;
    Object.keys(stageSettings).forEach((stage) => {
      stageSettings[stage] = { ...DEFAULT_MODEL_SETTINGS, ...(source[stage] || {}) };
    });
  }

  return stageSettings;
}

function getModelSettingsForStage(settings, stage) {
  const safeStage = String(Math.min(MODEL_STAGE_COUNT, Math.max(1, Number(stage) || 1)));
  return { ...DEFAULT_MODEL_SETTINGS, ...(settings?.[safeStage] || {}) };
}

function getPlantDefinition(plantId) {
  return state.plants.find((plant) => plant.id === plantId) || fallbackPlants.find((plant) => plant.id === plantId);
}

function isWaterSurfacePlant(plantId) {
  const plant = getPlantDefinition(plantId);
  if (!plant) return false;
  const soilType = state.demoSoilAssignments?.[plantId] || state.productionSoilAssignments?.[plantId] || plant.soilType || "gallery-loam";
  return soilType === "water-surface" || plant.environmentType === "water";
}

function getDefaultModelSettingsForStage(settings, stage, plantId = "") {
  if (plantId && isWaterSurfacePlant(plantId)) {
    const waterLilySettings = getWaterSurfaceReferenceSettings(settings);
    return getModelSettingsForStage(waterLilySettings || createStageModelSettings(DEFAULT_WATER_SURFACE_MODEL_SETTINGS), stage);
  }
  const sunflowerSettings = settings?.plants?.[LEGACY_MODEL_SETTINGS_PLANT_ID];
  return getModelSettingsForStage(sunflowerSettings || settings?.__default || settings, stage);
}

function getWaterSurfaceReferenceSettings(settings) {
  return settings?.plants?.[WATER_SURFACE_REFERENCE_PLANT_ID]
    || state.demoModelSettings?.plants?.[WATER_SURFACE_REFERENCE_PLANT_ID]
    || state.productionModelSettings?.plants?.[WATER_SURFACE_REFERENCE_PLANT_ID]
    || null;
}

function isolateLegacySharedModelSettings(settings) {
  const defaultStageSettings = createStageModelSettings();
  const hasLegacySharedSettings = !areStageSettingsEqual(settings.__default, defaultStageSettings);

  if (hasLegacySharedSettings && !settings.plants[LEGACY_MODEL_SETTINGS_PLANT_ID]) {
    settings.plants[LEGACY_MODEL_SETTINGS_PLANT_ID] = normalizeStageModelSettings(settings.__default);
  }

  settings.__default = defaultStageSettings;
  return settings;
}

function areStageSettingsEqual(left, right) {
  return MODEL_STAGE_KEYS.every((stage) => {
    const leftStage = getModelSettingsForStage(left, stage);
    const rightStage = getModelSettingsForStage(right, stage);
    return Object.keys(DEFAULT_MODEL_SETTINGS).every((key) => Math.abs(leftStage[key] - rightStage[key]) < 0.0001);
  });
}

function getModelSettings(settings, plantId, stage) {
  const plantSettings = plantId ? settings?.plants?.[plantId] : null;
  if (plantSettings) return getModelSettingsForStage(plantSettings, stage);
  if (plantId && plantId !== LEGACY_MODEL_SETTINGS_PLANT_ID) {
    return getDefaultModelSettingsForStage(settings, stage, plantId);
  }
  return getModelSettingsForStage(settings?.__default || settings, stage);
}

function createPlantModelSettings(settings, plantId) {
  return MODEL_STAGE_KEYS.reduce((stages, stage) => {
    stages[stage] = plantId && plantId !== LEGACY_MODEL_SETTINGS_PLANT_ID
      ? getDefaultModelSettingsForStage(settings, stage, plantId)
      : getModelSettingsForStage(settings?.__default || settings, stage);
    return stages;
  }, {});
}

function setModelSettingsForStage(settings, plantId, stage, nextSettings) {
  if (!plantId) return;
  if (!settings.__default) settings.__default = createStageModelSettings();
  if (!settings.plants) settings.plants = {};
  if (!settings.plants[plantId]) settings.plants[plantId] = createPlantModelSettings(settings, plantId);
  settings.plants[plantId][String(stage)] = { ...DEFAULT_MODEL_SETTINGS, ...nextSettings };
}

function cloneModelSettings(settings) {
  return normalizeModelSettings(JSON.parse(JSON.stringify(settings || createModelSettings())));
}

function loadProgress(plants, saved) {
  return plants.reduce((progress, plant) => {
    progress[plant.id] = {
      points: saved[plant.id]?.points ?? 0,
      displayed: saved[plant.id]?.displayed ?? false,
      frameType: saved[plant.id]?.frameType ?? plant.defaultFrameType ?? "walnut",
      backgroundType: saved[plant.id]?.backgroundType ?? plant.defaultBackgroundType ?? "nocturne",
      stepRemainder: saved[plant.id]?.stepRemainder ?? 0,
      completedAt: saved[plant.id]?.completedAt ?? "",
      collectedAt: saved[plant.id]?.collectedAt ?? "",
      completionSteps: saved[plant.id]?.completionSteps ?? 0,
      stageReachedAt: saved[plant.id]?.stageReachedAt ?? {}
    };
    return progress;
  }, {});
}

function loadStepState(saved) {
  const savedSteps = saved.__steps ?? {};
  const today = getTodayKey();
  return {
    ...state.steps,
    todaySteps: savedSteps.date === today ? savedSteps.todaySteps ?? 0 : 0,
    totalSteps: savedSteps.totalSteps ?? 0,
    date: today,
    sourceStatus: savedSteps.sourceStatus ?? "歩数データは未同期です"
  };
}

function saveProgress() {
  saveProgressState(localStorage, STORAGE_KEY, {
    ...state.progress,
    __activePlantId: state.selectedPlantId,
    __steps: {
      todaySteps: state.steps.todaySteps,
      totalSteps: state.steps.totalSteps,
      date: state.steps.date,
      sourceStatus: state.steps.sourceStatus
    }
  });
}

function getSelectedPlant() {
  return state.plants.find((plant) => plant.id === state.selectedPlantId);
}

function isActivePlantLocked() {
  const plant = getSelectedPlant();
  if (!plant) return false;
  return !isPlantComplete(state.progress[plant.id]);
}

function normalizeCompletedPlants() {
  state.plants.forEach((plant) => {
    const progress = state.progress[plant.id];
    if (progress && isPlantComplete(progress) && !progress.displayed && plant.id === state.selectedPlantId) {
      state.newlyCompletedPlantId = plant.id;
    }
  });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.view;
      render();
    });
  });


  bindHomeStatusView(document, {
    onCollapsePlaque: () => {
      completionPlaqueCollapsed = true;
      render();
    },
    onReopenPlaque: () => {
      completionPlaqueCollapsed = false;
      completionPlaqueInstant = true;
      render();
    },
    onCompletionAction: () => {
      const plant = getSelectedPlant();
      if (!plant) return;
      const progress = state.progress[plant.id];
      if (progress?.displayed) {
        state.currentView = "gallery";
        state.newlyCompletedPlantId = "";
        render();
        return;
      }
      openFrameChoice(plant.id);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") exitViewingMode();
  });

  if (localStorage.getItem(AMBIENT_SOUND_STORAGE_KEY) === "on") {
    setSoundEnabled(true);
  }
  bindSettingsView(document, {
    onToggleSound: () => {
      const next = !isSoundEnabled();
      setSoundEnabled(next);
      localStorage.setItem(AMBIENT_SOUND_STORAGE_KEY, next ? "on" : "off");
      if (next) playRipplePlop(0.3);
      return next;
    },
    onToggleEffects: () => {
      localStorage.setItem(PLANT_EFFECTS_STORAGE_KEY, arePlantEffectsEnabled() ? "off" : "on");
      render();
      return arePlantEffectsEnabled();
    },
    onReset: resetArtariumProgress,
    onExportData: exportArtariumData,
    onImportData: importArtariumData,
    onEditAuthor: openNameEntryModal,
    onStartMotion: startMotionStepCounter,
    onSyncSteps: syncSmartphoneSteps,
    onOpenRecap: openWeeklyRecap,
    onCloseRecap: () => closeModalWithExit(document.getElementById("weekly-recap-modal")),
    onAddTestSteps: () => addStepsToSelectedPlant(100, "開発用に100歩分を加算しました")
  });
  bindCollectionView(document, {
    onGoHome: () => {
      state.currentView = "home";
      render();
    },
    onOpenArtwork: openGalleryFocus
  });

  document.getElementById("frame-choice-modal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-frame-choice-close]")) {
      state.frameChoicePlantId = "";
      renderFrameChoiceModal();
      return;
    }
    const frameButton = event.target.closest("[data-frame-choice]");
    if (frameButton) {
      const progress = state.progress[state.frameChoicePlantId];
      if (!progress) return;
      progress.frameType = frameButton.dataset.frameChoice;
      renderFrameChoiceModal();
      initGalleryModelViewers();
      return;
    }
    if (event.target.closest("[data-frame-choice-confirm]")) {
      confirmFrameChoice();
    }
  });

  const galleryFocusModal = document.getElementById("gallery-focus-modal");
  galleryFocusModal?.addEventListener("click", (event) => {
    if (event.target === galleryFocusModal || event.target.closest("[data-gallery-focus-close]")) {
      closeGalleryFocus();
    }
  });

  galleryFocusModal?.addEventListener("pointerdown", (event) => {
    const dragTarget = event.target.closest("[data-gallery-focus-drag]");
    if (!dragTarget) return;
    startGalleryFocusDrag(event, dragTarget);
  });

  document.addEventListener("keydown", (event) => {
    const nameEntryModal = document.getElementById("name-entry-modal");
    if (event.key === "Escape" && nameEntryModal && !nameEntryModal.hidden) {
      closeNameEntryModal();
      return;
    }
    const weeklyRecapModal = document.getElementById("weekly-recap-modal");
    if (event.key === "Escape" && weeklyRecapModal && !weeklyRecapModal.hidden) {
      closeModalWithExit(weeklyRecapModal);
      return;
    }
    // 収蔵の儀式が始まったら中断不可（収蔵は確定済み。Escで見た目だけ閉じる競合を防ぐ）
    if (event.key === "Escape" && frameConsecrationRunning) return;
    if (event.key === "Escape" && state.frameChoicePlantId) {
      state.frameChoicePlantId = "";
      renderFrameChoiceModal();
      return;
    }
    if (!state.galleryFocusPlantId) return;
    if (event.key === "Escape") {
      closeGalleryFocus();
      return;
    }
  });

  document.querySelector("[data-name-entry-close]")?.addEventListener("click", () => {
    closeNameEntryModal();
  });

  document.getElementById("name-entry-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("name-entry-input");
    if (!saveUserName(input?.value)) {
      input?.focus();
      return;
    }
    closeModalWithExit(document.getElementById("name-entry-modal"));
    if (pendingFrameChoiceAfterName) {
      const plantId = pendingFrameChoiceAfterName;
      pendingFrameChoiceAfterName = "";
      openFrameChoice(plantId);
      return;
    }
    render();
  });

  document.getElementById("demo-model-settings")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-demo-model-setting]");
    if (!input) return;
    updateDemoModelSetting(input);
  });

  document.getElementById("demo-model-settings")?.addEventListener("change", (event) => {
    const growthInput = event.target.closest("[data-demo-growth]");
    if (growthInput) {
      state.demoStageGrowth = Math.min(1, Math.max(0, Number(growthInput.value) / 100));
      render();
      return;
    }
    const plantSelect = event.target.closest("[data-demo-plant-select]");
    if (plantSelect) {
      updateDemoPlantSelection(plantSelect.value);
      return;
    }
    const soilSelect = event.target.closest("[data-demo-soil-select]");
    if (soilSelect) {
      updateDemoSoilAssignment(soilSelect.value);
      return;
    }
    const weatherSelect = event.target.closest("[data-demo-weather-select]");
    if (weatherSelect) {
      setDebugWeather(weatherSelect.value);
      return;
    }
    const seasonSelect = event.target.closest("[data-demo-season-select]");
    if (seasonSelect) {
      debugSeasonKey = seasonSelect.value;
      setSkySeasonOverride(debugSeasonKey || null);
      return;
    }
    const hourSelect = event.target.closest("[data-demo-hour-select]");
    if (hourSelect) {
      debugHourOverride = hourSelect.value === "" ? null : Number(hourSelect.value);
      setSkyHourOverride(debugHourOverride);
      return;
    }
    const glintSelect = event.target.closest("[data-demo-glint-select]");
    if (glintSelect) {
      debugGlintOverride = glintSelect.value === "" ? null : Number(glintSelect.value);
      setSkyStepProgress(debugGlintOverride ?? (state.steps?.todaySteps || 0) / DAILY_STEP_GOAL);
      return;
    }
    const input = event.target.closest("[data-demo-model-setting]");
    if (!input) return;
    updateDemoModelSetting(input);
  });

  document.getElementById("demo-model-settings")?.addEventListener("click", (event) => {
    const resetButton = event.target.closest("[data-demo-model-reset]");
    const autoReflectionButton = event.target.closest("[data-demo-reflection-auto]");
    const saveButton = event.target.closest("[data-demo-model-save]");
    const applyButton = event.target.closest("[data-demo-model-apply-production]");
    const openProductionButton = event.target.closest("[data-demo-model-open-production]");
    const exportButton = event.target.closest("[data-demo-model-export]");
    const stepButton = event.target.closest("[data-demo-model-step]");
    const stageButton = event.target.closest("[data-demo-model-stage]");
    const bloomPreviewButton = event.target.closest("[data-demo-bloom-preview]");
    if (bloomPreviewButton) {
      playBloomCelebration(document.getElementById("home-active-artwork"));
      return;
    }
    const shootingStarButton = event.target.closest("[data-demo-shooting-star]");
    if (shootingStarButton) {
      triggerShootingStar();
      return;
    }
    const shedPetalsButton = event.target.closest("[data-demo-shed-petals]");
    if (shedPetalsButton) {
      // 花びらはStage6のみ。デモのステージがStage6でなければ切り替えてから散らす
      if (state.demoModelStage !== 6) {
        state.demoModelStage = 6;
        render();
        window.setTimeout(() => shedPetalsNow(), 2500);
      } else {
        shedPetalsNow();
      }
      return;
    }
    const completePlantButton = event.target.closest("[data-demo-complete-plant]");
    if (completePlantButton) {
      const progress = state.progress[state.selectedPlantId];
      if (progress && isPlantComplete(progress)) {
        state.demoModelStage = MODEL_STAGE_COUNT;
        state.pendingBloomCelebration = state.selectedPlantId;
        render();
        return;
      }
      if (progress && !isPlantComplete(progress)) {
        progress.points = COMPLETION_THRESHOLD;
        progress.stepRemainder = 0;
        recordStageArrival(progress, 1, MODEL_STAGE_COUNT);
        markPlantCompleted(progress);
        state.demoModelStage = MODEL_STAGE_COUNT;
        state.pendingBloomCelebration = state.selectedPlantId;
        state.newlyCompletedPlantId = state.selectedPlantId;
        saveProgress();
        render();
      }
      return;
    }
    const parallaxButton = event.target.closest("[data-demo-parallax]");
    if (parallaxButton) {
      demoMouseParallax = !demoMouseParallax;
      if (!demoMouseParallax) {
        deviceTilt.x = 0;
        deviceTilt.y = 0;
      }
      parallaxButton.textContent = `視差プレビュー: ${demoMouseParallax ? "オン" : "オフ"}`;
      return;
    }
    if (stageButton) {
      state.demoModelStage = Number(stageButton.dataset.demoModelStage) || 1;
      render();
      return;
    }
    if (stepButton) {
      stepDemoModelSetting(stepButton);
      return;
    }
    if (resetButton) {
      // 保存済みの調整（オーバーライド）ごと消す破壊的操作なので、実行前に確認を挟む
      const plantName = state.plants.find((plant) => plant.id === state.selectedPlantId)?.name
        || "選択中の植物";
      const confirmed = window.confirm(
        `${plantName} の Stage${state.demoModelStage} を初期値に戻します。\nこの段階の調整（保存済みの値も含む）は消えます。よろしいですか？`
      );
      if (!confirmed) return;
      // 「初期値」= 焼き込み値（model-settings.json）へ戻す。
      // 旧実装の getDefaultModelSettingsForStage は基準植物の現在値を返すだけで、
      // 水面植物では自分自身の現在値＝実質何もしない状態だった（2026-07-23 修正）
      const bakedEntry = state.bakedModelSettings?.plants?.[state.selectedPlantId]?.[String(state.demoModelStage)];
      const resetBase = bakedEntry
        ? {
            ...getModelSettings(state.demoModelSettings, state.selectedPlantId, state.demoModelStage),
            ...bakedEntry
          }
        : getDefaultModelSettingsForStage(state.demoModelSettings, state.demoModelStage, state.selectedPlantId);
      setModelSettingsForStage(state.demoModelSettings, state.selectedPlantId, state.demoModelStage, resetBase);
      // 初期値に戻したステージは調整オーバーライドも消す（残すと再読み込みで復活する）
      clearTunedOverridesForStage(state.selectedPlantId, state.demoModelStage);
      saveTunedOverrides();
      render();
      // パネルの入力値とシーンを初期値で即時更新する（render()だけでは既存入力のDOM値が残る）
      const resetSettings = getModelSettings(state.demoModelSettings, state.selectedPlantId, state.demoModelStage);
      document.querySelectorAll(".demo-number[data-demo-model-setting]").forEach((input) => {
        const settingKey = input.dataset.demoModelSetting;
        if (Number.isFinite(resetSettings?.[settingKey])) syncDemoModelInputs(settingKey, resetSettings[settingKey]);
      });
      refreshDemoModelPreview();
      return;
    }
    if (autoReflectionButton) {
      applyAutoReflectionSettings();
      autoReflectionButton.textContent = "反射を調整しました";
      window.setTimeout(() => {
        autoReflectionButton.textContent = "反射を自動調整";
      }, 1200);
      return;
    }
    if (saveButton) {
      saveDemoModelSettings();
      saveDemoSoilAssignments();
      saveTunedOverrides();
      saveButton.textContent = "保存しました";
      window.setTimeout(() => {
        saveButton.textContent = "保存";
      }, 1200);
      return;
    }
    if (applyButton) {
      applyDemoSettingsToProduction();
      saveTunedOverrides();
      refreshDemoModelPreview();
      applyButton.textContent = "本番に反映しました";
      window.setTimeout(() => {
        applyButton.textContent = "本番へ反映";
      }, 1400);
      return;
    }
    if (openProductionButton) {
      applyDemoSettingsToProduction();
      window.open(`${window.location.pathname}?v=${ASSET_VERSION}`, "_blank", "noopener");
      return;
    }
    if (exportButton) {
      exportDemoModelSettings();
      exportButton.textContent = "書き出しました";
      window.setTimeout(() => {
        exportButton.textContent = "調整値を書き出す";
      }, 1400);
    }
  });
}

function updateDemoPlantSelection(plantId) {
  if (!state.plants.some((plant) => plant.id === plantId)) return;
  state.selectedPlantId = plantId;
  saveProgress();
  render();
}

function applyAutoReflectionSettings() {
  const plant = getSelectedPlant();
  if (!plant) return;
  const currentSettings = getModelSettings(state.demoModelSettings, plant.id, state.demoModelStage);
  const nextReflectionSettings = getAutoReflectionSettings(currentSettings, state.demoModelStage);
  setModelSettingsForStage(state.demoModelSettings, plant.id, state.demoModelStage, {
    ...currentSettings,
    ...nextReflectionSettings
  });
  Object.entries(nextReflectionSettings).forEach(([key, value]) => syncDemoModelInputs(key, value));
  refreshDemoModelPreview();
}

function getAutoReflectionSettings(settings, stage) {
  const safeStage = Math.min(MODEL_STAGE_COUNT, Math.max(1, Number(stage) || 1));
  const stageStrength = [0.38, 0.46, 0.58, 0.72, 0.88, 1][safeStage - 1] ?? 0.72;
  const waterDistance = Math.abs((settings.plantY ?? 0) - getWaterSurfaceY(settings));
  return {
    reflectionOpacity: Number((0.74 * stageStrength).toFixed(2)),
    reflectionY: Number((Math.min(0.18, Math.max(-0.08, waterDistance * 0.08 - 0.02))).toFixed(2)),
    reflectionZ: Number((-(0.08 + waterDistance * 0.05)).toFixed(2)),
    reflectionSquash: Number((Math.min(0.32, Math.max(0.12, 0.17 + safeStage * 0.018))).toFixed(2)),
    reflectionScale: Number((Math.min(1.12, Math.max(0.86, 0.9 + safeStage * 0.025))).toFixed(2))
  };
}

function updateDemoSoilAssignment(soilType) {
  const plant = getSelectedPlant();
  if (!plant || !SOIL_TYPES[soilType]) return;
  state.demoSoilAssignments[plant.id] = soilType;
  saveDemoSoilAssignments();
  render();
}

function applyDemoSettingsToProduction() {
  state.productionModelSettings = cloneModelSettings(state.demoModelSettings);
  state.productionSoilAssignments = { ...state.productionSoilAssignments, ...state.demoSoilAssignments };
  alignProductionStageWithDemo();
  saveDemoModelSettings();
  saveDemoSoilAssignments();
  saveProductionModelSettings();
  saveProductionSoilAssignments();
  saveProgress();
  notifyProductionSync();
}

function alignProductionStageWithDemo() {
  const progress = state.progress[state.selectedPlantId];
  if (!progress) return;
  const targetStage = Math.min(MODEL_STAGE_COUNT, Math.max(1, Number(state.demoModelStage) || 1));
  progress.points = STAGE_THRESHOLDS[targetStage - 1] ?? 0;
  progress.stepRemainder = 0;
  if (targetStage < 6) {
    progress.displayed = false;
    state.newlyCompletedPlantId = "";
    state.frameChoicePlantId = "";
  }
}

function notifyProductionSync() {
  saveJson(PRODUCTION_SYNC_STORAGE_KEY, {
    version: ASSET_VERSION,
    plantId: state.selectedPlantId,
    stage: state.demoModelStage,
    syncedAt: Date.now()
  });
}

function stepDemoModelSetting(button) {
  const key = button.dataset.demoModelStep;
  const direction = Number(button.dataset.direction);
  const input = document.querySelector(`.demo-number[data-demo-model-setting="${key}"]`);
  if (!input || !Number.isFinite(direction)) return;
  const step = Number(input.step) || 0.02;
  input.value = (Number(input.value) + step * direction).toFixed(2);
  updateDemoModelSetting(input);
}

function updateDemoModelSetting(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const rawValue = Number(input.value);
  if (!Number.isFinite(rawValue)) return;
  const key = input.dataset.demoModelSetting;
  const value = Math.min(max, Math.max(min, rawValue));
  setModelSettingsForStage(state.demoModelSettings, state.selectedPlantId, state.demoModelStage, {
    ...getModelSettings(state.demoModelSettings, state.selectedPlantId, state.demoModelStage),
    [key]: value
  });
  recordTunedOverride(state.selectedPlantId, state.demoModelStage, key, value);
  syncDemoModelInputs(key, value);
  refreshDemoModelPreview();
}

function syncDemoModelInputs(key, value) {
  document.querySelectorAll(`[data-demo-model-setting="${key}"]`).forEach((input) => {
    if (document.activeElement === input && input.type === "number") return;
    input.value = input.type === "number" ? value.toFixed(2) : String(value);
  });
}

function refreshDemoModelPreview() {
  refreshModelViewer(document.querySelector("[data-home-model-viewer]"));
  document.querySelectorAll("[data-model-viewer]").forEach(refreshModelViewer);
  initHomeModelViewer();
  initGalleryModelViewers();
}

function refreshModelViewer(viewer) {
  if (!viewer) return;
  viewer.removeAttribute("data-ready");
  viewer.dataset.modelRenderToken = String(++modelRenderSerial);
}

function bindAppLifecycleEvents() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener("online", renderNetworkStatus);
  window.addEventListener("offline", renderNetworkStatus);
  window.addEventListener("storage", (event) => {
    if (DEMO_MODE) return;
    const watchedKeys = [
      STORAGE_KEY,
      PRODUCTION_MODEL_STORAGE_KEY,
      PRODUCTION_SOIL_STORAGE_KEY,
      PRODUCTION_SYNC_STORAGE_KEY
    ];
    if (!watchedKeys.includes(event.key)) return;
    reloadProductionStateFromStorage();
  });
}

function reloadProductionStateFromStorage() {
  const saved = loadSavedState();
  state.progress = loadProgress(state.plants, saved);
  state.steps = loadStepState(saved);
  state.selectedPlantId = saved.__activePlantId ?? state.selectedPlantId;
  state.productionModelSettings = loadProductionModelSettings();
  state.productionSoilAssignments = loadSoilAssignments(PRODUCTION_SOIL_STORAGE_KEY);
  migrateWaterSurfaceAssignments();
  normalizeCompletedPlants();
  render();
}

function render() {
  if (!document.getElementById(`${state.currentView}-view`)) state.currentView = "home";
  document.body.dataset.currentView = state.currentView;
  // 今日の歩数の達成度を湖の「光の道」の長さに反映する（デバッグの強制値が優先）
  setSkyStepProgress(debugGlintOverride ?? (state.steps?.todaySteps || 0) / DAILY_STEP_GOAL);
  renderTabs();
  renderNetworkStatus();
  renderHome();
  initSeedChoiceThumbnail();
  renderCollectionViews();
  renderSettings();
  renderFrameChoiceModal();
  renderGalleryFocusModal();
  initHomeModelViewer();
  initGalleryModelViewers();
}

let lastRenderedView = null;

function renderCollectionViews() {
  const shared = {
    plants: state.plants,
    progress: state.progress
  };
  // 入館演出はビューを切り替えた瞬間だけ（開いたままの再描画では動かさない）
  const arriving = lastRenderedView !== state.currentView && state.currentView === "gallery";
  lastRenderedView = state.currentView;
  renderCollectionView(document, {
    ...shared,
    newlyCollectedPlantId: state.newlyCollectedPlantId,
    animateArrival: arriving,
    getCollectionTitle,
    getArchiveLine,
    paletteVars,
    backdropVars,
    getPlantModelPath,
    getSoilModelPath,
    getEnvironmentTypeForPlant,
    getFrameModelPath,
    galleryViewerMarkup
  });
  renderCodexView(document, {
    ...shared,
    codexNotes: CODEX_NOTES,
    paletteVars,
    plantMarkup
  });
}

function renderNetworkStatus() {
  const label = document.getElementById("network-status-label");
  if (!label) return;
  label.textContent = navigator.onLine ? "オンライン / 進行は端末に保存中" : "オフライン / 保存済みデータで表示中";
}

function renderTabs() {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `${state.currentView}-view`);
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.currentView);
  });
  // 美術館の静けさ: コレクション表示中は環境音をひそめる
  setAmbienceQuiet(state.currentView === "gallery");
}

let seedPreviewId = null;

function renderHome() {
  const selectedPlant = getSelectedPlant();
  const hero = document.querySelector(".daily-hero");
  hero.classList.remove("is-planting-seed", "is-seed-landed");
  hero.querySelector(".seed-confirm-bar")?.remove();
  hero.querySelector(".seed-specimen-label")?.remove();
  hero.querySelectorAll(".seed-started-message").forEach((message) => message.remove());
  hero.querySelector(".next-artwork-button")?.remove();
  if (!selectedPlant && seedPreviewId) {
    const previewPlant = state.plants.find((plant) => plant.id === seedPreviewId);
    if (previewPlant) {
      renderSeedPreview(hero, previewPlant);
      return;
    }
    seedPreviewId = null;
  }
  if (!selectedPlant) {
    const homeArtwork = document.getElementById("home-active-artwork");
    const availablePlants = state.plants.filter((plant) => !state.progress[plant.id].displayed);
    const hasCollectedPlants = availablePlants.length < state.plants.length;
    hero.classList.add("is-seed-choice");
    document.getElementById("home-title").textContent = availablePlants.length
      ? hasCollectedPlants ? "次の作品を選ぶ。" : "最初の作品を選ぶ。"
      : "コレクション完成。";
    document.getElementById("home-active-caption").textContent = availablePlants.length
      ? "選んだ作品が開花するまで、ひとつの植物を育てます。"
      : "育てたすべての作品が、コレクションに並びました。";
    homeArtwork.removeAttribute("style");
    homeArtwork.removeAttribute("data-stage");
    homeArtwork.removeAttribute("data-home-model-viewer");
    homeArtwork.removeAttribute("data-plant-model");
    homeArtwork.removeAttribute("data-soil-model");
    homeArtwork.removeAttribute("data-environment");
    homeArtwork.removeAttribute("data-seed-preview");
    homeArtwork.removeAttribute("data-ready");
    homeArtwork.dataset.modelRenderToken = String(++modelRenderSerial);
    homeArtwork.classList.remove("is-3d", "is-water-environment", "is-bloom-complete", "is-newly-complete", "is-pearl-material");
    renderCompletionPlaque(null, false);
    homeArtwork.innerHTML = `
      <div class="seed-choice-list">
        ${availablePlants.map((plant) => `
          <button class="seed-choice" type="button" data-seed="${plant.id}" style="${paletteVars(plant)}">
            <span
              class="seed-art seed-model-thumbnail"
              data-seed-thumbnail="true"
              data-stage="1"
              data-plant-id="${plant.id}"
              data-plant-model="${getPlantModelPath(plant, 1)}"
              data-environment="${getEnvironmentTypeForPlant(plant, { preferDemo: DEMO_MODE })}"
            >${modelLoadingMarkup()}</span>
            <span class="seed-copy">
              <strong>${plant.name}</strong>
              <small>${plant.copy?.seedLabel ?? `${plant.motif} / ${plant.artist}`}</small>
            </span>
          </button>
        `).join("") || '<button class="secondary-action" type="button" data-view-complete-gallery>コレクションを見る</button>'}
      </div>
    `;
    const seedChoiceList = homeArtwork.querySelector(".seed-choice-list");
    seedChoiceList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-seed]");
      if (!button || !seedChoiceList.contains(button)) return;
      seedPreviewId = button.dataset.seed;
      render();
    });
    homeArtwork.querySelector("[data-view-complete-gallery]")?.addEventListener("click", () => {
      state.currentView = "gallery";
      render();
    });
    renderHomeProgressView(document, { visible: false });
    return;
  }

  hero.classList.remove("is-seed-choice");

  const selectedProgress = state.progress[selectedPlant.id];
  const selectedStage = getStage(selectedProgress.points);
  const selectedComplete = isPlantComplete(selectedProgress);
  const visualStage = DEMO_MODE ? state.demoModelStage : selectedStage;
  const homeArtwork = document.getElementById("home-active-artwork");

  homeArtwork.style.cssText = paletteVars(selectedPlant);
  homeArtwork.dataset.stage = String(visualStage);
  // 連続成長: ステージ内の進捗（0-1）をシーンへ渡す。デモは焼き込み値の検証を妨げないため常に1
  const stageLowerT = STAGE_THRESHOLDS[selectedStage - 1] ?? 0;
  const stageUpperT = selectedStage >= STAGE_THRESHOLDS.length ? COMPLETION_THRESHOLD : STAGE_THRESHOLDS[selectedStage];
  const stageFill = selectedComplete
    ? 1
    : Math.min(1, Math.max(0, (selectedProgress.points - stageLowerT) / Math.max(1, stageUpperT - stageLowerT)));
  homeArtwork.dataset.stageGrowth = DEMO_MODE ? String(state.demoStageGrowth ?? 1) : stageFill.toFixed(3);
  homeArtwork.dataset.homeModelViewer = "true";
  homeArtwork.dataset.plantId = selectedPlant.id;
  homeArtwork.dataset.plantModel = getPlantModelPath(selectedPlant, visualStage);
  homeArtwork.dataset.soilModel = getSoilModelPath(selectedPlant, { preferDemo: DEMO_MODE });
  homeArtwork.dataset.environment = getEnvironmentTypeForPlant(selectedPlant, { preferDemo: DEMO_MODE });
  homeArtwork.removeAttribute("data-seed-preview");
  homeArtwork.removeAttribute("data-ready");
  homeArtwork.dataset.modelRenderToken = String(++modelRenderSerial);
  homeArtwork.classList.remove("is-3d");
  homeArtwork.classList.toggle("is-water-environment", getEnvironmentTypeForPlant(selectedPlant, { preferDemo: DEMO_MODE }) === "water");
  homeArtwork.classList.toggle("is-pearl-material", selectedPlant.id === "pearl-light-bloom");
  const awaitingFrameChoice = selectedComplete && !selectedProgress.displayed;
  hero.classList.toggle("has-growth-progress", !selectedComplete && !selectedProgress.displayed);
  homeArtwork.classList.toggle("is-bloom-complete", selectedComplete);
  homeArtwork.classList.toggle("is-newly-complete", awaitingFrameChoice);
  // 点灯式の予約中は暗転のまま読み込み、新しい姿はスポットライトで初めて見せる
  homeArtwork.classList.toggle("is-hush", state.pendingBloomCelebration === selectedPlant.id);
  // 3Dモデルを読み込む場合、つなぎのCSS水面は出さない（読み込み完了時のチラつき防止）
  const homePlantModelPath = getPlantModelPath(selectedPlant, visualStage);
  homeArtwork.innerHTML = homePlantModelPath
    ? modelLoadingMarkup()
    : `${environmentLayerMarkup(selectedPlant, { preferDemo: DEMO_MODE })}${plantMarkup(visualStage)}`;
  mountSkyBackground(homeArtwork, { waterTint: skyWaterTint(selectedPlant) });
  mountViewingButton(homeArtwork);
  hero.classList.remove("is-seed-preview");
  // 状態表示は「総距離」ではなく、次に起きる変化へ視線を向ける。
  const STAGE_NAMES = ["", "種", "芽生え", "若葉", "つぼみ", "ほころび", "開花"];
  const STAGE_CODES = ["", "SEED", "SPROUT", "LEAF", "BUD", "PRE-BLOOM", "BLOOM"];
  const NEXT_GROWTH_LABELS = ["", "芽吹きまで", "葉がひらくまで", "枝が伸びるまで", "つぼみまで", "開花まで", "完成まで"];
  const GROWTH_PROGRESS_TITLES = ["", "芽吹きへの歩み", "葉ひらきへの歩み", "枝伸びへの歩み", "つぼみへの歩み", "開花への歩み", "完成への歩み"];
  const todaySteps = state.steps?.todaySteps || 0;
  const currentStageStart = STAGE_THRESHOLDS[selectedStage - 1] ?? 0;
  const nextStageThreshold = getNextThreshold(selectedStage);
  const pointsInStage = Math.max(0, selectedProgress.points - currentStageStart);
  const stagePointSpan = Math.max(1, nextStageThreshold - currentStageStart);
  const stageProgress = Math.min(1, pointsInStage / stagePointSpan);
  const nextStepCount = Math.max(0, nextStageThreshold - selectedProgress.points) * STEPS_PER_POINT;
  const totalStepsRemaining = Math.max(0, COMPLETION_THRESHOLD - selectedProgress.points) * STEPS_PER_POINT;
  const nextGrowthLabel = NEXT_GROWTH_LABELS[selectedStage] ?? "次の変化まで";
  const growthProgressTitle = GROWTH_PROGRESS_TITLES[selectedStage] ?? "次の変化への歩み";
  document.getElementById("home-title").textContent = selectedPlant.name;
  const activeCaption = document.getElementById("home-active-caption");
  if (selectedProgress.displayed) {
    activeCaption.textContent = "あなたの作品として、コレクションに収蔵されています。";
  } else if (selectedComplete) {
    activeCaption.textContent = "作品が完成しました。額装してコレクションへ。";
  } else {
    activeCaption.innerHTML = `
      <span class="growth-stage-label">${STAGE_CODES[selectedStage]} — ${STAGE_NAMES[selectedStage]}</span>
    `;
  }
  // タブバー直上は、次の成長段階までの進み具合だけを静かに示す。
  renderHomeProgressView(document, {
    visible: true,
    progress: stageProgress,
    nextGrowthLabel,
    title: growthProgressTitle,
    todaySteps,
    totalStepsRemaining
  });
  maybeShowSteplineHint();
  renderCompletionPlaque(selectedPlant, awaitingFrameChoice);
  if (selectedProgress.displayed) mountNextArtworkButton(hero);
}

function mountNextArtworkButton(hero) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "next-artwork-button";
  button.textContent = "次の作品を選ぶ";
  button.addEventListener("click", () => {
    state.selectedPlantId = "";
    state.newlyCollectedPlantId = "";
    seedPreviewId = null;
    saveProgress();
    render();
  });
  hero.appendChild(button);
}

function renderSeedPreview(hero, plant) {
  hero.classList.remove("is-seed-choice");
  hero.classList.add("is-seed-preview");
  document.getElementById("home-title").textContent = plant.name;
  document.getElementById("home-active-caption").textContent =
    `${plant.copy?.seedLabel ?? "育てはじめの種"} — 育成開始前`;
  const homeArtwork = document.getElementById("home-active-artwork");
  homeArtwork.style.cssText = paletteVars(plant);
  homeArtwork.dataset.stage = "1";
  homeArtwork.dataset.homeModelViewer = "true";
  homeArtwork.dataset.plantId = plant.id;
  homeArtwork.dataset.plantModel = getPlantModelPath(plant, 1);
  homeArtwork.dataset.soilModel = getSoilModelPath(plant, { preferDemo: DEMO_MODE });
  homeArtwork.dataset.environment = getEnvironmentTypeForPlant(plant, { preferDemo: DEMO_MODE });
  homeArtwork.dataset.seedPreview = "true";
  homeArtwork.removeAttribute("data-ready");
  homeArtwork.dataset.modelRenderToken = String(++modelRenderSerial);
  homeArtwork.classList.remove("is-3d", "is-bloom-complete", "is-newly-complete");
  homeArtwork.classList.toggle("is-water-environment", getEnvironmentTypeForPlant(plant, { preferDemo: DEMO_MODE }) === "water");
  homeArtwork.classList.toggle("is-pearl-material", plant.id === "pearl-light-bloom");
  homeArtwork.innerHTML = getPlantModelPath(plant, 1)
    ? modelLoadingMarkup()
    : `${environmentLayerMarkup(plant, { preferDemo: DEMO_MODE })}${plantMarkup(1)}`;
  const landingFx = document.createElement("div");
  landingFx.className = "seed-landing-fx";
  landingFx.setAttribute("aria-hidden", "true");
  landingFx.innerHTML = `
    <span class="seed-landing-bed"></span>
    <span class="seed-landing-ring"></span>
    ${Array.from({ length: 10 }, (_, index) => `<i style="--particle-index:${index}"></i>`).join("")}
  `;
  homeArtwork.appendChild(landingFx);
  mountSkyBackground(homeArtwork, { waterTint: skyWaterTint(plant) });
  renderCompletionPlaque(null, false);
  renderHomeProgressView(document, { visible: false });
  const specimenLabel = document.createElement("div");
  specimenLabel.className = "seed-specimen-label";
  specimenLabel.innerHTML = `
    <span>Seed specimen — 種の標本</span>
    <strong>${plant.name}</strong>
    <small>${plant.copy?.seedLabel ?? "育てはじめの種"}</small>
  `;
  hero.appendChild(specimenLabel);
  const bar = document.createElement("div");
  bar.className = "seed-confirm-bar";
  bar.innerHTML = `
    <button class="primary-action" type="button" data-seed-confirm>この種を育てる</button>
    <button class="secondary-action" type="button" data-seed-back>ほかの種を見る</button>
  `;
  hero.appendChild(bar);
  const startedMessage = document.createElement("div");
  startedMessage.className = "seed-started-message";
  startedMessage.setAttribute("role", "status");
  startedMessage.setAttribute("aria-live", "polite");
  startedMessage.innerHTML = `<span>Growth begins</span><strong>育成が始まりました</strong>`;
  hero.appendChild(startedMessage);
  bar.querySelector("[data-seed-confirm]").addEventListener("click", async () => {
    bar.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    hero.classList.add("is-planting-seed");
    // 操作UIを先に退場させてから、種だけに視線を集めて植え付ける。
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    const showLanding = () => {
      hero.classList.add("is-seed-landed");
    };
    if (homeArtwork.__artariumSeedPreview?.plant) {
      await homeArtwork.__artariumSeedPreview.plant(showLanding);
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      showLanding();
    }
    await new Promise((resolve) => window.setTimeout(resolve, 760));
    state.selectedPlantId = plant.id;
    seedPreviewId = null;
    recordStageArrival(state.progress[plant.id], 1, 1);
    saveProgress();
    render();
  });
  bar.querySelector("[data-seed-back]").addEventListener("click", () => {
    seedPreviewId = null;
    render();
  });
}

// 雨や雷の日にアプリを開いたら、その日一度だけシーンに一言添える
const WEATHER_GREET_KEY = "artarium-weather-greet";
const WEATHER_GREETINGS = {
  rain: "雨の日の水面も、きれいですよ",
  drizzle: "細い雨が、水面に輪を描いています",
  thunder: "荒れる空も、名画の一部です",
  snow: "雪の日の庭は、いちばん静かです"
};

function weatherGreetingFor(weather) {
  if (!weather) return "";
  if (weather.thunder) return WEATHER_GREETINGS.thunder;
  if (weather.snow > 0.3) return WEATHER_GREETINGS.snow;
  if (weather.rain >= 0.6) return WEATHER_GREETINGS.rain;
  if (weather.rain > 0) return WEATHER_GREETINGS.drizzle;
  return "";
}

function maybeShowWeatherGreeting(weather) {
  const message = weatherGreetingFor(weather);
  if (!message) return;
  const today = getTodayKey();
  if (localStorage.getItem(WEATHER_GREET_KEY) === today) return;
  const container = document.getElementById("home-active-artwork");
  if (!container || !getSelectedPlant()) return;
  localStorage.setItem(WEATHER_GREET_KEY, today);
  const greet = document.createElement("div");
  greet.className = "tap-hint weather-greet";
  greet.textContent = message;
  container.appendChild(greet);
  window.setTimeout(() => {
    greet.classList.add("is-done");
    window.setTimeout(() => greet.remove(), 700);
  }, 6000);
}

// 進捗ラインのタップ（歩数同期）の発見性: 初回だけ小さな示唆を出す
const STEPLINE_HINT_KEY = "artarium-stepline-hinted";

function maybeShowSteplineHint() {
  if (localStorage.getItem(STEPLINE_HINT_KEY)) return;
  const line = document.getElementById("daily-progress-line");
  if (!line || line.hidden || line.querySelector(".stepline-hint")) return;
  localStorage.setItem(STEPLINE_HINT_KEY, "1");
  const hint = document.createElement("p");
  hint.className = "stepline-hint";
  hint.textContent = "ラインをタップすると歩数を同期できます";
  line.appendChild(hint);
  window.setTimeout(() => {
    hint.classList.add("is-done");
    window.setTimeout(() => hint.remove(), 700);
  }, 6000);
}

let completionPlaqueCollapsed = false;
let completionPlaqueInstant = false;
let bloomCelebrationActive = false;

function renderCompletionPlaque(plant, shouldShow) {
  if (!plant || !shouldShow) {
    completionPlaqueCollapsed = false;
    completionPlaqueInstant = false;
  }
  const progress = plant ? state.progress[plant.id] : null;
  renderCompletionPlaqueView(document, {
    plant,
    shouldShow,
    bloomCelebrationActive,
    collapsed: completionPlaqueCollapsed,
    instant: completionPlaqueInstant,
    displayed: progress?.displayed ?? false,
    subtitle: plant?.copy?.completionNote ?? (plant ? `${plant.motif} / ${plant.artist}, ${plant.year}` : "")
  });
}

async function syncSmartphoneSteps() {
  const bridge = window.ArtariumStepBridge;
  if (!bridge?.getTodaySteps) {
    state.steps.sourceStatus = "スマホ歩数計ブリッジが未接続です。ホームの進捗ラインか設定から歩数計を開始できます。";
    saveProgress();
    render();
    return;
  }

  try {
    const data = await bridge.getTodaySteps();
    applyStepSnapshot(data, "スマホ歩数計から同期しました");
  } catch (error) {
    console.warn(error);
    state.steps.sourceStatus = "歩数データを取得できませんでした。しばらくして再度お試しください。";
    saveProgress();
    render();
  }
}

function exposeStepBridge() {
  window.Artarium = {
    ...(window.Artarium ?? {}),
    receiveStepData: (data) => applyStepSnapshot(data, "スマホ歩数計から同期しました")
  };
}

// デモ専用: 配置調整の自動化用ブリッジ（?demo=1 のときだけ生える）
function exposeTuneBridge() {
  if (!DEMO_MODE) return;
  window.__artariumTune = {
    get: (plantId, stage) => getModelSettings(state.demoModelSettings, plantId, stage),
    set: (plantId, stage, partial) => {
      const current = getModelSettings(state.demoModelSettings, plantId, stage);
      setModelSettingsForStage(state.demoModelSettings, plantId, stage, { ...current, ...partial });
      saveDemoModelSettings();
      render();
    },
    dump: () => JSON.parse(JSON.stringify(state.demoModelSettings))
  };
}

function applyStepSnapshot(data, status) {
  const nextTodaySteps = Number(typeof data === "number" ? data : data?.todaySteps ?? data?.steps ?? 0);
  const nextTotalSteps = Number(typeof data === "number" ? state.steps.totalSteps : data?.totalSteps ?? data?.cumulativeSteps ?? state.steps.totalSteps);
  if (!Number.isFinite(nextTodaySteps) || nextTodaySteps < 0) return;

  resetDailyStepsIfNeeded();
  const deltaSteps = Math.max(0, Math.floor(nextTodaySteps) - state.steps.todaySteps);
  state.steps.todaySteps = Math.max(state.steps.todaySteps, Math.floor(nextTodaySteps));
  state.steps.totalSteps = Math.max(state.steps.totalSteps + deltaSteps, Math.floor(nextTotalSteps));
  addGrowthFromSteps(deltaSteps);
  recordDailySteps();
  state.steps.sourceStatus = deltaSteps > 0 ? status : "歩数は同期済みです。新しい歩数はありません。";
  saveProgress();
  render();
}

function addStepsToSelectedPlant(steps, status, { throttleRender = false } = {}) {
  resetDailyStepsIfNeeded();
  state.steps.todaySteps += steps;
  state.steps.totalSteps += steps;
  addGrowthFromSteps(steps);
  recordDailySteps();
  state.steps.sourceStatus = status;
  saveProgress();
  if (throttleRender) scheduleStepRender();
  else render();
}

function addGrowthFromSteps(steps) {
  const progress = state.progress[state.selectedPlantId];
  if (!progress || isPlantComplete(progress)) return;

  const growth = applyStepsToProgress(progress, steps);
  progress.stepRemainder = growth.stepRemainder;
  if (!growth.pointsAdded) return;
  progress.points = growth.points;
  if (growth.stageAfter > growth.stageBefore) {
    recordStageArrival(progress, growth.stageBefore + 1, growth.stageAfter);
    // ステージが上がった: 次の3D描画完了時に開花演出を再生する
    state.pendingBloomCelebration = state.selectedPlantId;
  }
  if (growth.completedNow) {
    markPlantCompleted(progress);
    state.newlyCompletedPlantId = state.selectedPlantId;
  }
}

function markPlantCompleted(progress) {
  if (!progress.completedAt) progress.completedAt = new Date().toISOString();
  if (!progress.completionSteps) progress.completionSteps = progress.points * STEPS_PER_POINT;
}

// Stage到達日を記録する（将来の成長履歴表示用）。既に記録済みの段は上書きしない。
// 記録開始（2026-07-10）以前に通過した段は空のまま = 遡って埋めない
function recordStageArrival(progress, fromStage, toStage) {
  if (!progress.stageReachedAt) progress.stageReachedAt = {};
  for (let stage = fromStage; stage <= toStage; stage++) {
    if (!progress.stageReachedAt[stage]) progress.stageReachedAt[stage] = new Date().toISOString();
  }
}

// スポットライトの中心を花頭の画面位置（%）に合わせる。計測がなければ null（CSSの既定値に任せる）
function spotlightCenterFor(container) {
  try {
    const ndc = JSON.parse(container.dataset.plantNdc || "null");
    if (!ndc) return null;
    const xPct = (((ndc.minX + ndc.maxX) / 2 + 1) / 2) * 100;
    const topPct = ((1 - Math.min(1, ndc.maxY)) / 2) * 100;
    return {
      x: `${Math.min(70, Math.max(30, xPct)).toFixed(1)}%`,
      y: `${Math.min(62, Math.max(20, topPct + 13)).toFixed(1)}%`
    };
  } catch {
    return null;
  }
}

// 点灯した光の中を、金色の塵がゆっくり舞い上がる（短命キャンバス、終わったら自分で消える）
function playSpotlightDust(container, spot, durationMs = 3200) {
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const canvas = document.createElement("canvas");
  canvas.className = "bloom-dust-canvas";
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d");
  container.appendChild(canvas);
  const W = canvas.width;
  const H = canvas.height;
  const cx = W * (spot ? parseFloat(spot.x) / 100 : 0.5);
  const cy = H * (spot ? parseFloat(spot.y) / 100 : 0.52);
  const motes = Array.from({ length: 14 }, () => ({
    x: cx + (Math.random() - 0.5) * W * 0.36,
    y: cy + H * (0.08 + Math.random() * 0.3),
    r: 1.2 + Math.random() * 2.4,
    vy: -(H * (0.008 + Math.random() * 0.014)) / 60,
    sway: 6 + Math.random() * 14,
    phase: Math.random() * Math.PI * 2,
    tw: 0.6 + Math.random() * 0.8
  }));

  const start = performance.now();
  const frame = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, W, H);
    if (elapsed > durationMs || !canvas.isConnected) {
      canvas.remove();
      return;
    }
    // ふわっと現れて、照明が戻るのに合わせてゆっくり消える
    const env = Math.min(1, elapsed / 900) * Math.min(1, Math.max(0, (durationMs - elapsed) / 1400));
    const t = elapsed / 1000;
    ctx.globalCompositeOperation = "lighter";
    motes.forEach((m) => {
      m.y += m.vy;
      const x = m.x + Math.sin(t * m.tw + m.phase) * m.sway;
      const tw = Math.pow((Math.sin(t * 1.7 + m.phase) + 1) / 2, 3);
      const a = (0.22 + 0.5 * tw) * env;
      const glow = ctx.createRadialGradient(x, m.y, 0, x, m.y, m.r * 3);
      glow.addColorStop(0, `rgba(240, 214, 150, ${a.toFixed(3)})`);
      glow.addColorStop(1, "rgba(240, 214, 150, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - m.r * 3, m.y - m.r * 3, m.r * 6, m.r * 6);
    });
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// 開花の祝福「点灯式」:
// 山場は「暗くなる」ではなく「作品に照明が点く」瞬間。
// 0秒: 場内が静まる — 散り・粒子が止み、姿がほとんど見えないところまで0.45秒で暗転する
// 0.8秒: スポットライトが点く — 暗がりが花のまわりへ絞られ、真上からの光条と光だまりがパッと現れて
//         植物が浮かび上がり、光の中を金色の塵が舞い上がる
// 2.6秒: 完成プレート（CSS側の遅延）
// 4秒: 照明がゆっくり平常へ（約4.9秒で完全に平常）、散り演出が静かに再開
function playBloomCelebration(container) {
  if (!container || !container.isConnected) return;
  calmPlantEffects(6500);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 演出中は完成プレートを出さない。終演後に revealCompletionPlaqueAfterCelebration で出す
  bloomCelebrationActive = true;
  const plaqueEl = document.getElementById("completion-plaque");
  if (plaqueEl) plaqueEl.hidden = true;

  container.classList.remove("is-lit");
  container.classList.add("is-hush");
  const veil = document.createElement("i");
  veil.className = "spotlight-veil";
  const spot = spotlightCenterFor(container);
  if (spot) {
    veil.style.setProperty("--spot-x", spot.x);
    veil.style.setProperty("--spot-y", spot.y);
  }
  container.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add("is-on"));
  const glow = document.createElement("i");
  glow.className = "spotlight-glow";
  if (spot) {
    glow.style.setProperty("--spot-x", spot.x);
    glow.style.setProperty("--spot-y", spot.y);
  }

  window.setTimeout(() => {
    container.classList.remove("is-hush");
    container.classList.add("is-lit");
    veil.classList.add("is-focused");
    container.appendChild(glow);
    requestAnimationFrame(() => glow.classList.add("is-on"));
    if (!reduceMotion) playSpotlightDust(container, spot);
  }, 800);

  window.setTimeout(() => {
    container.classList.remove("is-lit");
    veil.classList.remove("is-on");
    glow.classList.remove("is-on");
    window.setTimeout(() => {
      veil.remove();
      glow.remove();
      revealCompletionPlaqueAfterCelebration();
    }, 1200);
  }, 4000);
}

function revealCompletionPlaqueAfterCelebration() {
  bloomCelebrationActive = false;
  const plant = getSelectedPlant();
  if (!plant) return;
  const progress = state.progress[plant.id];
  const awaiting = progress && isPlantComplete(progress) && !progress.displayed;
  if (!awaiting) return;
  completionPlaqueInstant = true;
  renderCompletionPlaque(plant, true);
}

function maybePlayBloomCelebration(container) {
  if (!state.pendingBloomCelebration) return;
  if (container?.dataset?.plantId !== state.pendingBloomCelebration) return;
  state.pendingBloomCelebration = "";
  playBloomCelebration(container);
}

// 鑑賞モード: UIを消して空と植物だけを全画面で眺める
function mountViewingButton(container) {
  if (!container || container.querySelector(":scope > .viewing-mode-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "viewing-mode-button";
  button.textContent = "眺める";
  button.setAttribute("aria-label", "作品を全画面で眺める");
  const setViewingMode = (active) => {
    container.classList.toggle("is-viewing", active);
    document.body.classList.toggle("is-viewing-mode", active);
    container.querySelector(":scope > .viewing-exit-hint")?.remove();
    if (active) {
      const hint = document.createElement("div");
      hint.className = "viewing-exit-hint";
      hint.setAttribute("role", "status");
      hint.textContent = "画面をタップすると戻ります";
      container.appendChild(hint);
      window.setTimeout(() => hint.remove(), 3600);
    }
  };
  container.__artariumSetViewingMode = setViewingMode;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setViewingMode(true);
  });
  container.addEventListener("click", () => {
    if (container.classList.contains("is-viewing")) setViewingMode(false);
  });
  container.appendChild(button);
}

function exitViewingMode() {
  const viewing = document.querySelector(".daily-artwork.is-viewing");
  viewing?.__artariumSetViewingMode?.(false);
}

// 傾き視差: スマホを傾けると空と植物がわずかにずれて奥行きが出る
const deviceTilt = { x: 0, y: 0, active: false };

function bindDeviceTiltParallax() {
  window.addEventListener("deviceorientation", (event) => {
    if (event.gamma == null || event.beta == null) return;
    deviceTilt.active = true;
    deviceTilt.x = Math.max(-1, Math.min(1, event.gamma / 30));
    deviceTilt.y = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
  });
  // iOSは許可制のため、最初のタップのタイミングで一度だけ許可を求める
  document.addEventListener("pointerdown", () => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }, { once: true });
  // デモ版のみ: 「視差プレビュー」オン中はマウス位置で傾きを疑似再現（PC確認用）
  if (DEMO_MODE) {
    window.addEventListener("mousemove", (event) => {
      if (!demoMouseParallax) return;
      deviceTilt.active = true;
      deviceTilt.x = (event.clientX / window.innerWidth - 0.5) * 2;
      deviceTilt.y = (event.clientY / window.innerHeight - 0.5) * 2;
    });
  }
}

async function startMotionStepCounter() {
  if (!window.DeviceMotionEvent) {
    state.steps.sourceStatus = "この端末ではモーション歩数検知を利用できません。";
    saveProgress();
    render();
    return;
  }

  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") {
        state.steps.sourceStatus = "モーション利用が許可されませんでした。端末の設定から許可できます。";
        saveProgress();
        render();
        return;
      }
    }

    window.addEventListener("devicemotion", handleDeviceMotion);
    state.steps.motionEnabled = true;
    localStorage.setItem(MOTION_AUTO_KEY, "1");
    state.steps.sourceStatus = "簡易歩数計を開始しました。スマホを持って歩くと加算します。";
    saveProgress();
    render();
  } catch (error) {
    console.warn(error);
    state.steps.sourceStatus = "歩数計を開始できませんでした。しばらくして再度お試しください。";
    saveProgress();
    render();
  }
}

// 一度許可された歩数計は次回起動時に自動で再開する。
// iOSは権限リクエストにユーザー操作が必要なため、最初のタップまで待つ
function resumeMotionCounterIfEnabled() {
  if (!localStorage.getItem(MOTION_AUTO_KEY)) return;
  if (!window.DeviceMotionEvent || state.steps.motionEnabled) return;
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    window.addEventListener("pointerdown", () => startMotionStepCounter(), { once: true });
  } else {
    startMotionStepCounter();
  }
}

function handleDeviceMotion(event) {
  const acceleration = event.accelerationIncludingGravity;
  if (!acceleration) return;

  const x = acceleration.x ?? 0;
  const y = acceleration.y ?? 0;
  const z = acceleration.z ?? 0;
  const magnitude = Math.sqrt(
    x ** 2 +
    y ** 2 +
    z ** 2
  );
  const now = Date.now();
  const isStepLikePeak = magnitude > 13.2 && state.steps.lastMagnitude <= 13.2 && now - state.steps.lastStepAt > 320;
  state.steps.lastMagnitude = magnitude;

  if (!isStepLikePeak) return;
  state.steps.lastStepAt = now;
  addStepsToSelectedPlant(1, "簡易歩数計で歩数を検知しています", { throttleRender: true });
}

// 歩行中は1歩ごと（最短320ms間隔）に検知が続く。毎歩フル再描画すると
// 画面がちらつくため（2026-07-30 実機報告）、歩数は即時加算しつつ
// 画面の描き直しは1.2秒に1回へ間引く
let stepRenderTimer = 0;

function scheduleStepRender() {
  if (stepRenderTimer) return;
  stepRenderTimer = window.setTimeout(() => {
    stepRenderTimer = 0;
    render();
  }, 1200);
}

function resetDailyStepsIfNeeded() {
  const today = getTodayKey();
  if (state.steps.date === today) return;
  state.steps.date = today;
  state.steps.todaySteps = 0;
  recordDailySteps();
}

// 日ごとの歩数履歴（直近21日）。週間振り返りに使う
function recordDailySteps() {
  if (!state.steps.history) state.steps.history = {};
  state.steps.history[state.steps.date || getTodayKey()] = state.steps.todaySteps;
  state.steps.history = trimStepHistory(state.steps.history);
}

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

// 直近7日の歩数と成長を1枚のカードで振り返る
const WEEKLY_RECAP_KEY = "artarium-recap-week";

function getWeekKey() {
  const date = new Date();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function openWeeklyRecap() {
  const modal = document.getElementById("weekly-recap-modal");
  if (!modal) return;
  recordDailySteps();
  const history = state.steps.history || {};
  const days = [];
  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({ label: dayLabels[date.getDay()], steps: history[key] || 0 });
  }
  const weekTotal = days.reduce((sum, day) => sum + day.steps, 0);
  const max = Math.max(DAILY_STEP_GOAL, ...days.map((day) => day.steps));
  document.getElementById("weekly-recap-range").textContent = "直近7日間の歩み";
  document.getElementById("weekly-recap-chart").innerHTML = days.map((day) => `
    <div class="recap-day">
      <div class="recap-bar-track"><span class="recap-bar ${day.steps >= DAILY_STEP_GOAL ? "is-goal" : ""}" style="height:${Math.max(3, Math.round((day.steps / max) * 100))}%"></span></div>
      <small>${day.label}</small>
    </div>
  `).join("");
  document.getElementById("weekly-recap-total").textContent = `${formatNumber(weekTotal)}歩`;
  const plant = getSelectedPlant();
  const growthEl = document.getElementById("weekly-recap-growth");
  if (plant) {
    const stage = getStage(state.progress[plant.id].points);
    const STAGE_NAMES = ["", "種", "芽生え", "つぼみ", "ふくらむ蕾", "ほころび", "開花"];
    growthEl.textContent = isPlantComplete(state.progress[plant.id])
      ? `${plant.name} は開花し、作品になりました。`
      : `この歩みで、${plant.name} は「${STAGE_NAMES[stage]}」まで育っています。`;
  } else {
    growthEl.textContent = "";
  }
  modalController.open(modal, { initialFocus: "[data-recap-close]" });
  localStorage.setItem(WEEKLY_RECAP_KEY, getWeekKey());
}

// 日曜の夕方以降に一度だけ、自動でそっと差し出す
function maybeOfferWeeklyRecap() {
  const now = new Date();
  if (now.getDay() !== 0 || now.getHours() < 18) return;
  if (localStorage.getItem(WEEKLY_RECAP_KEY) === getWeekKey()) return;
  if (!getSelectedPlant()) return;
  openWeeklyRecap();
}

function renderSettings() {
  const selectedPlant = getSelectedPlant();
  const selectedProgress = selectedPlant ? state.progress[selectedPlant.id] : null;
  renderSettingsView(document, {
    todaySteps: state.steps.todaySteps,
    sourceStatus: state.steps.sourceStatus,
    motionEnabled: state.steps.motionEnabled,
    selectedPlant,
    selectedPlantComplete: selectedProgress ? isPlantComplete(selectedProgress) : false,
    userName: state.userName,
    demoMode: DEMO_MODE,
    soundEnabled: isSoundEnabled(),
    effectsEnabled: arePlantEffectsEnabled()
  });
  renderDemoModelSettings();
}

function requestUserNameIfNeeded() {
  if (state.userName) return;
  openNameEntryModal();
}

function openNameEntryModal() {
  const modal = document.getElementById("name-entry-modal");
  const input = document.getElementById("name-entry-input");
  if (!modal) return;
  if (input) input.value = state.userName || "";
  const confirmButton = modal.querySelector(".frame-choice-confirm");
  if (confirmButton) confirmButton.textContent = pendingFrameChoiceAfterName ? "この名前で額装へ" : "この名前にする";
  modalController.open(modal, { initialFocus: input });
}

// 共有モーダル（額縁選択・週間振り返り・名前入力）の退場アニメーション付きクローズ。
// 作品詳細モーダルと同じ「入りと出の対称」で畳む（2026-07-24 展開）
function closeModalWithExit(modal, onHidden) {
  if (!modal || modal.hidden) {
    onHidden?.();
    return;
  }
  if (modal.classList.contains("is-closing")) return;
  modal.classList.add("is-closing");
  const finish = () => {
    // 閉じる途中で開き直された場合は何もしない（is-closing が外されている）
    if (!modal.classList.contains("is-closing")) return;
    modal.classList.remove("is-closing");
    modalController.close(modal);
    onHidden?.();
  };
  modal.addEventListener("animationend", () => finish(), { once: true });
  setTimeout(finish, 320);
}

function closeNameEntryModal() {
  const modal = document.getElementById("name-entry-modal");
  closeModalWithExit(modal);
  pendingFrameChoiceAfterName = "";
}

function renderDemoModelSettings() {
  const panel = document.getElementById("demo-model-settings");
  if (!panel) return;
  panel.closest(".daily-home")?.classList.toggle("is-demo-layout", DEMO_MODE);
  panel.hidden = !DEMO_MODE;
  if (!DEMO_MODE) {
    panel.innerHTML = "";
    return;
  }

  const controls = [
    { key: "plantScale", label: "植物サイズ", min: 0.05, max: 8, step: 0.01 },
    { key: "plantX", label: "植物 X", min: -5, max: 5, step: 0.02 },
    { key: "plantY", label: "植物 Y", min: -5, max: 5, step: 0.02 },
    { key: "plantZ", label: "植物 Z", min: -5, max: 5, step: 0.02 },
    { key: "plantRotX", label: "植物 上下角度", min: -6.28, max: 6.28, step: 0.02 },
    { key: "plantRotY", label: "植物 左右角度", min: -6.28, max: 6.28, step: 0.02 },
    { key: "plantRotZ", label: "植物 傾き", min: -6.28, max: 6.28, step: 0.02 },
    { key: "soilScale", label: "土サイズ", min: 0.05, max: 8, step: 0.01 },
    { key: "soilX", label: "土 X", min: -5, max: 5, step: 0.02 },
    { key: "soilY", label: "土 Y", min: -5, max: 5, step: 0.02 },
    { key: "soilZ", label: "土 Z", min: -5, max: 5, step: 0.02 },
    { key: "soilRotX", label: "土 上下角度", min: -6.28, max: 6.28, step: 0.02 },
    { key: "soilRotY", label: "土 左右角度", min: -6.28, max: 6.28, step: 0.02 },
    { key: "soilRotZ", label: "土 傾き", min: -6.28, max: 6.28, step: 0.02 },
    { key: "waterScale", label: "水面 サイズ", min: 0.2, max: 3, step: 0.01 },
    { key: "waterX", label: "水面 X", min: -3, max: 3, step: 0.02 },
    { key: "waterY", label: "水面 高さ", min: -1.5, max: 1.5, step: 0.01 },
    { key: "waterZ", label: "水面 奥行き", min: -3, max: 3, step: 0.02 },
    { key: "waterOpacity", label: "水面 透明度", min: 0, max: 1, step: 0.01 },
    { key: "reflectionOpacity", label: "反射 濃さ", min: 0, max: 2, step: 0.02 },
    { key: "reflectionY", label: "反射 高さ", min: -1.5, max: 1.5, step: 0.01 },
    { key: "reflectionZ", label: "反射 奥行き", min: -2, max: 2, step: 0.02 },
    { key: "reflectionSquash", label: "反射 潰れ具合", min: 0.03, max: 0.8, step: 0.01 },
    { key: "reflectionScale", label: "反射 サイズ", min: 0.2, max: 2, step: 0.01 },
    { key: "shadowOpacity", label: "影 濃さ", min: 0, max: 2, step: 0.02 },
    { key: "shadowLength", label: "影 長さ", min: 0.2, max: 2, step: 0.02 },
    { key: "shadowZ", label: "影 奥行き", min: -1.5, max: 1.5, step: 0.02 }
  ];
  const selectedPlant = getSelectedPlant();
  const selectedProgress = selectedPlant ? state.progress[selectedPlant.id] : null;
  const selectedPlantComplete = selectedProgress ? isPlantComplete(selectedProgress) : false;
  const stageSettings = getModelSettings(state.demoModelSettings, selectedPlant?.id, state.demoModelStage);
  const selectedSoilType = selectedPlant ? getSoilTypeForPlant(selectedPlant, { preferDemo: true }) : "";

  panel.innerHTML = `
    <p class="settings-label">デモ用 3D調整</p>
      <div class="demo-settings-panel">
        <div class="demo-settings-head">
          <span>Stage${state.demoModelStage}を調整中</span>
          <span class="demo-settings-actions">
            <button class="secondary-action" data-demo-model-reset type="button">初期値</button>
            <button class="primary-action" data-demo-model-save type="button">保存</button>
            <button class="primary-action" data-demo-model-apply-production type="button">本番へ反映</button>
            <button class="secondary-action" data-demo-model-open-production type="button">本番で確認</button>
            <button class="secondary-action" data-demo-model-export type="button">調整値を書き出す</button>
          </span>
        </div>
      <div class="demo-stage-tabs" aria-label="成長段階を選択">
        ${Array.from({ length: MODEL_STAGE_COUNT }, (_, index) => index + 1).map((stage) => `
          <button
            class="${stage === state.demoModelStage ? "is-active" : ""}"
            data-demo-model-stage="${stage}"
            type="button"
          >Stage${stage}</button>
        `).join("")}
      </div>
      <label class="demo-control demo-select-control">
        <span>植物</span>
        <select data-demo-plant-select>
          <option value="" ${selectedPlant ? "" : "selected"} disabled>植物を選択</option>
          ${state.plants.map((plant) => `
            <option value="${plant.id}" ${plant.id === selectedPlant?.id ? "selected" : ""}>${plant.name}</option>
          `).join("")}
        </select>
      </label>
      <label class="demo-control demo-select-control">
        <span>土モデル</span>
        <select data-demo-soil-select ${selectedPlant ? "" : "disabled"}>
          ${Object.entries(SOIL_TYPES).map(([type, soil]) => `
            <option value="${type}" ${type === selectedSoilType ? "selected" : ""}>${soil.label}</option>
          `).join("")}
        </select>
      </label>
      <label class="demo-control demo-select-control">
        <span>天気（デバッグ）</span>
        <select data-demo-weather-select>
          <option value="" ${debugWeatherKey ? "" : "selected"}>実際の天気</option>
          ${Object.entries(WEATHER_DEBUG_LABELS).map(([key, label]) => `
            <option value="${key}" ${key === debugWeatherKey ? "selected" : ""}>${label}</option>
          `).join("")}
        </select>
      </label>
      <label class="demo-control demo-select-control">
        <span>季節（デバッグ）</span>
        <select data-demo-season-select>
          <option value="" ${debugSeasonKey ? "" : "selected"}>実際の季節</option>
          <option value="spring" ${debugSeasonKey === "spring" ? "selected" : ""}>春（霞）</option>
          <option value="summer" ${debugSeasonKey === "summer" ? "selected" : ""}>夏（入道雲）</option>
          <option value="autumn" ${debugSeasonKey === "autumn" ? "selected" : ""}>秋（高い空）</option>
          <option value="winter" ${debugSeasonKey === "winter" ? "selected" : ""}>冬（澄んだ星空）</option>
        </select>
      </label>
      <label class="demo-control demo-select-control">
        <span>時間帯（デバッグ）</span>
        <select data-demo-hour-select>
          <option value="" ${debugHourOverride === null ? "selected" : ""}>実時間</option>
          <option value="6" ${debugHourOverride === 6 ? "selected" : ""}>朝6時（朝靄）</option>
          <option value="13" ${debugHourOverride === 13 ? "selected" : ""}>昼13時</option>
          <option value="21" ${debugHourOverride === 21 ? "selected" : ""}>夜21時（蛍・流れ星）</option>
        </select>
      </label>
      <label class="demo-control demo-select-control">
        <span>光の道（歩数達成度）</span>
        <select data-demo-glint-select>
          <option value="" ${debugGlintOverride === null ? "selected" : ""}>実際の歩数</option>
          <option value="0" ${debugGlintOverride === 0 ? "selected" : ""}>0%</option>
          <option value="0.25" ${debugGlintOverride === 0.25 ? "selected" : ""}>25%</option>
          <option value="0.5" ${debugGlintOverride === 0.5 ? "selected" : ""}>50%</option>
          <option value="0.75" ${debugGlintOverride === 0.75 ? "selected" : ""}>75%</option>
          <option value="1" ${debugGlintOverride === 1 ? "selected" : ""}>100%</option>
        </select>
      </label>
      <div class="demo-inline-actions">
        <button class="secondary-action" data-demo-reflection-auto type="button" ${selectedSoilType === "water-surface" ? "" : "disabled"}>反射を自動調整</button>
        <button class="secondary-action" data-demo-bloom-preview type="button">開花演出を再生</button>
        <button class="secondary-action" data-demo-shooting-star type="button">流れ星を流す</button>
        <button class="secondary-action" data-demo-shed-petals type="button">花びらを散らす</button>
        <button class="secondary-action" data-demo-complete-plant type="button" ${!selectedPlant || (selectedPlantComplete && state.demoModelStage === MODEL_STAGE_COUNT) ? "disabled" : ""}>
          ${selectedPlantComplete
            ? state.demoModelStage === MODEL_STAGE_COUNT ? "この植物は完成済み" : "完成済みのStage6を表示"
            : "この植物を完成させる"}
        </button>
        <button class="secondary-action" data-demo-parallax type="button">視差プレビュー: ${demoMouseParallax ? "オン" : "オフ"}</button>
      </div>
      <label class="demo-control">
        <span>連続成長プレビュー: ${Math.round((state.demoStageGrowth ?? 1) * 100)}%（ステージ内の育ち具合）</span>
        <input type="range" min="0" max="100" step="5" value="${Math.round((state.demoStageGrowth ?? 1) * 100)}" data-demo-growth>
      </label>
      ${controls.map((control) => {
        const value = stageSettings[control.key];
        return `
          <label class="demo-control">
            <span>${control.label}</span>
            <input
              data-demo-model-setting="${control.key}"
              type="range"
              min="${control.min}"
              max="${control.max}"
              step="${control.step}"
              value="${value}"
            >
            <span class="demo-number-stepper">
              <input
                class="demo-number"
                data-demo-model-setting="${control.key}"
                type="number"
                min="${control.min}"
                max="${control.max}"
                step="${control.step}"
                value="${Number(value).toFixed(2)}"
              >
              <span class="demo-step-buttons" aria-hidden="true">
                <button data-demo-model-step="${control.key}" data-direction="1" type="button">＋</button>
                <button data-demo-model-step="${control.key}" data-direction="-1" type="button">−</button>
              </span>
            </span>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

// データのバックアップ（2026-07-31 実機での進行データ消失の報告を受けて追加）:
// 進行・作者名・調整オーバーライドをJSONファイルとして書き出し、別の端末や
// 消失後の復元に使えるようにする
function exportArtariumData() {
  const payload = {
    app: "artarium",
    exportedAt: new Date().toISOString(),
    progressState: JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    userName: localStorage.getItem(USER_PROFILE_STORAGE_KEY) || "",
    tunedOverrides: state.tunedOverrides || {}
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `artarium-backup-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  state.steps.sourceStatus = "バックアップを書き出しました";
  render();
}

async function importArtariumData(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.app !== "artarium" || !payload.progressState) {
      alert("Artariumのバックアップファイルではないようです。");
      return;
    }
    if (!confirm("バックアップの内容で現在のデータを置き換えます。よろしいですか？")) return;
    saveProgressState(localStorage, STORAGE_KEY, payload.progressState);
    if (payload.userName) localStorage.setItem(USER_PROFILE_STORAGE_KEY, payload.userName);
    if (payload.tunedOverrides) {
      state.tunedOverrides = payload.tunedOverrides;
      saveTunedOverrides();
    }
    // 読み込んだ状態で開き直す（起動時の移行・焼き込み・オーバーライド適用を通すため）
    window.location.reload();
  } catch (error) {
    console.warn("Backup import failed:", error);
    alert("バックアップの読み込みに失敗しました。ファイルが壊れている可能性があります。");
  }
}

function resetArtariumProgress() {
  if (!confirm("Artariumの進行状況を初期化しますか？")) return;
  clearProgressState(localStorage, STORAGE_KEY); // 予備コピーも消す（残すと再起動で復活する）
  localStorage.removeItem(MOTION_AUTO_KEY);
  state.progress = loadProgress(state.plants, {});
  state.steps = loadStepState({});
  state.selectedPlantId = "";
  state.newlyCompletedPlantId = "";
  state.newlyCollectedPlantId = "";
  state.currentView = "home";
  render();
}

let pendingFrameChoiceAfterName = "";

function openFrameChoice(plantId) {
  const progress = state.progress[plantId];
  if (!progress || !isPlantComplete(progress) || progress.displayed) return;
  if (!state.userName) {
    pendingFrameChoiceAfterName = plantId;
    requestUserNameIfNeeded();
    return;
  }
  state.frameChoicePlantId = plantId;
  renderFrameChoiceModal();
}

let frameConsecrationRunning = false;

function confirmFrameChoice() {
  const plantId = state.frameChoicePlantId;
  const progress = state.progress[plantId];
  if (!progress || frameConsecrationRunning) return;
  const panel = document.querySelector("#frame-choice-modal .frame-choice-panel");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !panel) {
    finalizeFrameChoice(plantId, progress);
    return;
  }
  // 収蔵の儀式: 照明が落ち、金の光が額縁をなぞってから壁へ掛かる
  frameConsecrationRunning = true;
  panel.classList.add("is-consecrating");
  window.setTimeout(() => {
    panel.classList.remove("is-consecrating");
    frameConsecrationRunning = false;
    finalizeFrameChoice(plantId, progress);
  }, 2000);
}

function finalizeFrameChoice(plantId, progress) {
  progress.displayed = true;
  progress.collectedAt = new Date().toISOString();
  markPlantCompleted(progress);
  state.frameChoicePlantId = "";
  state.newlyCompletedPlantId = "";
  state.newlyCollectedPlantId = plantId;
  state.currentView = "gallery";
  saveProgress();
  render();
  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  });
  // 収蔵演出が落ち着いてから、一度だけホーム画面追加を提案する
  window.setTimeout(() => maybeOfferInstallInvite(), 2600);
}

function maybeOfferInstallInvite() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (isStandalone || !deferredInstallPrompt) return;
  if (localStorage.getItem(INSTALL_HINT_KEY)) return;
  if (document.querySelector(".install-invite")) return;
  const invite = document.createElement("div");
  invite.className = "install-invite";
  invite.innerHTML = `
    <p class="eyebrow">Museum in your pocket — いつでも鑑賞</p>
    <p>この庭を、ホーム画面に。開くだけで続きが育ちます。</p>
    <div class="install-invite-actions">
      <button class="primary-action" data-install-accept type="button">ホーム画面に追加</button>
      <button class="secondary-action" data-install-later type="button">あとで</button>
    </div>
  `;
  invite.querySelector("[data-install-accept]").addEventListener("click", async () => {
    const prompt = deferredInstallPrompt;
    dismissInstallInvite();
    if (!prompt) return;
    deferredInstallPrompt = null;
    try {
      await prompt.prompt();
    } catch (error) {
      console.warn(error);
    }
  });
  invite.querySelector("[data-install-later]").addEventListener("click", () => dismissInstallInvite());
  document.body.appendChild(invite);
}

function dismissInstallInvite() {
  localStorage.setItem(INSTALL_HINT_KEY, "1");
  document.querySelector(".install-invite")?.remove();
}

function openGalleryFocus(plantId) {
  const progress = state.progress[plantId];
  if (!progress?.displayed) return;
  state.galleryFocusPlantId = plantId;
  state.galleryFocusAngle = 0;
  renderGalleryFocusModal();
  initGalleryModelViewers();
}

function closeGalleryFocus() {
  const modal = document.getElementById("gallery-focus-modal");
  const finish = () => {
    state.galleryFocusPlantId = "";
    state.galleryFocusAngle = 0;
    renderGalleryFocusModal();
  };
  if (!modal || modal.hidden) {
    finish();
    return;
  }
  if (modal.classList.contains("is-closing")) return;
  // 退場は入場と同じ道を戻る。アニメーションの完了を待ってから畳む
  modal.classList.add("is-closing");
  const onDone = () => {
    // 閉じる途中で開き直された場合は何もしない（is-closing が外されている）
    if (!modal.classList.contains("is-closing")) return;
    finish();
  };
  modal.addEventListener("animationend", onDone, { once: true });
  setTimeout(onDone, 320);
}

// ハイブリッド回転: 絵の中身は指の動きどおりに、額はその一部だけ浅く追従する。
// 追従率は端＋ラバーバンド時でも旧カード傾きの安全圏（±0.13）に収まる値にする
// （額を深く回すと固定の描画領域との境界が黒い枠として見えてしまう）
const GALLERY_FRAME_FOLLOW = 0.24;

function updateGalleryFocusAngle() {
  const stage = document.querySelector("[data-gallery-focus-stage]");
  if (!stage) return;
  stage.dataset.viewYaw = String(state.galleryFocusAngle);
  if (stage.__artariumDisplayGroup && stage.__artariumScene) {
    stage.__artariumDisplayGroup.rotation.y = state.galleryFocusAngle;
    if (stage.__artariumFrameGroup) {
      stage.__artariumFrameGroup.rotation.y = state.galleryFocusAngle * GALLERY_FRAME_FOLLOW;
    }
    stage.__artariumScene.renderer.render(stage.__artariumScene.scene, stage.__artariumScene.camera);
  }
}

// 作品回転の「手で扱う」感触（apple-designスキル §5/§6/§9。2026-07-24）:
// - 指を離した速度を引き継いで回り続け、指数減衰で自然に止まる
// - 端（±LIMIT）は硬い壁で止めず、超えるほど粘る抵抗＋離すとバネで戻る
// - 慣性で回っている最中に掴むと、その場で止まって指に追従する（中断可能）
const GALLERY_FOCUS_ANGLE_LIMIT = 0.38;
let galleryFocusInertiaFrame = 0;

function rubberbandOvershoot(overshoot, range = GALLERY_FOCUS_ANGLE_LIMIT, give = 0.55) {
  return (overshoot * range * give) / (range + give * Math.abs(overshoot));
}

function startGalleryFocusDrag(event, target) {
  event.preventDefault();
  cancelAnimationFrame(galleryFocusInertiaFrame);
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startAngle = state.galleryFocusAngle;
  const history = [{ x: event.clientX, t: performance.now() }];
  target.setPointerCapture?.(pointerId);
  target.classList.add("is-dragging");

  const move = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    const raw = startAngle + (moveEvent.clientX - startX) * 0.004;
    let angle = raw;
    if (raw > GALLERY_FOCUS_ANGLE_LIMIT) {
      angle = GALLERY_FOCUS_ANGLE_LIMIT + rubberbandOvershoot(raw - GALLERY_FOCUS_ANGLE_LIMIT);
    } else if (raw < -GALLERY_FOCUS_ANGLE_LIMIT) {
      angle = -GALLERY_FOCUS_ANGLE_LIMIT + rubberbandOvershoot(raw + GALLERY_FOCUS_ANGLE_LIMIT);
    }
    state.galleryFocusAngle = angle;
    history.push({ x: moveEvent.clientX, t: performance.now() });
    if (history.length > 6) history.shift();
    updateGalleryFocusAngle();
  };
  const stop = (stopEvent) => {
    if (stopEvent.pointerId !== pointerId) return;
    target.releasePointerCapture?.(pointerId);
    target.classList.remove("is-dragging");
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", stop);
    target.removeEventListener("pointercancel", stop);
    // 直近~120msの移動から離した瞬間の速度を求める（角度/ms）
    const now = performance.now();
    const past = history.find((entry) => now - entry.t <= 120) || history[0];
    const dt = Math.max(1, now - past.t);
    const velocity = Math.max(-0.002, Math.min(0.002, ((stopEvent.clientX - past.x) / dt) * 0.004));
    startGalleryFocusInertia(velocity);
  };

  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", stop);
  target.addEventListener("pointercancel", stop);
}

function startGalleryFocusInertia(initialVelocity) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    state.galleryFocusAngle = Math.min(GALLERY_FOCUS_ANGLE_LIMIT, Math.max(-GALLERY_FOCUS_ANGLE_LIMIT, state.galleryFocusAngle));
    updateGalleryFocusAngle();
    return;
  }
  let velocity = initialVelocity;
  let last = performance.now();
  const tick = (now) => {
    if (!document.querySelector("[data-gallery-focus-stage]")) return; // モーダルが閉じたら停止
    const dt = Math.min(48, Math.max(1, now - last));
    last = now;
    let angle = state.galleryFocusAngle + velocity * dt;
    velocity *= Math.pow(0.9955, dt);
    const over = angle > GALLERY_FOCUS_ANGLE_LIMIT ? angle - GALLERY_FOCUS_ANGLE_LIMIT
      : angle < -GALLERY_FOCUS_ANGLE_LIMIT ? angle + GALLERY_FOCUS_ANGLE_LIMIT : 0;
    if (over) {
      velocity *= Math.pow(0.98, dt); // 端の外では強めに減速し
      angle -= over * Math.min(1, dt * 0.012); // バネで境界へ引き戻す
    }
    state.galleryFocusAngle = angle;
    updateGalleryFocusAngle();
    if (Math.abs(velocity) < 0.000012 && Math.abs(over) < 0.0006) {
      state.galleryFocusAngle = Math.min(GALLERY_FOCUS_ANGLE_LIMIT, Math.max(-GALLERY_FOCUS_ANGLE_LIMIT, angle));
      updateGalleryFocusAngle();
      return;
    }
    galleryFocusInertiaFrame = requestAnimationFrame(tick);
  };
  galleryFocusInertiaFrame = requestAnimationFrame(tick);
}

function renderFrameChoiceModal() {
  const modal = document.getElementById("frame-choice-modal");
  if (!modal) return;
  const plant = state.plants.find((item) => item.id === state.frameChoicePlantId);
  const progress = plant ? state.progress[plant.id] : null;
  const shouldOpen = Boolean(plant && progress && !progress.displayed);
  if (!shouldOpen) {
    // 表示中なら退場アニメーションを挟んで畳む（renderは毎フレーム相当で呼ばれるため is-closing で多重実行を防ぐ）
    if (!modal.hidden) closeModalWithExit(modal);
    else modalController.close(modal);
    return;
  }
  modal.classList.remove("is-closing");

  const frameType = progress.frameType ?? plant.defaultFrameType ?? "walnut";
  const backgroundType = "nocturne";
  document.getElementById("frame-choice-title").textContent = "額装を選ぶ";
  document.getElementById("frame-choice-copy").textContent = `${plant.name}をコレクションに飾る準備ができました。`;
  document.getElementById("frame-choice-preview").innerHTML = `
    <div class="choice-preview-art" style="${paletteVars(plant)}${backdropVars(backgroundType)}--frame:${FRAME_TYPES[frameType]?.material ?? "#5a3b25"};">
      <div
        class="model-stage ${plant.id === "pearl-light-bloom" ? "is-pearl-material" : ""}"
        data-model-viewer
        data-stage="6"
        data-plant-id="${plant.id}"
        data-plant-model="${getPlantModelPath(plant, 6)}"
        data-soil-model="${getSoilModelPath(plant)}"
        data-environment="${getEnvironmentTypeForPlant(plant)}"
        data-frame-model="${FRAME_TYPES[frameType]?.modelPath ?? ""}"
        data-frame-type="${frameType}"
        data-backdrop-type="nocturne"
      >
        ${galleryViewerMarkup(plant)}
      </div>
    </div>
    <div class="curation-plate">
      <strong>${getCollectionTitle(plant)}</strong>
      <span>${escapeHtml(state.userName || "Artarium Artist")}</span>
    </div>
  `;
  document.getElementById("frame-choice-options").innerHTML = getFrameOptions(plant).map((type) => `
    <button
      class="choice-option ${type === frameType ? "is-active" : ""}"
      data-frame-choice="${type}"
      type="button"
      aria-pressed="${type === frameType}"
    >
      <span class="frame-swatch" style="--frame:${FRAME_TYPES[type]?.material ?? "#5a3b25"};--frame-deep:${FRAME_TYPES[type]?.materialDeep ?? "#241505"}"></span>
      <strong>${FRAME_TYPES[type]?.jp ?? FRAME_TYPES[type]?.label ?? type}</strong>
    </button>
  `).join("");
  const storyEl = document.getElementById("frame-choice-story");
  if (storyEl) storyEl.textContent = FRAME_TYPES[frameType]?.story ?? "";
  const confirmButton = modal.querySelector("[data-frame-choice-confirm]");
  if (confirmButton) confirmButton.textContent = `「${FRAME_TYPES[frameType]?.jp ?? frameType}」で収蔵する`;
  modalController.open(modal, { initialFocus: "[data-frame-choice-close]" });
  initGalleryModelViewers();
}

function renderGalleryFocusModal() {
  const modal = document.getElementById("gallery-focus-modal");
  if (!modal) return;
  const plant = state.plants.find((item) => item.id === state.galleryFocusPlantId);
  const progress = plant ? state.progress[plant.id] : null;
  const wasHidden = modal.hidden;
  if (!plant || !progress?.displayed) {
    modal.classList.remove("is-opening", "is-closing");
    modal.innerHTML = "";
    modalController.close(modal);
    return;
  }
  if (wasHidden || modal.classList.contains("is-closing")) {
    // 開いた瞬間だけ入場の動きを付ける（開いたままの再描画では動かさない）
    modal.classList.remove("is-closing");
    modal.classList.add("is-opening");
    setTimeout(() => modal.classList.remove("is-opening"), 360);
  }

  const backdropType = progress.backgroundType || "nocturne";
  modal.innerHTML = `
    <div class="gallery-focus-panel" role="dialog" aria-modal="true" aria-labelledby="gallery-focus-title">
      <button class="frame-choice-close" data-gallery-focus-close type="button" aria-label="閉じる">×</button>
      <div
        class="gallery-focus-art"
        data-gallery-focus-drag
        style="${paletteVars(plant)}${backdropVars(backdropType)}"
      >
        <div
          class="model-stage gallery-focus-stage ${plant.id === "pearl-light-bloom" ? "is-pearl-material" : ""}"
          data-gallery-focus-stage
          data-model-viewer
          data-view-yaw="${state.galleryFocusAngle}"
          data-stage="6"
          data-plant-id="${plant.id}"
          data-plant-model="${getPlantModelPath(plant, 6)}"
          data-soil-model="${getSoilModelPath(plant)}"
          data-environment="${getEnvironmentTypeForPlant(plant)}"
          data-frame-model="${getFrameModelPath(plant)}"
          data-frame-type="${progress.frameType}"
          data-backdrop-type="${backdropType}"
          data-settings-source="production"
        >
          ${galleryViewerMarkup(plant)}
        </div>
      </div>
      <div class="artwork-plaque gallery-focus-plaque">
        <div>
          <h3 id="gallery-focus-title">${getCollectionTitle(plant)}</h3>
          <p>${plant.copy?.collectionLabel ?? plant.motif}</p>
          <small>${escapeHtml(getArchiveLine(plant))}</small>
        </div>
      </div>
    </div>
  `;
  modalController.open(modal, { initialFocus: "[data-gallery-focus-close]" });
}

function getFrameLabel(plant) {
  const frameType = state.progress[plant.id]?.frameType ?? plant.defaultFrameType ?? "walnut";
  return FRAME_TYPES[frameType]?.label ?? frameType;
}

function getCollectionStatus(plant) {
  const progress = state.progress[plant.id];
  if (progress.displayed) return { label: "展示中", className: "is-displayed" };
  if (isPlantComplete(progress)) return { label: "開花完了", className: "is-complete" };
  return { label: "制作中", className: "is-in-progress" };
}

function getCollectionTitle(plant) {
  return plant.copy?.collectionTitle ?? plant.copy?.collectionLabel ?? plant.name;
}

function getArchiveLine(plant) {
  const progress = state.progress[plant.id];
  const parts = [state.userName || "Artarium Artist"];
  if (progress?.collectedAt) parts.push(`収蔵 ${formatArchiveDate(progress.collectedAt)}`);
  if (parts.length === 1) parts.push(plant.year);
  return parts.join(" / ");
}

function formatArchiveDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).toUpperCase();
  return `${String(date.getDate()).padStart(2, "0")} ${month} ${date.getFullYear()}`;
}

function paletteVars(plant) {
  return `--c1:${plant.palette[0]};--c2:${plant.palette[1]};--c3:${plant.palette[2]};--c4:${plant.palette[3]};`;
}

function backdropVars(type) {
  const colors = BACKDROP_TYPES[type]?.colors ?? BACKDROP_TYPES.nocturne.colors;
  return `--bg1:${colors[0]};--bg2:${colors[1]};--bg3:${colors[2]};`;
}

function getFrameOptions(plant) {
  // 2026-07-14: 額のラインナップ拡充にあわせ、全植物ですべての額から選べるようにする
  // （plants.json の frameOptions は旧3種のみの記載で残っているため参照しない）
  return Object.keys(FRAME_TYPES);
}

function getFrameModelPath(plant) {
  const frameType = state.progress[plant.id]?.frameType ?? plant.defaultFrameType ?? "walnut";
  return FRAME_TYPES[frameType]?.modelPath ?? "";
}

function getPlantModelPath(plant, stage) {
  const safeStage = String(Math.min(MODEL_STAGE_COUNT, Math.max(1, Number(stage) || 1)));
  return plant.stageModelPaths?.[safeStage] || plant.stageModelPaths?.[Number(safeStage)] || plant.modelPath || "";
}

function getEnvironmentTypeForPlant(plant, options = {}) {
  const explicitSoilType = options.preferDemo ? state.demoSoilAssignments[plant.id] : state.productionSoilAssignments[plant.id];
  if (explicitSoilType && SOIL_TYPES[explicitSoilType]) {
    return SOIL_TYPES[explicitSoilType].environmentType || "soil";
  }
  const soilType = getSoilTypeForPlant(plant, options);
  return SOIL_TYPES[soilType]?.environmentType || plant.environmentType || "soil";
}

function getSoilTypeForPlant(plant, { preferDemo = false } = {}) {
  const candidates = [
    preferDemo ? state.demoSoilAssignments[plant.id] : "",
    state.productionSoilAssignments[plant.id],
    plant.soilType,
    "gallery-loam"
  ];
  return candidates.find((soilType) => SOIL_TYPES[soilType]) || "gallery-loam";
}

function getSoilModelPath(plant, options = {}) {
  const soilType = getSoilTypeForPlant(plant, options);
  return SOIL_TYPES[soilType]?.modelPath || plant.soilModelPath || SOIL_TYPES["gallery-loam"].modelPath;
}

// 3Dモデルを読み込む場合はつなぎのCSS額装を出さない（読み込み完了時のチラつき防止）
// 3D読み込みに失敗したときは restoreGalleryFallback がCSS版を復元する
function galleryViewerMarkup(plant) {
  return getPlantModelPath(plant, 6) ? modelLoadingMarkup() : galleryFallbackMarkup(plant);
}

function restoreGalleryFallback(viewer) {
  if (!viewer?.isConnected) return;
  const plant = getPlantDefinition(viewer.dataset.plantId);
  if (!plant) return;
  viewer.classList.remove("is-3d");
  viewer.innerHTML = galleryFallbackMarkup(plant);
}

function galleryFallbackMarkup(plant) {
  const frameType = state.progress[plant.id]?.frameType ?? plant.defaultFrameType ?? "walnut";
  const frameColor = FRAME_TYPES[frameType]?.material ?? "#5a3b25";
  return `
    <div class="fallback-frame" style="--frame:${frameColor}">
      <div class="abstract-backdrop"></div>
      ${environmentLayerMarkup(plant)}
      <div class="framed-plant">${plantMarkup(6)}</div>
      ${getPlantModelPath(plant, 6) ? modelLoadingMarkup() : ""}
    </div>
  `;
}

function environmentLayerMarkup(plant, options = {}) {
  const environmentType = options.environmentType || getEnvironmentTypeForPlant(plant, options);
  if (environmentType !== "water") return "";
  return `
    <div class="water-environment" aria-hidden="true">
      <span></span>
      <i></i>
      <b></b>
    </div>
  `;
}

async function initGalleryModelViewers() {
  const viewers = Array.from(document.querySelectorAll("[data-model-viewer]:not([data-ready])"));
  if (!viewers.length) return;

  const runtime = await loadThreeRuntime();
  viewers.forEach((viewer) => {
    viewer.dataset.ready = "true";
    const token = String(++modelRenderSerial);
    viewer.dataset.modelRenderToken = token;
    if (!runtime || !viewer.dataset.plantModel) {
      if (!runtime) restoreGalleryFallback(viewer);
      return;
    }
    createGalleryScene(viewer, runtime, token).catch((error) => {
      console.warn("3D gallery fallback:", error);
      restoreGalleryFallback(viewer);
    });
  });
}

async function rerenderModelViewer(viewer) {
  if (!viewer) return;
  delete viewer.dataset.ready;
  viewer.dataset.modelRenderToken = String(++modelRenderSerial);
  viewer.querySelectorAll("canvas:not(.sky-canvas):not(.sky-fx-canvas):not(.water-surface-canvas)").forEach((canvas) => canvas.remove());
  const runtime = await loadThreeRuntime();
  viewer.dataset.ready = "true";
  if (!runtime || !viewer.dataset.plantModel) {
    if (!runtime) restoreGalleryFallback(viewer);
    return;
  }
  createGalleryScene(viewer, runtime, viewer.dataset.modelRenderToken).catch((error) => {
    console.warn("3D gallery rerender fallback:", error);
    restoreGalleryFallback(viewer);
  });
}

async function initHomeModelViewer() {
  const viewer = document.querySelector("[data-home-model-viewer]");
  if (!viewer || viewer.dataset.ready || !viewer.dataset.plantModel) return;

  const runtime = await loadThreeRuntime();
  viewer.dataset.ready = "true";
  const token = String(++modelRenderSerial);
  viewer.dataset.modelRenderToken = token;
  if (!runtime) return;
  createPlantScene(viewer, runtime, token).catch((error) => {
    console.warn("Home 3D fallback:", error);
    renderModelFallback(viewer, token);
  });
}

let seedThumbnailObserver = null;
let seedThumbnailRuntimePromise = null;

function initSeedChoiceThumbnail() {
  seedThumbnailObserver?.disconnect();
  seedThumbnailObserver = null;
  const viewers = Array.from(document.querySelectorAll("[data-seed-thumbnail]:not([data-ready])"));
  if (!viewers.length) return;

  if (!("IntersectionObserver" in window)) {
    viewers.forEach((viewer) => loadSeedChoiceThumbnail(viewer));
    return;
  }

  seedThumbnailObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      loadSeedChoiceThumbnail(entry.target);
    });
  }, { rootMargin: "80px 0px", threshold: 0.01 });
  viewers.forEach((viewer) => seedThumbnailObserver.observe(viewer));
}

async function loadSeedChoiceThumbnail(viewer) {
  if (!viewer?.isConnected || viewer.dataset.ready) return;
  viewer.dataset.ready = "loading";
  seedThumbnailRuntimePromise ||= loadThreeRuntime();
  const runtime = await seedThumbnailRuntimePromise;
  if (!viewer.isConnected) return;
  const token = String(++modelRenderSerial);
  viewer.dataset.modelRenderToken = token;
  if (!runtime || !viewer.dataset.plantModel) {
    viewer.dataset.ready = "true";
    viewer.innerHTML = plantMarkup(1);
    return;
  }
  createPlantScene(viewer, runtime, token).then(() => {
    if (viewer.isConnected) viewer.dataset.ready = "true";
  }).catch((error) => {
    console.warn("Seed thumbnail fallback:", error);
    viewer.dataset.ready = "true";
    viewer.innerHTML = plantMarkup(1);
  });
}

async function loadThreeRuntime() {
  if ("artariumThreeRuntime" in window) return window.artariumThreeRuntime;

  const sources = [
    {
      three: "./vendor/three.module.js",
      loader: "./vendor/GLTFLoader.js"
    },
    {
      three: `https://esm.sh/three@${THREE_CDN_VERSION}`,
      loader: `https://esm.sh/three@${THREE_CDN_VERSION}/examples/jsm/loaders/GLTFLoader.js`
    }
  ];

  for (const source of sources) {
    try {
      const [THREE, loaderModule] = await Promise.all([
        import(source.three),
        import(source.loader)
      ]);
      window.artariumThreeRuntime = { THREE, GLTFLoader: loaderModule.GLTFLoader };
      return window.artariumThreeRuntime;
    } catch (error) {
      console.warn("Three.js runtime unavailable:", source.three, error);
    }
  }

  window.artariumThreeRuntime = null;
  return null;
}

async function createGalleryScene(container, runtime, token) {
  const { THREE, GLTFLoader } = runtime;
  const loader = new GLTFLoader();
  const modelSettings = getSceneModelSettings(container.dataset.stage, container.dataset.plantId, {
    preferProduction: container.dataset.settingsSource === "production"
  });
  const environmentType = container.dataset.environment || "soil";
  const plantDefinition = state.plants.find((plant) => plant.id === container.dataset.plantId);
  // 額はすべて手続き生成（2026-07-14）のため、GLBの額は読み込まない。
  // 旧実装は未使用のまま読み込んでおり、存在しない額GLBへの404と無駄な転送が出ていた（2026-07-29 掃除）
  const [plantModel, soilModel] = await Promise.all([
    loadGltf(loader, container.dataset.plantModel),
    // 額の中は「描かれた絵」として見せる: 土植物は3Dの土を置かず、
    // 背景に描いた大地と足元の影で受ける（2026-07-14。水面植物は従来どおり）
    environmentType === "water" ? loadSoilAsset(THREE, loader, container.dataset.soilModel) : Promise.resolve(null)
  ]);
  if (!isCurrentModelRender(container, token)) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const oldCanvases = Array.from(container.querySelectorAll("canvas:not(.sky-canvas):not(.sky-fx-canvas):not(.water-surface-canvas)"));
  if (!isCurrentModelRender(container, token)) return;
  container.appendChild(renderer.domElement);
  container.classList.add("is-3d");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.55, 5.2);

  scene.add(new THREE.AmbientLight(0xffffff, 1.8));
  const sunLighting = getSunLighting(THREE);
  const keyLight = new THREE.DirectionalLight(sunLighting.color, 2.2);
  keyLight.position.copy(sunLighting.position);
  scene.add(keyLight);
  addArtworkMaterialLights(THREE, scene, plantDefinition);

  // 額はCSSの額（.fallback-frame）とシーン内の手続き生成で描く。
  // GLBの額は箱の奥行きが深く、作品と重ねると板が植物を隠すため使わない
  const frame = null;
  container.classList.toggle("has-frame-model", false);
  const plant = normalizeModel(THREE, plantModel.scene, modelSettings.plantScale);
  preparePlantSurfaceModel(THREE, plant, plantDefinition, Number(container.dataset.stage) || 1);
  const reflectionPlant = environmentType === "water" ? prepareReflectionModel(THREE, plant.clone(true), Number(container.dataset.stage) || 1, modelSettings) : null;
  const waterSurface = environmentType === "water" ? createShaderWaterSurface(THREE, plantDefinition, modelSettings, { framed: true }) : null;
  const soil = environmentType !== "water" && soilModel ? normalizeModel(THREE, soilModel.scene, modelSettings.soilScale) : null;
  if (soil) prepareSoilModel(THREE, soil, plantDefinition);
  const displayGroup = new THREE.Group();
  const artworkGroup = new THREE.Group();
  const plantGroup = createTunedModelGroup(THREE, plant, {
    x: modelSettings.plantX,
    y: modelSettings.plantY,
    z: modelSettings.plantZ,
    pitch: modelSettings.plantRotX,
    yaw: modelSettings.plantRotY,
    roll: modelSettings.plantRotZ
  });
  let soilGroup = null;
  if (soil) {
    soilGroup = createTunedModelGroup(THREE, soil, {
      x: modelSettings.soilX,
      y: modelSettings.soilY,
      z: modelSettings.soilZ,
      pitch: modelSettings.soilRotX,
      yaw: modelSettings.soilRotY,
      roll: modelSettings.soilRotZ
    });
    artworkGroup.add(soilGroup);
  }
  if (waterSurface) {
    artworkGroup.add(waterSurface.mesh);
  } else if (environmentType === "water") {
    artworkGroup.add(createWaterEnvironmentGroup(THREE, plantDefinition, modelSettings, { framed: true }));
  }
  let reflectionGroup = null;
  if (reflectionPlant) {
    reflectionGroup = createWaterReflectionGroup(THREE, reflectionPlant, modelSettings, { framed: true });
    artworkGroup.add(reflectionGroup);
  }
  artworkGroup.add(plantGroup);
  const plantEffects = !arePlantEffectsEnabled() ? null : createPlantEffects(THREE, plantDefinition, plantGroup, {
    x: modelSettings.plantX,
    y: modelSettings.plantY,
    z: modelSettings.plantZ,
    reflection: reflectionGroup,
    waterY: waterSurface ? waterSurface.mesh.position.y : undefined,
    onPetalLand: createPetalLandHandler(waterSurface)
  }, Number(container.dataset.stage) || 1);
  if (plantEffects) artworkGroup.add(plantEffects.group);
  displayGroup.add(artworkGroup);
  // ドラッグ回転は額（frameGroup）でなく絵の中身にだけ掛ける
  artworkGroup.rotation.y = Number(container.dataset.viewYaw) || 0;
  scene.add(displayGroup);
  container.__artariumDisplayGroup = artworkGroup;
  container.__artariumScene = { renderer, scene, camera };

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  resize();
  // 額縁: 開口をキャンバスいっぱいに取り、作品側（縮小率・持ち上げ量・
  // 水面の寸法）を開口に合わせて調整して額装する。植物が開口から
  // はみ出す場合は、収まるまで縮小率を自動で下げる（全植物対応）
  if (container.dataset.frameType) {
    const fovK = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = Math.max(0.4, camera.aspect || 1);
    const camY = camera.position.y;
    const camZ = camera.position.z;
    const plantBoxLocal = new THREE.Box3().setFromObject(plantGroup);
    // 仮の開口幅（植物基準）を出してから、水面・土台を箱に収まる寸法へ縮める
    // （幅・奥行きとも。着水UVは surfaceSize 経由で追随する）
    const provisionalDist = Math.max(0.5, camZ - (plantBoxLocal.max.z * 0.95 + 0.4));
    const provisionalInnerW = (2 * fovK * provisionalDist * aspect - 0.06) / 1.15;
    if (waterSurface) {
      const worldWaterW = waterSurface.surfaceSize.width * 0.95;
      if (worldWaterW > provisionalInnerW + 0.15) {
        const shrink = (provisionalInnerW + 0.15) / worldWaterW;
        waterSurface.mesh.scale.x *= shrink;
        waterSurface.surfaceSize.width *= shrink;
      }
      const worldWaterD = waterSurface.surfaceSize.depth * 0.95;
      if (worldWaterD > provisionalInnerW * 1.05) {
        const shrinkZ = (provisionalInnerW * 1.05) / worldWaterD;
        waterSurface.mesh.scale.y *= shrinkZ;
        waterSurface.surfaceSize.depth *= shrinkZ;
      }
    }
    let soilBoxLocal = null;
    if (soilGroup) {
      soilBoxLocal = new THREE.Box3().setFromObject(soilGroup);
      const soilW = (soilBoxLocal.max.x - soilBoxLocal.min.x) * 0.95;
      if (soilW > provisionalInnerW + 0.12) {
        soilGroup.scale.x *= (provisionalInnerW + 0.12) / soilW;
      }
      const soilD = (soilBoxLocal.max.z - soilBoxLocal.min.z) * 0.95;
      if (soilD > provisionalInnerW * 1.05) {
        soilGroup.scale.z *= (provisionalInnerW * 1.05) / soilD;
      }
      soilBoxLocal = new THREE.Box3().setFromObject(soilGroup);
    }
    // 縮小率 s に対する額の寸法一式（開口は常にキャンバスいっぱい）
    // 基準の高さ: 水辺は水面、土の植物は土台の底、その他は植物の根元
    const anchorLocal = waterSurface
      ? waterSurface.mesh.position.y
      : (soilBoxLocal ? soilBoxLocal.min.y : plantBoxLocal.min.y);
    const computeDims = (s) => {
      const waterHalf = waterSurface ? (waterSurface.surfaceSize.depth * s) / 2 : 0;
      const contentFrontZ = Math.max(
        waterSurface ? waterSurface.mesh.position.z * s + waterHalf : -Infinity,
        soilBoxLocal ? soilBoxLocal.max.z * s : -Infinity,
        plantBoxLocal.max.z * s
      );
      const waterBackZ = Math.min(
        waterSurface ? waterSurface.mesh.position.z * s - waterHalf : Infinity,
        soilBoxLocal ? soilBoxLocal.min.z * s : Infinity,
        plantBoxLocal.min.z * s
      );
      const frontZ = Math.max(plantBoxLocal.max.z * s + 0.4, contentFrontZ + 0.22);
      const dist = Math.max(0.5, camZ - frontZ);
      const viewH = 2 * fovK * dist;
      // 額の外周がちょうど画面端に収まるように開口と見付け幅を決める
      // （見付け = 開口の7.5% なので innerW * 1.15 ≒ viewW）
      const innerW = (viewH * aspect - 0.06) / 1.15;
      const bar = Math.max(0.1, innerW * 0.075);
      const bottomY = camY - viewH / 2 + bar + 0.03;
      const innerH = camY + viewH / 2 - bar - 0.03 - bottomY;
      // 水面（土の植物は根元）が開口の下端の少し上に来るように持ち上げる
      const lift = bottomY + 0.16 - anchorLocal * s;
      return { frontZ, innerW, innerH, bottomY, lift, waterBackZ };
    };
    let artScale = 0.95;
    let dims = computeDims(artScale);
    for (let i = 0; i < 4; i++) {
      // 植物のバウンディングボックス8隅を額の面へ投影し、開口への収まりを見る
      let maxProjY = -Infinity;
      let maxProjX = 0;
      const b = plantBoxLocal;
      for (const cornerX of [b.min.x, b.max.x]) {
        for (const cornerY of [b.min.y, b.max.y]) {
          for (const cornerZ of [b.min.z, b.max.z]) {
            const wy = cornerY * artScale + dims.lift;
            const wz = cornerZ * artScale;
            const k = (camZ - dims.frontZ) / Math.max(0.1, camZ - wz);
            maxProjX = Math.max(maxProjX, Math.abs(cornerX * artScale * k));
            maxProjY = Math.max(maxProjY, camY + (wy - camY) * k);
          }
        }
      }
      const anchorY = dims.bottomY + 0.16;
      const fitH = (dims.bottomY + dims.innerH - 0.1 - anchorY) / Math.max(0.01, maxProjY - anchorY);
      const fitW = (dims.innerW / 2 - 0.1) / Math.max(0.01, maxProjX);
      const fit = Math.min(fitH, fitW);
      if (fit >= 1) break;
      artScale = Math.max(0.35, artScale * fit);
      dims = computeDims(artScale);
    }
    artworkGroup.scale.setScalar(artScale);
    artworkGroup.position.y += dims.lift;
    // 花びらは通常は最前面に描くが、額装内では額のバーに正しく隠れるよう
    // 奥行き判定を戻す
    if (plantEffects) {
      plantEffects.group.traverse((obj) => {
        if (obj.material) obj.material.depthTest = true;
      });
    }
    const frameGroup = buildShadowBoxFrame(THREE, container.dataset.frameType, {
      innerW: dims.innerW,
      innerH: dims.innerH,
      centerX: 0,
      bottomY: dims.bottomY,
      frontZ: dims.frontZ,
      boxDepth: dims.frontZ - dims.waterBackZ + 0.25,
      backTexture: getPaintedBackdropTexture(THREE, plantDefinition)
    });
    displayGroup.add(frameGroup);
    // ハイブリッド回転（2026-07-30 ユーザー選択）: 額もドラッグにわずかに追従する
    container.__artariumFrameGroup = frameGroup;
    frameGroup.rotation.y = (Number(container.dataset.viewYaw) || 0) * GALLERY_FRAME_FOLLOW;
    container.classList.add("has-procedural-frame");
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(container);
  renderer.render(scene, camera);
  removeOldCanvases(oldCanvases);
  if (waterSurface) {
    attachWaterPointerRipples(THREE, renderer, camera, waterSurface);
  } else if (plantEffects) {
    attachPetalTapBurst(renderer);
  }
  if (waterSurface || plantEffects) {
    startSceneAnimationLoop(container, token, renderer, scene, camera, { waterSurface, plantEffects });
  }

  // 拡大表示（フォーカス）のドラッグ回転はモーダル側の startGalleryFocusDrag が担う
  // （慣性つき。旧トレーディングカード式の傾きは二重操作になるため廃止。2026-07-29）。
  // 額は壁に掛かったまま動かさず、絵の中身（artworkGroup）だけが視差で動く —
  // 額ごと回すと固定の描画領域との境界が見えて違和感が出るため
  if (container.classList.contains("gallery-focus-stage")) {
    renderer.domElement.style.cursor = "grab";
  }
}

function mountSeedSpecimenMotion(container, token, renderer, scene, camera, plantGroup, settings) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rotationStartedAt = performance.now();
  const rotationDuration = 12000;
  const restingRotation = {
    x: plantGroup.rotation.x,
    y: plantGroup.rotation.y,
    z: plantGroup.rotation.z
  };
  let plantingStart = 0;
  let plantingOrigin = null;
  let plantingResolve = null;

  container.__artariumSeedPreview = {
    plant: (onLand) => {
      if (reduceMotion) {
        plantGroup.position.y = settings.plantedY - 0.18;
        plantGroup.scale.setScalar(settings.plantedScale * 0.45);
        renderer.render(scene, camera);
        onLand?.();
        return Promise.resolve();
      }
      if (!plantingStart) {
        plantingStart = performance.now();
        plantingOrigin = {
          y: plantGroup.position.y,
          rotationX: plantGroup.rotation.x,
          rotationY: plantGroup.rotation.y,
          rotationZ: plantGroup.rotation.z
        };
        plantingOrigin.onLand = onLand;
        plantingOrigin.hasLanded = false;
      }
      return new Promise((resolve) => { plantingResolve = resolve; });
    }
  };

  const frame = (now) => {
    if (!isCurrentModelRender(container, token) || container.dataset.seedPreview !== "true") return;
    if (plantingStart) {
      const elapsed = now - plantingStart;
      const descentProgress = Math.min(1, elapsed / 1200);
      const eased = descentProgress < 0.5
        ? 4 * descentProgress * descentProgress * descentProgress
        : 1 - Math.pow(-2 * descentProgress + 2, 3) / 2;
      const sinkProgress = Math.min(1, Math.max(0, elapsed - 1200) / 420);
      const sinkEased = 1 - Math.pow(1 - sinkProgress, 3);
      plantGroup.position.y = plantingOrigin.y
        + (settings.plantedY - plantingOrigin.y) * eased
        - 0.18 * sinkEased;
      const landedScale = 1 + (settings.plantedScale - 1) * eased;
      const scale = landedScale * (1 - 0.55 * sinkEased);
      plantGroup.scale.setScalar(scale);
      // 落下中に正面角へ巻き戻すと、開始角によって高速逆回転になる。
      // 押した瞬間の向きを保ち、種が静かに沈むことだけを見せる。
      plantGroup.rotation.x = plantingOrigin.rotationX;
      plantGroup.rotation.y = plantingOrigin.rotationY;
      plantGroup.rotation.z = plantingOrigin.rotationZ;
      if (descentProgress >= 1 && !plantingOrigin.hasLanded) {
        plantingOrigin.hasLanded = true;
        plantingOrigin.onLand?.();
      }
      if (sinkProgress >= 1) {
        renderer.render(scene, camera);
        plantingResolve?.();
        plantingResolve = null;
        return;
      }
    } else if (!reduceMotion) {
      const rotationProgress = ((now - rotationStartedAt) % rotationDuration) / rotationDuration;
      plantGroup.position.y = settings.previewY;
      plantGroup.rotation.x = restingRotation.x;
      plantGroup.rotation.y = restingRotation.y + rotationProgress * Math.PI * 2;
      plantGroup.rotation.z = restingRotation.z;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// 額縁: GLBを使わず、カメラ可視範囲に合わせてコードで組み立てるシャドーボックス。
// 見付け（前面の枠板）は開口の外から画面端の先まで覆い、外側の水面などを隠す。
// 額の中の「絵の具の背景」: 植物のパレットを淡い光の靄として重ね、
// 一枚一枚を絵画として見せる（波の花なら藍の夜、ひまわりなら暖色の靄）
const paintedBackdropCache = new Map();

function getPaintedBackdropTexture(THREE, plant) {
  const key = plant?.id ?? "default";
  if (paintedBackdropCache.has(key)) return paintedBackdropCache.get(key);
  const palette = Array.isArray(plant?.palette) && plant.palette.length >= 4
    ? plant.palette
    : ["#22303a", "#31424e", "#1a2530", "#101820"];
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const deepBase = new THREE.Color(palette[3]).lerp(new THREE.Color("#0a0d0d"), 0.45);
  ctx.fillStyle = `#${deepBase.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  // 色の置き場所は固定（開くたびに絵が変わらないように）
  const washes = [
    { c: palette[0], x: 0.3, y: 0.26, r: 0.55, a: 0.32 },
    { c: palette[1], x: 0.74, y: 0.42, r: 0.48, a: 0.24 },
    { c: palette[2], x: 0.44, y: 0.78, r: 0.6, a: 0.2 },
    { c: palette[0], x: 0.64, y: 0.1, r: 0.34, a: 0.14 }
  ];
  for (const wash of washes) {
    const color = new THREE.Color(wash.c);
    const gradient = ctx.createRadialGradient(wash.x * size, wash.y * size, 0, wash.x * size, wash.y * size, wash.r * size);
    gradient.addColorStop(0, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${wash.a})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  // 描かれた大地: 下部にパレットと土色を混ぜた帯。3Dの土の代わりに、絵の中で植物を受ける
  const earth = new THREE.Color(palette[2]).lerp(new THREE.Color("#3a2c1e"), 0.55);
  const earthDeep = earth.clone().lerp(new THREE.Color("#120d08"), 0.55);
  const rgba = (c, a) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
  const groundTop = size * 0.6;
  const groundGrad = ctx.createLinearGradient(0, groundTop - size * 0.12, 0, size);
  groundGrad.addColorStop(0, rgba(earth, 0));
  groundGrad.addColorStop(0.3, rgba(earth, 0.55));
  groundGrad.addColorStop(1, rgba(earthDeep, 0.9));
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundTop - size * 0.12, size, size);
  // 大地の筆あと（置き場所は固定。開くたびに絵が変わらないように）
  const strokes = [
    { x: 0.08, y: 0.66, w: 0.5, a: 0.1, light: true },
    { x: 0.42, y: 0.71, w: 0.44, a: 0.12, light: false },
    { x: 0.18, y: 0.77, w: 0.62, a: 0.1, light: true },
    { x: 0.55, y: 0.83, w: 0.4, a: 0.14, light: false },
    { x: 0.05, y: 0.88, w: 0.55, a: 0.1, light: false },
    { x: 0.3, y: 0.93, w: 0.5, a: 0.08, light: true }
  ];
  for (const s of strokes) {
    const tone = s.light ? earth.clone().lerp(new THREE.Color("#c9b08a"), 0.35) : earthDeep;
    ctx.fillStyle = rgba(tone, s.a);
    ctx.beginPath();
    ctx.ellipse((s.x + s.w / 2) * size, s.y * size, (s.w / 2) * size, size * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 足元の影: 植物が立つあたりへごく淡い楕円の陰を落とし、絵として接地させる
  const shadow = ctx.createRadialGradient(size * 0.5, size * 0.64, 0, size * 0.5, size * 0.64, size * 0.3);
  shadow.addColorStop(0, "rgba(8, 6, 4, 0.34)");
  shadow.addColorStop(1, "rgba(8, 6, 4, 0)");
  ctx.save();
  ctx.translate(size * 0.5, size * 0.64);
  ctx.scale(1, 0.22);
  ctx.translate(-size * 0.5, -size * 0.64);
  ctx.fillStyle = shadow;
  ctx.fillRect(0, size * 0.64 - size * 0.3, size, size * 0.6);
  ctx.restore();

  // 画布の質感（ごく薄い横糸）と周辺減光
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = `rgba(255, 250, 240, ${Math.random() * 0.016})`;
    ctx.fillRect(0, y, size, 1);
  }
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.78);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  paintedBackdropCache.set(key, texture);
  return texture;
}

// 手続き生成の木目テクスチャ（額タイプ×木目方向でキャッシュ）。
// 単色のCG材質が安っぽさの原因だったため、濃淡の筋で無垢材の表情を作る
const frameWoodTextureCache = new Map();

function getFrameWoodTexture(THREE, frameType, vertical) {
  const key = `${frameType}-${vertical ? "v" : "h"}`;
  if (frameWoodTextureCache.has(key)) return frameWoodTextureCache.get(key);
  const spec = FRAME_TYPES[frameType] ?? {};
  const base = new THREE.Color(spec.material ?? "#5a3b25");
  const deep = new THREE.Color(spec.materialDeep ?? "#241505");
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rgba = (c, a) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  const finish = spec.finish ?? "wood";
  if (finish === "gold" || finish === "silver") {
    // 箔: 正方形の箔を貼り継いだトーン差 + 継ぎ目 + 経年のパティナ
    const cells = 4;
    const cell = size / cells;
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        ctx.fillStyle = rgba(base.clone().lerp(deep, Math.random() * 0.3), 0.5);
        ctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
    }
    ctx.strokeStyle = rgba(deep, 0.3);
    ctx.lineWidth = 1;
    for (let i = 1; i < cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * size; const y = Math.random() * size;
      const r = 18 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(deep, 0.1 + Math.random() * 0.14));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  } else if (finish === "gesso") {
    // 石膏の白: 漆喰の細かい粒と刷毛の流れ
    for (let i = 0; i < 1400; i++) {
      const dark = Math.random() < 0.5;
      ctx.fillStyle = dark ? rgba(deep, 0.05 + Math.random() * 0.06) : "rgba(255,255,252,0.06)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = rgba(deep, 0.03 + Math.random() * 0.03);
      ctx.fillRect(0, Math.random() * size, size, 2 + Math.random() * 5);
    }
  } else {
    // 木目（ebonyはコントラストを抑えた細目の黒檀）
    const streaks = finish === "ebony" ? 70 : 46;
    for (let i = 0; i < streaks; i++) {
      const grain = base.clone().lerp(deep, 0.25 + Math.random() * 0.75);
      const alpha = finish === "ebony" ? 0.08 + Math.random() * 0.12 : 0.12 + Math.random() * 0.24;
      ctx.fillStyle = rgba(grain, alpha);
      ctx.fillRect(Math.random() * size, 0, 1 + Math.random() * (finish === "ebony" ? 3 : 5), size);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(255, 245, 225, ${finish === "ebony" ? 0.02 + Math.random() * 0.03 : 0.04 + Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * size, 0, 1 + Math.random() * 2, size);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (!vertical) {
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
  }
  frameWoodTextureCache.set(key, texture);
  return texture;
}

function buildShadowBoxFrame(THREE, frameType, { innerW, innerH, centerX, bottomY, frontZ, faceW, faceH, boxDepth, backTexture }) {
  const spec = FRAME_TYPES[frameType] ?? {};
  const frameColor = new THREE.Color(spec.material ?? "#5a3b25");
  const group = new THREE.Group();
  const barDepth = 0.18;                 // 額の前後厚
  const depth = Math.max(0.6, boxDepth ?? 1.15); // 箱の奥行き
  const cx = centerX;
  const cy = bottomY + innerH / 2;
  // faceW/faceH 指定時は画面端まで覆う面、未指定なら壁に掛かる有限幅の額
  const margin = 0.7; // 回転しても画面端から外が見えない余白
  const finiteBar = Math.max(0.1, innerW * 0.075);
  const barX = faceW ? Math.max(0.12, (faceW - innerW) / 2 + margin) : finiteBar;
  const barY = faceH ? Math.max(0.12, (faceH - innerH) / 2 + margin) : finiteBar;
  const outerW = innerW + barX * 2;
  const faceZ = frontZ - barDepth / 2;

  // 仕上げ別の材質: 木・黒檀・金箔・古銀・石膏白はテクスチャ＋乗算トーン、漆黒はラッカー
  // （テクスチャ×colorの乗算で材色を決める。シーンの照明が強く色が飛ぶため暗めに乗算して戻す）
  const finish = spec.finish ?? "wood";
  const isLacquer = finish === "lacquer";
  const finishLook = {
    wood: { tone: "#8f867a", metalness: 0.1, roughness: 0.58 },
    ebony: { tone: "#6f6a62", metalness: 0.18, roughness: 0.42 },
    gold: { tone: "#eeda9e", metalness: 0.82, roughness: 0.34 },
    silver: { tone: "#c8cdd2", metalness: 0.85, roughness: 0.4 },
    gesso: { tone: "#efece4", metalness: 0.02, roughness: 0.88 }
  }[finish] ?? { tone: "#8f867a", metalness: 0.1, roughness: 0.58 };
  const frameMatH = isLacquer
    ? new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.42, roughness: 0.3 })
    : new THREE.MeshStandardMaterial({ map: getFrameWoodTexture(THREE, frameType, false), color: new THREE.Color(finishLook.tone), metalness: finishLook.metalness, roughness: finishLook.roughness });
  const frameMatV = isLacquer
    ? frameMatH
    : new THREE.MeshStandardMaterial({ map: getFrameWoodTexture(THREE, frameType, true), color: new THREE.Color(finishLook.tone), metalness: finishLook.metalness, roughness: finishLook.roughness });
  // 内縁の細縁: 金が基本。金箔の額は影色の古金、古銀は銀、黒檀は金を太く効かせる
  const lipColor = finish === "gold" ? "#8a6b2c" : finish === "silver" ? "#b9bfc4" : "#c2a45e";
  const lipMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(lipColor), metalness: 0.75, roughness: 0.35 });
  // 内壁は暗く沈める: 明るい内壁は箱の奥行きを強調しすぎる（実際の標本箱の内側も暗色）
  const wallMat = new THREE.MeshStandardMaterial({ color: frameColor.clone().multiplyScalar(0.13), metalness: 0.05, roughness: 0.95 });
  // 背板: 絵の具の背景があれば「描かれたカンヴァス」として照明の影響を受けない材質で貼る
  const backMat = backTexture
    ? new THREE.MeshBasicMaterial({ map: backTexture })
    : new THREE.MeshStandardMaterial({ color: new THREE.Color("#0d1410"), roughness: 1 });
  const matBoardMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#ece5d3"), metalness: 0, roughness: 0.95 });

  const addBox = (w, h, d, x, y, z, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };

  // 額の4辺（開口の外側を画面端まで覆う）。横木は横目・縦木は縦目
  addBox(outerW, barY, barDepth, cx, cy + innerH / 2 + barY / 2, faceZ, frameMatH);
  addBox(outerW, barY, barDepth, cx, cy - innerH / 2 - barY / 2, faceZ, frameMatH);
  addBox(barX, innerH, barDepth, cx - innerW / 2 - barX / 2, cy, faceZ, frameMatV);
  addBox(barX, innerH, barDepth, cx + innerW / 2 + barX / 2, cy, faceZ, frameMatV);
  // 段プロファイル: 開口寄りに一段高い立ち上がりを足し、平板ではなく彫りのある額にする
  const stepW = Math.min(barX, barY) * 0.34;
  const stepRise = 0.05;
  const stepZ = faceZ + barDepth / 2 + stepRise / 2;
  addBox(innerW + stepW * 2, stepW, stepRise, cx, cy + innerH / 2 + stepW / 2, stepZ, frameMatH);
  addBox(innerW + stepW * 2, stepW, stepRise, cx, cy - innerH / 2 - stepW / 2, stepZ, frameMatH);
  addBox(stepW, innerH, stepRise, cx - innerW / 2 - stepW / 2, cy, stepZ, frameMatV);
  addBox(stepW, innerH, stepRise, cx + innerW / 2 + stepW / 2, cy, stepZ, frameMatV);
  // 開口の内側に走る金の細縁（純黒ミニマルの額は張らない）
  const lip = Math.max(0.045, innerW * 0.025) * (finish === "ebony" ? 1.7 : 1);
  if (spec.lip !== false) {
    const lipZ = frontZ - barDepth - lip / 2;
    addBox(innerW, lip, lip, cx, cy + innerH / 2 - lip / 2, lipZ, lipMat);
    addBox(innerW, lip, lip, cx, cy - innerH / 2 + lip / 2, lipZ, lipMat);
    addBox(lip, innerH, lip, cx - innerW / 2 + lip / 2, cy, lipZ, lipMat);
    addBox(lip, innerH, lip, cx + innerW / 2 - lip / 2, cy, lipZ, lipMat);
  }
  // マット紙: 金縁のすぐ奥に沈むアイボリーの台紙（浮かぶ楓は「光の隙間」が売りなので入れない）
  if (spec.matBoard) {
    const matB = Math.max(0.09, innerW * 0.085);
    const matZ = frontZ - barDepth - lip - 0.012;
    addBox(innerW, matB, 0.024, cx, cy + innerH / 2 - matB / 2, matZ, matBoardMat);
    addBox(innerW, matB, 0.024, cx, cy - innerH / 2 + matB / 2, matZ, matBoardMat);
    addBox(matB, innerH - matB * 2, 0.024, cx - innerW / 2 + matB / 2, cy, matZ, matBoardMat);
    addBox(matB, innerH - matB * 2, 0.024, cx + innerW / 2 - matB / 2, cy, matZ, matBoardMat);
    // マットの面取り: 開口部の斜めカットが作る細い陰影線（実物のマット紙の証）
    const bevelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#c7bda6"), metalness: 0, roughness: 0.95 });
    const bevel = 0.018;
    const openW = innerW - matB * 2;
    const openH = innerH - matB * 2;
    const bevelZ = matZ - 0.014;
    addBox(openW + bevel * 2, bevel, 0.02, cx, cy + openH / 2 + bevel / 2, bevelZ, bevelMat);
    addBox(openW + bevel * 2, bevel, 0.02, cx, cy - openH / 2 - bevel / 2, bevelZ, bevelMat);
    addBox(bevel, openH, 0.02, cx - openW / 2 - bevel / 2, cy, bevelZ, bevelMat);
    addBox(bevel, openH, 0.02, cx + openW / 2 + bevel / 2, cy, bevelZ, bevelMat);
  }
  // 箱の側壁と背板（回転したときに立体標本らしく見える）
  const wallT = 0.06;
  const wallLen = depth - barDepth;
  const wallZ = frontZ - barDepth - wallLen / 2;
  addBox(innerW + wallT * 2, wallT, wallLen, cx, cy + innerH / 2 + wallT / 2, wallZ, wallMat);
  addBox(innerW + wallT * 2, wallT, wallLen, cx, cy - innerH / 2 - wallT / 2, wallZ, wallMat);
  addBox(wallT, innerH, wallLen, cx - innerW / 2 - wallT / 2, cy, wallZ, wallMat);
  addBox(wallT, innerH, wallLen, cx + innerW / 2 + wallT / 2, cy, wallZ, wallMat);
  addBox(innerW + wallT * 2, innerH + wallT * 2, 0.05, cx, cy, frontZ - depth, backMat);
  return group;
}

async function createPlantScene(container, runtime, token) {
  const { THREE, GLTFLoader } = runtime;
  const loader = new GLTFLoader();
  const isSeedThumbnail = container.dataset.seedThumbnail === "true";
  const isSeedPreview = container.dataset.seedPreview === "true" || isSeedThumbnail;
  const baseModelSettings = getSceneModelSettings(container.dataset.stage, container.dataset.plantId);
  const modelSettings = isSeedPreview
    ? {
        ...baseModelSettings,
        plantScale: baseModelSettings.plantScale * (isSeedThumbnail ? 5.2 : 2.4),
        plantY: baseModelSettings.plantY + 0.9
      }
    : baseModelSettings;
  // 連続成長: ステージ内の進捗（dataset.stageGrowth 0-1）に応じて 86%→100% に育てる。
  // 毎日ひらくたびに、昨日より少しだけ大きい姿を見せるため（デモ・種プレビューは対象外）
  const stageGrowth = Math.min(1, Math.max(0, Number(container.dataset.stageGrowth ?? 1)));
  const growthScale = isSeedPreview ? 1 : 0.86 + 0.14 * stageGrowth;
  const environmentType = container.dataset.environment || "soil";
  const plantDefinition = state.plants.find((plant) => plant.id === container.dataset.plantId);
  const [plantModel, soilModel] = await Promise.all([
    loadGltf(loader, container.dataset.plantModel),
    loadSoilAsset(THREE, loader, container.dataset.soilModel)
  ]);
  if (!isCurrentModelRender(container, token)) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const oldCanvases = Array.from(container.querySelectorAll("canvas:not(.sky-canvas):not(.sky-fx-canvas):not(.water-surface-canvas)"));
  if (!isCurrentModelRender(container, token)) return;
  container.appendChild(renderer.domElement);
  container.classList.add("is-3d");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  // 序盤はカメラを寄せ、育つにつれて引いていく（引きのドリーそのものが成長を語る）。
  // Stage4以降は従来の距離に収束するので、焼き込み配置の見え方は変わらない
  const camStage = (Number(container.dataset.stage) || 1) - 1 + stageGrowth;
  const camPull = isSeedPreview ? 1 : Math.min(1, camStage / 3);
  const cameraZ = 3.9 + (5.2 - 3.9) * camPull;
  // 寄るほどカメラも低く構える（高さそのままでは視線が地面の上を通り、種が画面外へ沈む）
  const cameraY = 0.18 + (0.55 - 0.18) * camPull;
  camera.position.set(0, cameraY, cameraZ);

  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const sunLighting = getSunLighting(THREE);
  const keyLight = new THREE.DirectionalLight(sunLighting.color, 2.4);
  keyLight.position.copy(sunLighting.position);
  scene.add(keyLight);
  // 土の土台の接地影はシルエット方式（createGroundShadowGroup）で落とす。
  // シャドウマッピングも試したが、このシーンはカメラが地面すれすれで
  // 地面が強くつぶれて見えるため、実影はほぼ画面に映らなかった（2026-07-24）
  const castsGroundShadow = environmentType !== "water" && !isSeedPreview;
  addArtworkMaterialLights(THREE, scene, plantDefinition);

  const plant = normalizeModel(THREE, plantModel.scene, modelSettings.plantScale * growthScale);
  preparePlantSurfaceModel(THREE, plant, plantDefinition, Number(container.dataset.stage) || 1);
  // モデル原点は中心にあるため、縮小すると根元が浮く。高さの差の半分だけ下げて根元を土に留める
  let growthYOffset = 0;
  if (growthScale < 1) {
    const grownBox = new THREE.Box3().setFromObject(plant);
    const grownHeight = grownBox.max.y - grownBox.min.y;
    if (Number.isFinite(grownHeight)) growthYOffset = -(grownHeight * (1 / growthScale - 1)) / 2;
  }
  const reflectionPlant = environmentType === "water" && !isSeedPreview
    ? prepareReflectionModel(THREE, plant.clone(true), Number(container.dataset.stage) || 1, modelSettings)
    : null;
  const waterSurface = environmentType === "water" && !isSeedPreview
    ? createShaderWaterSurface(THREE, plantDefinition, modelSettings)
    : null;
  const soil = environmentType !== "water" && soilModel && !isSeedPreview
    ? normalizeModel(THREE, soilModel.scene, modelSettings.soilScale)
    : null;
  if (soil) {
    // 高さ（接地）は変えず、横方向だけを締めて植物より土が勝たない楕円の島にする。
    soil.scale.x *= 0.88;
    soil.scale.z *= 0.88;
    prepareSoilModel(THREE, soil, plantDefinition);
  }
  const artworkGroup = new THREE.Group();
  let homeSoilGroup = null;
  if (soil) {
    homeSoilGroup = createTunedModelGroup(THREE, soil, {
      x: modelSettings.soilX,
      y: modelSettings.soilY,
      z: modelSettings.soilZ,
      pitch: modelSettings.soilRotX,
      yaw: modelSettings.soilRotY,
      roll: modelSettings.soilRotZ
    });
    artworkGroup.add(homeSoilGroup);
    if ((Number(container.dataset.stage) || 1) === 1) {
      const soilBox = new THREE.Box3().setFromObject(homeSoilGroup);
      const plantingDetail = createSeedPlantingDetail(THREE, plantDefinition, modelSettings, soilBox.max.y, homeSoilGroup);
      artworkGroup.add(plantingDetail);
    }
  }
  if (waterSurface) {
    artworkGroup.add(waterSurface.mesh);
  } else if (environmentType === "water" && !isSeedPreview) {
    artworkGroup.add(createWaterEnvironmentGroup(THREE, plantDefinition, modelSettings));
  }
  let reflectionGroup = null;
  if (reflectionPlant) {
    reflectionGroup = createWaterReflectionGroup(THREE, reflectionPlant, modelSettings);
    artworkGroup.add(reflectionGroup);
  }
  const plantGroup = createTunedModelGroup(THREE, plant, {
    x: modelSettings.plantX,
    y: modelSettings.plantY + growthYOffset,
    z: modelSettings.plantZ,
    pitch: modelSettings.plantRotX,
    yaw: modelSettings.plantRotY,
    roll: modelSettings.plantRotZ
  });
  if (castsGroundShadow) {
    attachSoilContactShadow(THREE, renderer, plantGroup, homeSoilGroup, Number(container.dataset.stage) || 1, modelSettings);
  }
  artworkGroup.add(plantGroup);
  if (isSeedPreview && !isSeedThumbnail) {
    mountSeedSpecimenMotion(container, token, renderer, scene, camera, plantGroup, {
      previewY: modelSettings.plantY,
      plantedY: baseModelSettings.plantY,
      plantedScale: baseModelSettings.plantScale / modelSettings.plantScale
    });
  }
  // 額縁: 作品の実寸から額の開口を計算して組み立てる
  if (container.dataset.frameType) {
    const plantBox = new THREE.Box3().setFromObject(plantGroup);
    const plantW = Math.max(0.2, plantBox.max.x - plantBox.min.x);
    const plantH = Math.max(0.2, plantBox.max.y - plantBox.min.y);
    const poolW = waterSurface?.surfaceSize?.width ?? plantW * 1.7;
    const innerW = Math.max(poolW * 0.92, plantW * 1.25);
    const innerH = Math.max(innerW * 1.12, plantH * 1.45);
    const waterY = waterSurface ? waterSurface.mesh.position.y : plantBox.min.y;
    const bottomY = waterY - innerH * 0.16;
    const frontZ = plantBox.max.z + 0.45;
    const frameGroup = buildShadowBoxFrame(THREE, container.dataset.frameType, {
      innerW,
      innerH,
      centerX: (plantBox.min.x + plantBox.max.x) / 2,
      bottomY,
      frontZ
    });
    artworkGroup.add(frameGroup);
    container.classList.add("has-procedural-frame");
  }
  // 種プレビューは標本展示なのでエフェクトを付けない。
  // （標本演出 mountSeedSpecimenMotion と水面植物の bob が同じ
  //   plantGroup.position.y を毎フレーム取り合い、種が震える不具合の原因。2026-07-14）
  const plantEffects = (!arePlantEffectsEnabled() || isSeedPreview) ? null : createPlantEffects(THREE, plantDefinition, plantGroup, {
    x: modelSettings.plantX,
    y: modelSettings.plantY,
    z: modelSettings.plantZ,
    reflection: reflectionGroup,
    waterY: waterSurface ? waterSurface.mesh.position.y : undefined,
    onPetalLand: createPetalLandHandler(waterSurface)
  }, Number(container.dataset.stage) || 1);
  if (plantEffects) artworkGroup.add(plantEffects.group);
  scene.add(artworkGroup);

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  resize();
  new ResizeObserver(resize).observe(container);
  renderer.render(scene, camera);
  removeOldCanvases(oldCanvases);
  if (waterSurface) {
    attachWaterPointerRipples(THREE, renderer, camera, waterSurface);
  } else if (plantEffects) {
    attachPetalTapBurst(renderer);
  }
  if (waterSurface || plantEffects) {
    startSceneAnimationLoop(container, token, renderer, scene, camera, { waterSurface, plantEffects });
  }
  // ギャラリーシーンと同様に参照を公開する（検証プローブ・デバッグ用）
  container.__artariumScene = { renderer, scene, camera, plantGroup, plantEffects, waterSurface };
  {
    // 植物の画面内位置（NDC）を公開する。開花演出の筆致・スポットライトと、デモの配置調整が参照する
    const box = new THREE.Box3().setFromObject(plantGroup);
    const xs = [];
    const ys = [];
    for (const cx of [box.min.x, box.max.x]) {
      for (const cy of [box.min.y, box.max.y]) {
        for (const cz of [box.min.z, box.max.z]) {
          const v = new THREE.Vector3(cx, cy, cz).project(camera);
          xs.push(v.x);
          ys.push(v.y);
        }
      }
    }
    const centerZ = (box.min.z + box.max.z) / 2;
    let soilTopNdcY = null;
    if (homeSoilGroup) {
      const soilBox = new THREE.Box3().setFromObject(homeSoilGroup);
      const soilCenter = new THREE.Vector3((soilBox.min.x + soilBox.max.x) / 2, soilBox.max.y, (soilBox.min.z + soilBox.max.z) / 2);
      soilTopNdcY = soilCenter.project(camera).y;
    }
    container.dataset.plantNdc = JSON.stringify({
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
      soilTopNdcY,
      waterNdcY: waterSurface
        ? new THREE.Vector3(0, waterSurface.mesh.position.y, waterSurface.mesh.position.z).project(camera).y
        : null,
      worldPerNdcY: Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.1, camera.position.z - centerZ),
      worldPerNdcX: Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.1, camera.position.z - centerZ) * camera.aspect
    });
  }
  if (container.classList.contains("daily-artwork")) {
    maybePlayBloomCelebration(container);
  }
}

function renderModelFallback(container, token) {
  if (!isCurrentModelRender(container, token)) return;
  const stage = Number(container.dataset.stage) || 1;
  const plant = state.plants.find((item) => item.id === container.dataset.plantId);
  container.classList.remove("is-3d");
  container.removeAttribute("data-ready");
  container.querySelectorAll("canvas:not(.sky-canvas):not(.sky-fx-canvas):not(.water-surface-canvas)").forEach((canvas) => canvas.remove());
  container.innerHTML = `${plant ? environmentLayerMarkup(plant, { environmentType: container.dataset.environment }) : ""}${plantMarkup(stage)}`;
  if (container.classList.contains("daily-artwork")) {
    mountSkyBackground(container, { waterTint: skyWaterTint(plant) });
    mountViewingButton(container);
    maybePlayBloomCelebration(container);
  }
}

function createTunedModelGroup(THREE, object, transform) {
  const root = new THREE.Group();
  const rollGroup = new THREE.Group();
  const pitchGroup = new THREE.Group();
  const yawGroup = new THREE.Group();

  root.position.set(transform.x, transform.y, transform.z);
  rollGroup.rotation.z = transform.roll;
  pitchGroup.rotation.x = transform.pitch;
  yawGroup.rotation.y = transform.yaw;

  root.add(rollGroup);
  rollGroup.add(pitchGroup);
  pitchGroup.add(yawGroup);
  yawGroup.add(object);
  return root;
}

// 土の土台の接地影: 水面の反射と同じ発想で、植物の黒いシルエットを
// 根元を支点に手前の斜面へ寝かせて落とす（2026-07-24 ユーザー要望）。
// 立てた鏡映だと不透明な土の中に埋まるため、寝かせた影として描く
// 土の接地影（デカール方式。2026-07-24）: 植物を真上から見た黒いシルエットを
// 一度テクスチャに描き、土の山の表面そのものに貼り付ける。
// 平面を斜面に寝かせる方式は、起伏で土に埋まる／視線上で本体より手前に出て
// 植物に被る問題が構造的に避けられなかったため置き換えた。
// - 土の表面に密着するので埋まらない
// - 土は常に植物より奥に描かれるので本体に被らない
function attachSoilContactShadow(THREE, renderer, plantGroup, soilGroup, stage, modelSettings = {}) {
  if (!soilGroup) return;
  // 影を貼る先: 土グループの中で最も頂点数の多いメッシュ（＝山本体）
  let mound = null;
  let maxCount = 0;
  soilGroup.updateMatrixWorld(true);
  soilGroup.traverse((child) => {
    const count = child.isMesh ? child.geometry?.attributes?.position?.count || 0 : 0;
    if (count > maxCount) {
      maxCount = count;
      mound = child;
    }
  });
  if (!mound) return;

  // 1. 真上からの平行投影でシルエットを小さなテクスチャへ描く（平行投影なので拡大歪みなし）
  const box = new THREE.Box3().setFromObject(plantGroup);
  const spread = Math.max(0.2, modelSettings.shadowLength ?? 1);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const w = Math.max(0.5, (box.max.x - box.min.x) * 1.15) * spread;
  const d = Math.max(0.5, (box.max.z - box.min.z) * 1.15) * spread;
  const silhouette = plantGroup.clone(true);
  silhouette.traverse((child) => {
    if (!child.isMesh) return;
    const makeBlack = () => new THREE.MeshBasicMaterial({ color: 0x000000 });
    child.material = Array.isArray(child.material) ? child.material.map(makeBlack) : makeBlack();
  });
  const rtScene = new THREE.Scene();
  rtScene.add(silhouette);
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0.1, 40);
  camera.position.set(cx, box.max.y + 6, cz);
  camera.up.set(0, 0, -1);
  camera.lookAt(cx, 0, cz);
  const renderTarget = new THREE.WebGLRenderTarget(128, 128);
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(renderTarget);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(rtScene, camera);
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevColor, prevAlpha);

  // 2. 山メッシュの複製に「真上から見た位置＝UV」を与えて重ねる（土の起伏に完全に沿う）。
  // 真下に貼ると植物本体に隠れて見えないため、貼り付け位置を手前の斜面へ
  // 半歩ずらし、午後の日差しが手前に落とす影のように見せる。
  // 太陽連動（2026-07-24）: シーンを描く時点の太陽で、
  //   - 左右: 太陽と反対側へ影がずれる（朝夕で向きが変わる）
  //   - 長さ: 太陽が低いほど長く伸びる（朝夕は長く・昼は短い）
  //   - 濃さ: 太陽が高いほど濃く、曇り・雨は淡く、夜は月明かりの淡い影
  const { sunPos } = getSkySunState();
  const sunSide = (Number(sunPos?.[0]) || 0.5) - 0.5;
  const sunHeight = Math.max(0, Math.min(1, Number(sunPos?.[1]) || 0));
  const shadowCx = cx - sunSide * w * 0.8;
  const dShadow = d * (1.55 - sunHeight * 0.85);
  // 「影 奥行き」: ＋で手前へ・−で奥へ（太陽連動の基準位置に加算）
  const shadowCz = cz + dShadow * 0.55 + (modelSettings.shadowZ ?? 0);
  const geometry = mound.geometry.clone();
  const positions = geometry.attributes.position;
  const uv = new Float32Array(positions.count * 2);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i).applyMatrix4(mound.matrixWorld);
    uv[i * 2] = (vertex.x - shadowCx) / w + 0.5;
    uv[i * 2 + 1] = 0.5 - (vertex.z - shadowCz) / dShadow;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const weather = (DEMO_MODE && debugWeatherKey && WEATHER_PRESETS[debugWeatherKey]) || lastRealWeather || { cloud: 0.28, rain: 0 };
  const skyDim = 1 - Math.min(0.75, (weather.cloud || 0) * 0.45 + (weather.rain || 0) * 0.5 + (weather.snow || 0) * 0.35);
  const daylight = 0.45 + 0.55 * sunHeight; // 夜(太陽高度0)でも月明かり分は残す
  const strength = Math.min(0.55, (stage >= 5 ? 0.34 : stage >= 3 ? 0.3 : 0.24) * daylight * skyDim * (modelSettings.shadowOpacity ?? 1));
  const overlay = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: renderTarget.texture,
    transparent: true,
    opacity: strength,
    depthWrite: false,
    // 山本体と同一面のためポリゴンオフセットでZファイトを防ぐ
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  }));
  overlay.position.copy(mound.position);
  overlay.rotation.copy(mound.rotation);
  overlay.scale.copy(mound.scale);
  mound.parent.add(overlay);
}

function prepareReflectionModel(THREE, object, stage, modelSettings) {
  const baseOpacity = stage >= 5 ? 0.26 : stage >= 3 ? 0.18 : 0.1;
  const opacity = Math.max(0, Math.min(0.68, baseOpacity * (modelSettings.reflectionOpacity ?? 1)));
  object.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const reflectedMaterials = materials.map((material) => {
      const clone = material?.clone ? material.clone() : new THREE.MeshBasicMaterial();
      clone.transparent = true;
      clone.opacity = opacity;
      clone.depthWrite = false;
      clone.side = THREE.DoubleSide;
      clone.blending = THREE.NormalBlending;
      if (clone.color) {
        clone.color.lerp(new THREE.Color("#8fc4c7"), 0.56);
      }
      if ("roughness" in clone) clone.roughness = Math.max(clone.roughness ?? 0.4, 0.72);
      if ("metalness" in clone) clone.metalness = Math.min(clone.metalness ?? 0, 0.05);
      return clone;
    });
    child.material = Array.isArray(child.material) ? reflectedMaterials : reflectedMaterials[0];
    child.renderOrder = 2;
  });
  return object;
}

// 植物ごとの土台の配色・質感（モチーフの名画に合わせる）
const SOIL_STYLES = {
  // 土は作品の額ではなく、すべての植物をつなぐ「庭」。固有色はごく薄い含み色に留める。
  "scream-bloom": { color: "#463128", emissive: "#1b0d09", emissiveIntensity: 0.025, roughness: 0.94 },
  "sunflower-bloom": { color: "#4a3a27", emissive: "#1b1208", emissiveIntensity: 0.02, roughness: 0.93 },
  "renaissance-smile-bloom": { color: "#403a2e", emissive: "#17140e", emissiveIntensity: 0.018, roughness: 0.95 },
  "nocturne-sky-bloom": { color: "#30343d", emissive: "#0e121a", emissiveIntensity: 0.03, roughness: 0.92 },
  "golden-embrace-bloom": { color: "#4c4028", emissive: "#1b1508", emissiveIntensity: 0.025, roughness: 0.9 },
  "monochrome-fracture-bloom": { color: "#3d3b37", emissive: "#11100f", emissiveIntensity: 0.015, roughness: 0.95 },
  "pearl-light-bloom": { color: "#484239", emissive: "#17140e", emissiveIntensity: 0.018, roughness: 0.91 },
  // 注がれる朝: 台所の暖かい木の色をごく薄く含ませる
  "milk-pour-bloom": { color: "#4a4033", emissive: "#191309", emissiveIntensity: 0.02, roughness: 0.93 }
};

function prepareSoilModel(THREE, object, plant) {
  const style = SOIL_STYLES[plant?.id]
    || (plant?.palette ? { color: plant.palette[3] || plant.palette[0], emissiveIntensity: 0.08, roughness: 0.7 } : null);
  if (!style) return object;
  object.traverse((child) => {
    if (!child.isMesh || child.userData.noSoilStyle) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const tuned = materials.map((material) => {
      const clone = material?.clone ? material.clone() : new THREE.MeshStandardMaterial();
      if (clone.color) clone.color.lerp(new THREE.Color(style.color), 0.34);
      if (clone.emissive !== undefined && style.emissive) {
        clone.emissive = new THREE.Color(style.emissive);
        clone.emissiveIntensity = style.emissiveIntensity ?? 0.08;
      }
      if ("roughness" in clone && style.roughness !== undefined) clone.roughness = style.roughness;
      if ("metalness" in clone && style.metalness !== undefined) clone.metalness = style.metalness;
      if (clone.color) registerSoilMaterial(clone);
      return clone;
    });
    child.material = Array.isArray(child.material) ? tuned : tuned[0];
  });
  return object;
}

function prepareWaterSurfaceModel(THREE, object, plant) {
  const palette = plant?.palette || ["#86b6c6", "#b8d6a0", "#d9a8c7", "#486b62"];
  object.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const waterMaterials = materials.map((material) => {
      const clone = material?.clone ? material.clone() : new THREE.MeshStandardMaterial();
      clone.transparent = true;
      clone.opacity = 0.72;
      clone.depthWrite = false;
      clone.side = THREE.DoubleSide;
      clone.blending = THREE.NormalBlending;
      if (clone.color) {
        clone.color.lerp(new THREE.Color(palette[0]), 0.28);
      }
      if (clone.emissive) {
        clone.emissive = new THREE.Color(palette[0]);
        clone.emissiveIntensity = 0.08;
      }
      if ("roughness" in clone) clone.roughness = 0.18;
      if ("metalness" in clone) clone.metalness = 0.04;
      if ("envMapIntensity" in clone) clone.envMapIntensity = 1.25;
      return clone;
    });
    child.material = Array.isArray(child.material) ? waterMaterials : waterMaterials[0];
    child.renderOrder = 1;
  });
  return object;
}

function addArtworkMaterialLights(THREE, scene, plant) {
  if (plant?.id !== "pearl-light-bloom") return;

  const pearlLight = new THREE.PointLight(0xffefd6, 2.15, 5.8);
  pearlLight.position.set(-1.65, 2.08, 2.65);
  scene.add(pearlLight);

  const rimLight = new THREE.DirectionalLight(0xc8ddff, 1.48);
  rimLight.position.set(2.4, 1.35, 2.7);
  scene.add(rimLight);
}

function preparePlantSurfaceModel(THREE, object, plant, stage = 1) {
  if (plant?.id !== "pearl-light-bloom") return object;

  object.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const isPearlPart = isLikelyPearlPart(THREE, child, stage);
    const tunedMaterials = materials.map((material) => (
      isPearlPart ? createPearlSoftGlossMaterial(THREE, material, stage) : createPearlBaseMaterial(THREE, material)
    ));
    child.material = Array.isArray(child.material) ? tunedMaterials : tunedMaterials[0];
  });
  return object;
}

function createPearlBaseMaterial(THREE, material) {
  const sourceColor = material?.color?.clone?.() || new THREE.Color("#f4ead2");
  return new THREE.MeshLambertMaterial({
    map: material?.map || null,
    color: sourceColor,
    transparent: material?.transparent || false,
    opacity: material?.opacity ?? 1,
    side: material?.side ?? THREE.FrontSide
  });
}

function createPearlSoftGlossMaterial(THREE, material, stage = 1) {
  const sourceColor = material?.color?.clone?.() || new THREE.Color("#f4ead2");
  const isCoveredPearlStage = stage === 4 || stage === 5;
  return new THREE.MeshPhongMaterial({
    map: material?.map || null,
    normalMap: material?.normalMap || null,
    alphaMap: material?.alphaMap || null,
    color: sourceColor.lerp(new THREE.Color("#f1e1bd"), 0.22),
    specular: new THREE.Color("#fff7df"),
    shininess: isCoveredPearlStage ? 42 : 78,
    emissive: new THREE.Color("#b98fa8"),
    emissiveIntensity: isCoveredPearlStage ? 0.015 : 0.035,
    transparent: material?.transparent || false,
    opacity: material?.opacity ?? 1,
    side: material?.side ?? THREE.FrontSide
  });
}

function isLikelyPearlPart(THREE, child, stage = 1) {
  const partName = `${child.name || ""} ${child.parent?.name || ""}`.toLowerCase();
  if (stage === 4) return partName.includes("tripo_part_7") || partName.includes("mesh_7");
  if (stage === 5) return partName.includes("tripo_part_4") || partName.includes("mesh_4");
  if (stage === 6) return partName.includes("tripo_part_9") || partName.includes("mesh_9");
  if (partName.includes("tripo_part_0") || partName.includes("mesh_23")) return true;

  const box = new THREE.Box3().setFromObject(child);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return size.x > 0.75 && size.y > 0.48 && size.z > 0.48 && center.z > 0;
}

function prepareFrameModel(object) {
  object.position.set(0, 0, -1.15);
  object.scale.multiplyScalar(1.04);
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.renderOrder = 0;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      material.depthWrite = true;
      material.depthTest = true;
    });
  });
  return object;
}

function createWaterReflectionGroup(THREE, object, modelSettings, { framed = false } = {}) {
  const waterY = getWaterSurfaceY(modelSettings);
  const scale = modelSettings.reflectionScale ?? 0.96;
  const squash = Math.max(0.03, modelSettings.reflectionSquash ?? 0.2);
  // 水面(y=waterY)を鏡とした正確な鏡映:
  //   反射の変換 = 水面基準の平行移動 × 縦反転圧縮 × 本体と同じ回転
  // ルートのYスケールを負にすると回転が自動的に鏡映側へ変換されるため、
  // 回転値は本体と同じものを渡すのが数学的に正しい。
  // squash は水面を支点に縦へ圧縮する（波で反射が縦に縮んで見える表現）
  const reflection = createTunedModelGroup(THREE, object, {
    x: modelSettings.plantX,
    y: waterY - squash * (modelSettings.plantY - waterY) + (modelSettings.reflectionY ?? 0),
    z: modelSettings.plantZ - (framed ? 0.04 : 0.08) + (modelSettings.reflectionZ ?? 0),
    pitch: modelSettings.plantRotX,
    yaw: modelSettings.plantRotY,
    roll: modelSettings.plantRotZ
  });
  reflection.scale.set(scale, -squash, scale);
  return reflection;
}

function getWaterSurfaceY(modelSettings) {
  return Math.min(modelSettings.soilY + 0.08, modelSettings.plantY + 0.12);
}

// 空の太陽（月）の位置・色から3Dシーンの光源を作る
// 太陽が空の左にあれば左から、低い時間帯は浅い角度から光が当たる
function getSunLighting(THREE) {
  const { sunPos, sunColor } = getSkySunState();
  return {
    position: new THREE.Vector3((sunPos[0] - 0.5) * 9, 1.5 + sunPos[1] * 5, 4),
    color: new THREE.Color(sunColor[0], sunColor[1], sunColor[2]),
    waterDir: [(sunPos[0] - 0.5) * 2.2, 0.5 + sunPos[1] * 1.2, 1.0],
    waterColor: sunColor
  };
}

// 池（createThreeWater の uDeep）と同じ色調を表示色で作り、空の遠景水面に渡す
function skyWaterTint(plant) {
  const hex = plant?.palette?.[0] || "#86b6c6";
  const n = parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return null;
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const pale = [0.75, 0.9, 0.93]; // #bfe6ec
  return rgb.map((v, i) => (v + (pale[i] - v) * 0.3) * 0.95);
}

function createShaderWaterSurface(THREE, plant, modelSettings, { framed = false } = {}) {
  const palette = plant?.palette || ["#86b6c6", "#b8d6a0", "#d9a8c7", "#486b62"];
  const baseSize = framed ? 2.75 : 3.05;
  const sun = getSunLighting(THREE);
  const water = createThreeWater(THREE, {
    width: baseSize * 2,
    depth: baseSize * 2 * 0.58,
    deepColor: palette[0],
    opacity: modelSettings.waterOpacity ?? 0.5,
    lightDir: sun.waterDir,
    lightColor: sun.waterColor
  });
  if (!water) return null;
  water.mesh.position.set(
    modelSettings.soilX + (modelSettings.waterX ?? 0),
    getWaterSurfaceY(modelSettings) + (modelSettings.waterY ?? 0),
    modelSettings.soilZ - 0.02 + (modelSettings.waterZ ?? 0)
  );
  const waterScale = modelSettings.waterScale ?? 1;
  water.mesh.scale.setScalar(waterScale);
  // 花びらの着水位置→波紋のUV変換に使う実寸
  water.surfaceSize = {
    width: baseSize * 2 * waterScale,
    depth: baseSize * 2 * 0.58 * waterScale
  };
  return water;
}

// 花びらが着水したら、その位置に波紋を立てる
function createPetalLandHandler(waterSurface) {
  if (!waterSurface) return null;
  return (x, z) => {
    const { mesh, surfaceSize } = waterSurface;
    if (!surfaceSize) return;
    const u = (x - mesh.position.x) / surfaceSize.width + 0.5;
    const v = 0.5 - (z - mesh.position.z) / surfaceSize.depth;
    if (u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98) {
      waterSurface.ripple(u, v, -0.22, 0.028);
      window.dispatchEvent(new CustomEvent("artarium:ripple", { detail: { strength: 0.15 } }));
    }
  };
}

// 水面のない（陸の）植物でも、タップで花びらがまとまって散る
function attachPetalTapBurst(renderer) {
  let lastPetalBurstAt = 0;
  renderer.domElement.addEventListener("pointerdown", () => {
    const now = performance.now();
    if (now - lastPetalBurstAt > 1500) {
      lastPetalBurstAt = now;
      shedPetalsNow(3 + Math.floor(Math.random() * 2));
    }
  });
}

function attachWaterPointerRipples(THREE, renderer, camera, waterSurface) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lastPetalBurstAt = 0;
  renderer.domElement.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(waterSurface.mesh, false)[0];
    if (hit?.uv) {
      waterSurface.ripple(hit.uv.x, hit.uv.y, -0.3, 0.032);
      window.dispatchEvent(new CustomEvent("artarium:ripple", { detail: { strength: 0.3 } }));
      // タップに応えて花びらがまとまって散る（開花済みの植物のみ・1.5秒に1回まで）
      const now = performance.now();
      if (now - lastPetalBurstAt > 1500) {
        lastPetalBurstAt = now;
        shedPetalsNow(3 + Math.floor(Math.random() * 2));
      }
    }
  });
}

function startSceneAnimationLoop(container, token, renderer, scene, camera, { waterSurface = null, plantEffects = null } = {}) {
  // 省電力:
  // - 別タブ表示中など画面に見えていない間は計算と描画を止める
  // - 水面のない静かなシーン（揺れ・粒子のみ）は30fpsに落とす
  //   （タブ自体が非表示の間は requestAnimationFrame がブラウザにより自動停止する）
  const needsFullFrameRate = Boolean(waterSurface);
  const baseCameraX = camera.position.x;
  const baseCameraY = camera.position.y;
  const baseCameraZ = camera.position.z;
  // 鑑賞モードの呼吸: 約14秒周期でごくゆっくり寄り、また戻る（reduced-motion時は無効）
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  let breatheAmount = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let frameCount = 0;
  const tick = () => {
    if (!isCurrentModelRender(container, token)) {
      waterSurface?.destroy();
      plantEffects?.dispose();
      return;
    }
    requestAnimationFrame(tick);
    frameCount++;
    if (container.getClientRects().length === 0) return;
    if (!needsFullFrameRate && frameCount % 2 === 0) return;
    // 傾き視差: カメラをわずかに動かし、空は逆方向へずらして奥行きを出す。
    // 通常時は端末の揺れで画面が動かないよう、鑑賞モード中のみ効かせる
    // （2026-07-30 ユーザー要望。デモの視差プレビューは従来どおり）
    const parallaxOn = deviceTilt.active
      && (document.body.classList.contains("is-viewing-mode") || (DEMO_MODE && demoMouseParallax));
    const parallaxTargetX = parallaxOn ? deviceTilt.x * 0.14 : 0;
    const parallaxTargetY = parallaxOn ? deviceTilt.y * 0.08 : 0;
    if (parallaxOn || Math.abs(parallaxX) > 0.0005 || Math.abs(parallaxY) > 0.0005) {
      parallaxX += (parallaxTargetX - parallaxX) * 0.08;
      parallaxY += (parallaxTargetY - parallaxY) * 0.08;
      camera.position.x = baseCameraX + parallaxX;
      camera.position.y = baseCameraY - parallaxY;
      const skyCanvas = container.querySelector(":scope > .sky-canvas");
      if (skyCanvas) {
        // 解除後に静定したら空の変形も外す（掛けっぱなしにしない）
        skyCanvas.style.transform = parallaxOn || Math.abs(parallaxX) > 0.0005 || Math.abs(parallaxY) > 0.0005
          ? `translate(${(-parallaxX * 60).toFixed(1)}px, ${(parallaxY * 30).toFixed(1)}px) scale(1.08)`
          : "";
      }
    }
    const breatheTarget = !reduceMotion && document.body.classList.contains("is-viewing-mode") ? 1 : 0;
    if (breatheAmount > 0.001 || breatheTarget > 0) {
      breatheAmount += (breatheTarget - breatheAmount) * 0.02;
      const breatheT = performance.now() / 1000;
      camera.position.z = baseCameraZ - (Math.sin(breatheT * 0.45 - Math.PI / 2) * 0.5 + 0.5) * 0.26 * breatheAmount;
    }
    waterSurface?.update(renderer);
    plantEffects?.update(performance.now());
    renderer.render(scene, camera);
  };
  requestAnimationFrame(tick);
}

function createWaterEnvironmentGroup(THREE, plant, modelSettings, { framed = false } = {}) {
  const group = new THREE.Group();
  const palette = plant?.palette || ["#86b6c6", "#b8d6a0", "#d9a8c7", "#486b62"];
  const waterY = getWaterSurfaceY(modelSettings);
  const waterZ = modelSettings.soilZ - 0.02;
  const baseSize = framed ? 2.75 : 3.05;

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette[0]),
    emissive: new THREE.Color(palette[0]),
    emissiveIntensity: 0.16,
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(baseSize, 96), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(modelSettings.soilX, waterY, waterZ);
  water.scale.z = 0.58;
  group.add(water);

  [0.58, 0.86, 1.16].forEach((radius, index) => {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(index === 0 ? "#f4ead2" : palette[2]),
      transparent: true,
      opacity: 0.24 - index * 0.045,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 8, 96), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(modelSettings.soilX + index * 0.03, waterY + 0.012 + index * 0.004, waterZ + index * 0.02);
    ring.scale.z = 0.54;
    group.add(ring);
  });

  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#f4ead2"),
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide
  });
  const highlight = new THREE.Mesh(new THREE.CircleGeometry(baseSize * 0.34, 48), highlightMaterial);
  highlight.rotation.x = -Math.PI / 2;
  highlight.position.set(modelSettings.soilX - 0.42, waterY + 0.018, waterZ - 0.26);
  highlight.scale.z = 0.38;
  group.add(highlight);

  return group;
}

function removeOldCanvases(canvases) {
  canvases.forEach((canvas) => canvas.remove());
}

function isCurrentModelRender(container, token) {
  return container.isConnected && container.dataset.modelRenderToken === token;
}

function getSceneModelSettings(stage, plantId, { preferProduction = false } = {}) {
  const settings = DEMO_MODE && !preferProduction ? state.demoModelSettings : state.productionModelSettings;
  return getModelSettings(settings, plantId, stage);
}

function loadGltf(loader, path) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
}

// 土の丘はコード生成（2026-07-13 採用: 空・水面と同じ自作路線）。
// 低く広い花壇型 + 3スケールの起伏（うねり・土くれ・細粒）+ 擬似AO + 植え付け跡 + 裾の草株。
// 乱数を使わない決定的生成で、毎回同じ丘になる。
let proceduralSoilCache = null;

function createProceduralSoilMound(THREE) {
  if (proceduralSoilCache) return proceduralSoilCache.clone();
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf); const w = yf * yf * (3 - 2 * yf);
    return hash(xi, yi) * (1 - u) * (1 - w) + hash(xi + 1, yi) * u * (1 - w)
      + hash(xi, yi + 1) * (1 - u) * w + hash(xi + 1, yi + 1) * u * w;
  };
  const geo = new THREE.SphereGeometry(1, 160, 56, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position;
  const shades = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ang = Math.atan2(v.z, v.x);
    const flare = 1 + (1 - v.y) * 0.22;
    const und = (noise(Math.cos(ang) * 2.4 + 7, Math.sin(ang) * 2.4 + v.y * 2.2) - 0.5) * 0.075
      + (noise(Math.cos(ang) * 7 + 31, Math.sin(ang) * 7 + v.y * 6) - 0.5) * 0.025;
    // 土くれ: 掘り返した土の小さな塊。sin^2で角の丸いこぶにする
    const clodNoise = noise(Math.cos(ang) * 13 + 53, Math.sin(ang) * 13 + v.y * 11);
    const clod = clodNoise * clodNoise * 0.018;
    const grain = (noise(ang * 20 + 11, v.y * 22 + 3) - 0.5) * 0.006;
    const r = Math.max(0.05, flare + und + clod + grain);
    // 植え穴: 頂点中央の小さな窪みと、そのまわりの掘り縁（育つと植物に隠れる）
    // 半径は種がちょうど収まる程度に絞る（広いと平らな「影の円盤」に見え、
    // 種が縁をまたいだとき影を貫通しているような違和感が出る。2026-07-23）
    const rho = Math.sqrt(v.x * v.x + v.z * v.z);
    let dig = 0;
    if (rho < 0.26) {
      const dt = rho / 0.26;
      dig = -0.045 * Math.pow(Math.max(0, 1 - dt / 0.62), 2)
        + 0.016 * Math.exp(-Math.pow((dt - 0.75) / 0.18, 2));
    }
    pos.setXYZ(i, v.x * r, Math.max(0, v.y * 0.32 + (und + clod) * 0.18 * v.y + dig), v.z * r);
    // 擬似AO: 土くれの谷を暗く、こぶの頂を明るく。下限を高めにして稜線が空の光を拾えるようにする
    let shade = 0.88 + clodNoise * 0.2;
    shade *= 0.94 + v.y * 0.08;
    // 植え穴の中は掘りたてで湿って暗い。深さに比例して滑らかに落とす
    // （二値の境界だと縁の硬い影の円盤に見える）
    if (dig < 0) shade *= 1 - Math.min(1, -dig / 0.045) * 0.13;
    // 汀: 水際に近い裾は濡れて暗い（水と土の境目を締める）
    const wet = 1 - Math.min(1, v.y / 0.2);
    shade *= 1 - wet * 0.35;
    shades[i * 3] = shades[i * 3 + 1] = shades[i * 3 + 2] = Math.min(1.15, shade);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(shades, 3));
  geo.computeVertexNormals();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#302820";
  ctx.fillRect(0, 0, 512, 512);
  // 大きな色むら: 乾いた土と湿った土のまだら
  for (let i = 0; i < 24; i++) {
    const x = hash(i, 61.3) * 512; const y = hash(i, 67.9) * 512;
    const radius = 24 + hash(i, 71.1) * 58;
    const dry = hash(i, 79.3) > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, dry ? "rgba(105,88,67,0.07)" : "rgba(13,11,9,0.1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  for (let i = 0; i < 4200; i++) {
    const x = hash(i, 1.3) * 512; const y = hash(i, 7.7) * 512;
    // 粒のむら: 中スケールのノイズが濃い所に粒が集まり、薄い所はまばらになる
    const cluster = noise(x / 512 * 5.5 + 13, y / 512 * 5.5 + 29);
    if (hash(i, 4.7) > cluster * 1.35) continue;
    const l = hash(i, 3.1);
    const size = 1 + hash(i, 9.2) * 2.2;
    if (l > 0.985) ctx.fillStyle = "rgba(144,128,104,0.48)";
    else if (l > 0.5) ctx.fillStyle = `rgba(91,75,57,${0.22 + l * 0.2})`;
    else ctx.fillStyle = `rgba(14,11,9,${0.2 + l * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // 湿り気のむら（大きなにじみ）
  for (let i = 0; i < 14; i++) {
    const x = hash(i, 21.7) * 512; const y = hash(i, 33.1) * 512;
    const radius = 60 + hash(i, 40.9) * 110;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(18,13,9,${0.1 + hash(i, 55.3) * 0.12})`);
    g.addColorStop(1, "rgba(18,13,9,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // 熊手目: 植物のまわりに同心円の手入れ跡。溝の陰と土の盛りの明を対で描く
  for (let line = 0; line < 4; line++) {
    const baseY = 68 + line * 27;
    for (const [offset, colr, alpha] of [[0, "14,11,9", 0.13], [2.4, "112,94,70", 0.07]]) {
      ctx.strokeStyle = `rgba(${colr},${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const y = baseY + offset + (noise(x / 60 + line * 7.3, line * 3.1) - 0.5) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.6, 0.9);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map, bumpMap: map, bumpScale: 0.32, roughness: 0.94, metalness: 0, vertexColors: true
  });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, material));
  // 半分埋まった小石: 大きさの基準になる静かな脇役。植物パレットには染めない
  for (let s = 0; s < 2; s++) {
    const ang = hash(s, 101.3) * Math.PI * 2;
    const rad = 0.42 + hash(s, 107.9) * 0.38;
    const size = 0.016 + hash(s, 113.7) * 0.013;
    const tone = 0.085 + hash(s, 127.1) * 0.05;
    const stone = new THREE.Mesh(
      new THREE.SphereGeometry(size, 14, 10),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(tone, tone * 0.94, tone * 0.85),
        roughness: 0.9, metalness: 0
      })
    );
    stone.scale.y = 0.55;
    stone.rotation.set(hash(s, 131.3) * 0.6, hash(s, 137.9) * Math.PI, hash(s, 139.7) * 0.5);
    const sx = Math.cos(ang) * rad;
    const sz = Math.sin(ang) * rad;
    // 丘の高さ係数（0.32）と一致させ、中心を少し沈めて小石を表面へ接地させる。
    const soilSurfaceY = 0.32 * Math.sqrt(Math.max(0, 1 - rad * rad * 0.62));
    stone.position.set(sx, soilSurfaceY - size * 0.18, sz);
    stone.userData.noSoilStyle = true;
    group.add(stone);
  }

  proceduralSoilCache = group;
  return group.clone();
}

// Stage 1専用の植え付け跡。掘り返した土くれが種の根元を囲み「植えた」状態を作る。
// 接触影の平面ディスクは置かない — 土に沈む種の視線上どうしても手前に重なり、
// 種が影を貫通しているような違和感になる（植え穴の頂点AOが陰の役を担う。2026-07-23）
function createSeedPlantingDetail(THREE, plant, settings, soilTopY, soilGroup = null) {
  const group = new THREE.Group();
  const centerX = settings.plantX;
  const centerZ = settings.plantZ + 0.015;

  const paletteSoil = SOIL_STYLES[plant?.id]?.color || "#40362b";
  const clodMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(paletteSoil).multiplyScalar(0.72),
    roughness: 0.98,
    metalness: 0
  });
  const clods = [
    [-0.105, 0.002, 0.025, 0.024, 0.006],
    [-0.07, 0.004, -0.075, 0.018, 0.005],
    [0.025, 0.003, -0.105, 0.022, 0.006],
    [0.105, 0.002, -0.04, 0.02, 0.005],
    [0.09, 0.003, 0.07, 0.017, 0.004],
    [-0.025, 0.002, 0.11, 0.015, 0.004]
  ];
  // 各土くれの真下の土表面をレイキャストで測って接地させる。
  // 山頂の高さ（soilTopY）に一律で置くと、植え穴の窪みや斜面の上で浮いて見える
  const raycaster = soilGroup ? new THREE.Raycaster() : null;
  if (soilGroup) soilGroup.updateMatrixWorld(true);
  const down = new THREE.Vector3(0, -1, 0);
  const surfaceYAt = (x, z) => {
    if (!raycaster) return soilTopY;
    raycaster.set(new THREE.Vector3(x, soilTopY + 1, z), down);
    const hit = raycaster.intersectObject(soilGroup, true)[0];
    return hit ? hit.point.y : soilTopY;
  };
  clods.forEach(([x, y, z, width, height], index) => {
    const clod = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9), clodMaterial);
    clod.scale.set(width, height, width * (0.58 + index * 0.035));
    const groundY = surfaceYAt(centerX + x, centerZ + z);
    // 半分ほど土に沈めて「掘り返した土」として接地させる
    clod.position.set(centerX + x, groundY + height * 0.45, centerZ + z);
    clod.rotation.y = index * 1.17;
    clod.castShadow = false;
    clod.receiveShadow = true;
    group.add(clod);
  });

  return group;
}

// 土モデルの読み込み口: 土の丘はコード生成、水面の器などは従来どおりGLB
function loadSoilAsset(THREE, loader, path) {
  if (path === SOIL_TYPES["gallery-loam"].modelPath) {
    return Promise.resolve({ scene: createProceduralSoilMound(THREE) });
  }
  return safeLoadGltf(loader, path);
}

function safeLoadGltf(loader, path) {
  if (!path) return Promise.resolve(null);
  return loadGltf(loader, path).catch((error) => {
    console.warn("Optional GLB unavailable:", path, error);
    return null;
  });
}

function normalizeModel(THREE, object, targetSize) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  object.scale.setScalar(scale);
  object.position.sub(center.multiplyScalar(scale));
  return object;
}

function plantMarkup(stage) {
  const petals = Array.from({ length: Math.max(2, stage + 2) }, (_, index) => {
    return `<i style="--turn:${index};--count:${Math.max(2, stage + 2)}"></i>`;
  }).join("");

  return `
    <div class="plant-visual stage-${stage}" aria-hidden="true">
      <div class="soil"></div>
      <div class="stem"></div>
      <div class="leaf leaf-left"></div>
      <div class="leaf leaf-right"></div>
      <div class="bloom">${petals}<b></b></div>
      <div class="aura"></div>
    </div>
  `;
}

function modelLoadingMarkup() {
  return `
    <div class="model-loading" aria-hidden="true">
      <span></span>
      <small>読み込み中</small>
    </div>
  `;
}

// キャッシュ復旧用の非常口: ?nosw=1 で旧Service Workerと全キャッシュを消去して開き直す。
// 古いSWが居座って更新が届かないとき用（URLにクエリが付くため旧SWのキャッシュには当たらない）
if (new URLSearchParams(window.location.search).has("nosw")) {
  Promise.resolve()
    .then(() => (navigator.serviceWorker?.getRegistrations?.() ?? []))
    .then((registrations) => Promise.all([...registrations].map((reg) => reg.unregister())))
    .then(() => (window.caches ? caches.keys() : []))
    .then((keys) => Promise.all([...keys].map((key) => caches.delete(key))))
    .finally(() => window.location.replace("./"));
} else {
  init();
}

if ("serviceWorker" in navigator && !new URLSearchParams(window.location.search).has("nosw")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });
}
