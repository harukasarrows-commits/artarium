import { observeWaterSurfaces, rainBurst, createThreeWater, setAmbientRain } from "./water-surface.js?v=20260708-68";
import { mountSkyBackground, setSkyWeather, getSkySunState, setSkyStepProgress, setSkySeasonOverride } from "./sky-background.js?v=20260708-68";
import { initWeatherSync, WEATHER_PRESETS } from "./weather.js?v=20260708-68";
import { createPlantEffects, setPlantWind, shedPetalsNow } from "./plant-effects.js?v=20260708-68";
import { setSoundEnabled, isSoundEnabled, setRainSoundLevel, playRipplePlop } from "./ambient-sound.js?v=20260708-68";

const STAGE_THRESHOLDS = [0, 1000, 2000, 3000, 4000, 5000];

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
  "water-lily-bloom": {
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
  }
};
const COMPLETION_THRESHOLD = 6000;
const STEPS_PER_POINT = 10;
const DAILY_STEP_GOAL = 8000; // 光の道の演出が最大になる1日の歩数
const AMBIENT_SOUND_STORAGE_KEY = "artarium-ambient-sound";
const STORAGE_KEY = "artarium-mvp-state";
const USER_PROFILE_STORAGE_KEY = "artarium-user-name";
const DEMO_MODEL_STORAGE_KEY = "artarium-demo-model-settings-v2";
const PRODUCTION_MODEL_STORAGE_KEY = "artarium-production-model-settings";
const DEMO_SOIL_STORAGE_KEY = "artarium-demo-soil-assignments";
const PRODUCTION_SOIL_STORAGE_KEY = "artarium-production-soil-assignments";
const PRODUCTION_SYNC_STORAGE_KEY = "artarium-production-sync";
const THREE_CDN_VERSION = "0.164.1";
const ASSET_VERSION = "20260708-68";
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
const MODEL_STAGE_COUNT = 6;
const LEGACY_MODEL_SETTINGS_PLANT_ID = "sunflower-bloom";
const WATER_SURFACE_REFERENCE_PLANT_ID = "water-lily-bloom";
const DEFAULT_MODEL_SETTINGS = {
  plantScale: 0.82,
  plantX: -0.04,
  plantY: -0.56,
  plantZ: 0.18,
  plantRotX: 0.08,
  plantRotY: -0.72,
  plantRotZ: 1.18,
  soilScale: 3.12,
  soilX: 0,
  soilY: -0.62,
  soilZ: -0.08,
  soilRotX: 0,
  soilRotY: 0,
  soilRotZ: 0,
  reflectionOpacity: 1,
  reflectionY: 0,
  reflectionZ: 0,
  reflectionSquash: 0.2,
  reflectionScale: 0.96,
  waterX: 0,
  waterY: 0,
  waterZ: 0,
  waterScale: 1,
  waterOpacity: 0.92
};
const DEFAULT_WATER_SURFACE_MODEL_SETTINGS = {
  ...DEFAULT_MODEL_SETTINGS,
  plantScale: 0.82,
  plantX: -0.04,
  plantY: -0.46,
  plantZ: 0.2,
  plantRotX: 0.06,
  plantRotY: -0.72,
  plantRotZ: 1.18,
  soilScale: 2.95,
  soilX: 0,
  soilY: -0.62,
  soilZ: -0.1,
  soilRotX: 0,
  soilRotY: 0,
  soilRotZ: 0,
  reflectionOpacity: 0.74,
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
let demoMouseParallax = false;

function applyWeatherToScene(weather) {
  setSkyWeather(weather);
  setAmbientRain(weather.rain);
  setRainSoundLevel(weather.rain);
  // 風の強さ: 雨・嵐で強く、雲が多い日も少し揺れる
  setPlantWind(Math.min(1, 0.2 + Math.max(weather.rain || 0, (weather.dark || 0) * 1.5) + (weather.cloud || 0) * 0.2));
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
    modelPath: "./models/frames/walnut-shadow-box/frame.glb",
    material: "#5a3b25"
  },
  "museum-black": {
    label: "Museum Black",
    modelPath: "./models/frames/museum-black/picture+frame+3d+model+1k.glb",
    material: "#171716"
  },
  "floating-maple": {
    label: "Floating Maple",
    modelPath: "./models/frames/floating-maple/frame.glb",
    material: "#b98248"
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
  frameChoicePlantId: "",
  galleryFocusPlantId: "",
  galleryFocusAngle: 0,
  demoModelStage: 1,
  demoModelSettings: loadDemoModelSettings(),
  productionModelSettings: loadProductionModelSettings(),
  demoSoilAssignments: loadSoilAssignments(DEMO_SOIL_STORAGE_KEY),
  productionSoilAssignments: loadSoilAssignments(PRODUCTION_SOIL_STORAGE_KEY),
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
      completionNote: "感情の波が、ひとつの花として額装されました。",
      collectionTitle: "夕焼けの記憶",
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
      homeCaption: "歩みの粒が、厚い筆あとを思わせる光の花になります。",
      completionNote: "黄色い記憶が、静かな開花として収蔵されました。",
      collectionTitle: "ひまわりの記憶",
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
    id: "water-lily-bloom",
    name: "Water Lily Bloom",
    motif: "Water Lilies",
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
      seedLabel: "水面に浮かぶ光の種",
      homeCaption: "柔らかな歩みが、水面の光を少しずつ開かせます。",
      completionNote: "揺れる水面の記憶が、ひとつの作品になりました。",
      collectionTitle: "睡蓮の記憶",
      collectionLabel: "水面の光とやわらかな花をイメージした植物作品"
    },
    modelPath: "./models/plants/water-lily-bloom/stage-01-seed/wave+leaf+ornament+3d+model+1k.glb",
    stageModelPaths: {
      1: "./models/plants/water-lily-bloom/stage-01-seed/wave+leaf+ornament+3d+model+1k.glb",
      2: "./models/plants/water-lily-bloom/stage-02-sprout/stylized+plant+3d+model+1k.glb",
      3: "./models/plants/water-lily-bloom/stage-03-leaves/plant+3d+model+1k.glb",
      4: "./models/plants/water-lily-bloom/stage-04-bud/stylized+flower+3d+model+1k.glb",
      5: "./models/plants/water-lily-bloom/stage-05-pre-bloom/ornamental+flower+3d+model+1k.glb",
      6: "./models/plants/water-lily-bloom/stage-06-bloom/decorative+flower+3d+model+1k.glb"
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
      "Pad",
      "Bud",
      "Float",
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
      homeCaption: "歩みの粒が、水面に浮かぶ淡い花へと育ちます。",
      completionNote: "水面のきらめきが、ひとつの植物作品になりました。",
      collectionTitle: "水庭の記憶",
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
      completionNote: "静かな微笑みの記憶が、ひとつの植物作品になりました。",
      collectionTitle: "微笑みの記憶",
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
      homeCaption: "歩みの粒が、夜空に渦巻く星の花へと育ちます。",
      completionNote: "星の光と深い青の記憶が、ひとつの植物作品になりました。",
      collectionTitle: "星夜の記憶",
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
      homeCaption: "歩みの粒が、金の文様をまとった植物へと育ちます。",
      completionNote: "金色の余韻が、ひとつの植物作品になりました。",
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
      homeCaption: "歩みの粒が、白と黒の断片をまとった植物へと育ちます。",
      completionNote: "静かな緊張感が、ひとつの植物作品になりました。",
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
      completionNote: "真珠のような光が、ひとつの植物作品になりました。",
      collectionTitle: "真珠光の記憶",
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
  }
];

async function init() {
  document.body.classList.toggle("is-demo-mode", DEMO_MODE);
  state.plants = await loadPlants();
  const saved = loadSavedState();
  state.progress = loadProgress(state.plants, saved);
  state.steps = loadStepState(saved);
  state.selectedPlantId = saved.__activePlantId ?? "";
  migrateWaterSurfaceAssignments();
  normalizeCompletedPlants();
  saveDemoModelSettings();
  saveProductionModelSettings();
  bindEvents();
  bindAppLifecycleEvents();
  bindDeviceTiltParallax();
  exposeStepBridge();
  render();
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

function loadSavedState() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}

function loadUserName() {
  return localStorage.getItem(USER_PROFILE_STORAGE_KEY) || "";
}

function saveUserName(name) {
  const normalizedName = String(name || "").trim().slice(0, 24);
  if (!normalizedName) return false;
  state.userName = normalizedName;
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, normalizedName);
  return true;
}

function loadDemoModelSettings() {
  try {
    return normalizeModelSettings(JSON.parse(localStorage.getItem(DEMO_MODEL_STORAGE_KEY) || "{}"));
  } catch (error) {
    console.warn("Demo model settings could not be loaded:", error);
    return createModelSettings();
  }
}

function saveDemoModelSettings() {
  localStorage.setItem(DEMO_MODEL_STORAGE_KEY, JSON.stringify(state.demoModelSettings));
}

function loadProductionModelSettings() {
  try {
    return normalizeModelSettings(JSON.parse(localStorage.getItem(PRODUCTION_MODEL_STORAGE_KEY) || "{}"));
  } catch (error) {
    console.warn("Production model settings could not be loaded:", error);
    return createModelSettings();
  }
}

function saveProductionModelSettings() {
  localStorage.setItem(PRODUCTION_MODEL_STORAGE_KEY, JSON.stringify(state.productionModelSettings));
}

function loadSoilAssignments(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch (error) {
    console.warn("Soil assignments could not be loaded:", error);
    return {};
  }
}

function saveDemoSoilAssignments() {
  localStorage.setItem(DEMO_SOIL_STORAGE_KEY, JSON.stringify(state.demoSoilAssignments));
}

function saveProductionSoilAssignments() {
  localStorage.setItem(PRODUCTION_SOIL_STORAGE_KEY, JSON.stringify(state.productionSoilAssignments));
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
  return Array.from({ length: MODEL_STAGE_COUNT }, (_, index) => index + 1).reduce((settings, stage) => {
    settings[String(stage)] = { ...DEFAULT_MODEL_SETTINGS, ...seed };
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
  const hasStageSettings = saved?.stages || Array.from({ length: MODEL_STAGE_COUNT }, (_, index) => String(index + 1)).some((stage) => saved?.[stage]);
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
  return Array.from({ length: MODEL_STAGE_COUNT }, (_, index) => String(index + 1)).every((stage) => {
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
  return Array.from({ length: MODEL_STAGE_COUNT }, (_, index) => index + 1).reduce((stages, stage) => {
    stages[String(stage)] = plantId && plantId !== LEGACY_MODEL_SETTINGS_PLANT_ID
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
      stepRemainder: saved[plant.id]?.stepRemainder ?? 0
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...state.progress,
    __activePlantId: state.selectedPlantId,
    __steps: {
      todaySteps: state.steps.todaySteps,
      totalSteps: state.steps.totalSteps,
      date: state.steps.date,
      sourceStatus: state.steps.sourceStatus
    }
  }));
}

function getStage(points) {
  const stageIndex = STAGE_THRESHOLDS.reduce((stage, threshold, index) => {
    return points >= threshold ? index : stage;
  }, 0);
  return Math.min(stageIndex + 1, 6);
}

function getNextThreshold(stage) {
  if (stage >= 6) return COMPLETION_THRESHOLD;
  return STAGE_THRESHOLDS[stage] ?? STAGE_THRESHOLDS[5];
}

function isPlantComplete(progress) {
  return (progress?.points ?? 0) >= COMPLETION_THRESHOLD;
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

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.jump;
      if (state.currentView === "gallery") state.newlyCompletedPlantId = "";
      render();
    });
  });

  document.querySelector("[data-save-artwork]")?.addEventListener("click", () => {
    saveArtworkImage();
  });

  document.querySelector("[data-plaque-close]")?.addEventListener("click", () => {
    completionPlaqueCollapsed = true;
    render();
  });

  document.querySelector("[data-completion-action]")?.addEventListener("click", () => {
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
  });

  document.getElementById("step-sync-button").addEventListener("click", () => {
    syncSmartphoneSteps();
  });

  document.getElementById("motion-button").addEventListener("click", () => {
    startMotionStepCounter();
  });

  document.getElementById("test-step-button").addEventListener("click", () => {
    addStepsToSelectedPlant(10, "水やりとして10歩分の成長を記録しました");
    rainBurst();
  });

  document.getElementById("display-button").addEventListener("click", () => {
    openFrameChoice(state.selectedPlantId);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") exitViewingMode();
  });

  const soundButton = document.getElementById("settings-sound-button");
  const soundState = document.getElementById("settings-sound-state");
  const syncSoundLabel = () => {
    if (soundState) soundState.textContent = isSoundEnabled() ? "オン" : "オフ";
  };
  if (localStorage.getItem(AMBIENT_SOUND_STORAGE_KEY) === "on") {
    setSoundEnabled(true);
  }
  syncSoundLabel();
  soundButton?.addEventListener("click", () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    localStorage.setItem(AMBIENT_SOUND_STORAGE_KEY, next ? "on" : "off");
    syncSoundLabel();
    if (next) playRipplePlop(0.3);
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

  document.getElementById("gallery-wall")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-gallery-open]");
    if (!item) return;
    openGalleryFocus(item.dataset.galleryOpen);
  });

  document.getElementById("gallery-wall")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest("[data-gallery-open]");
    if (!item) return;
    event.preventDefault();
    openGalleryFocus(item.dataset.galleryOpen);
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
    if (!state.galleryFocusPlantId) return;
    if (event.key === "Escape") {
      closeGalleryFocus();
      return;
    }
  });

  document.getElementById("name-entry-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("name-entry-input");
    if (!saveUserName(input?.value)) {
      input?.focus();
      return;
    }
    document.getElementById("name-entry-modal").hidden = true;
    if (pendingFrameChoiceAfterName) {
      const plantId = pendingFrameChoiceAfterName;
      pendingFrameChoiceAfterName = "";
      openFrameChoice(plantId);
      return;
    }
    render();
  });

  document.getElementById("settings-reset-button").addEventListener("click", () => {
    resetArtariumProgress();
  });

  document.getElementById("settings-motion-button").addEventListener("click", () => {
    startMotionStepCounter();
  });

  document.getElementById("settings-sync-button").addEventListener("click", () => {
    syncSmartphoneSteps();
  });

  document.getElementById("settings-weekly-recap-button")?.addEventListener("click", () => {
    openWeeklyRecap();
  });

  document.querySelector("[data-recap-close]")?.addEventListener("click", () => {
    document.getElementById("weekly-recap-modal").hidden = true;
  });

  document.getElementById("settings-test-steps-button").addEventListener("click", () => {
    addStepsToSelectedPlant(100, "開発用に100歩分を加算しました");
  });

  document.getElementById("demo-model-settings")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-demo-model-setting]");
    if (!input) return;
    updateDemoModelSetting(input);
  });

  document.getElementById("demo-model-settings")?.addEventListener("change", (event) => {
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
    const referenceButton = event.target.closest("[data-demo-model-reference]");
    const autoReflectionButton = event.target.closest("[data-demo-reflection-auto]");
    const saveButton = event.target.closest("[data-demo-model-save]");
    const applyButton = event.target.closest("[data-demo-model-apply-production]");
    const openProductionButton = event.target.closest("[data-demo-model-open-production]");
    const stepButton = event.target.closest("[data-demo-model-step]");
    const stageButton = event.target.closest("[data-demo-model-stage]");
    const bloomPreviewButton = event.target.closest("[data-demo-bloom-preview]");
    if (bloomPreviewButton) {
      playBloomCelebration(document.getElementById("home-active-artwork"));
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
      if (progress && !isPlantComplete(progress)) {
        progress.points = COMPLETION_THRESHOLD;
        progress.stepRemainder = 0;
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
    if (resetButton || referenceButton) {
      setModelSettingsForStage(
        state.demoModelSettings,
        state.selectedPlantId,
        state.demoModelStage,
        getDefaultModelSettingsForStage(state.demoModelSettings, state.demoModelStage, state.selectedPlantId)
      );
      render();
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
      saveButton.textContent = "保存しました";
      window.setTimeout(() => {
        saveButton.textContent = "保存";
      }, 1200);
      return;
    }
    if (applyButton) {
      applyDemoSettingsToProduction();
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
  localStorage.setItem(PRODUCTION_SYNC_STORAGE_KEY, JSON.stringify({
    version: ASSET_VERSION,
    plantId: state.selectedPlantId,
    stage: state.demoModelStage,
    syncedAt: Date.now()
  }));
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
    renderInstallNotice();
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
  renderInstallNotice();
  renderNetworkStatus();
  renderHome();
  renderPlantSelector();
  renderGrowView();
  renderGallery();
  renderCodex();
  renderSettings();
  renderFrameChoiceModal();
  renderGalleryFocusModal();
  initHomeModelViewer();
  initGalleryModelViewers();
}

function renderInstallNotice() {
  const notice = document.getElementById("install-notice");
  if (!notice) return;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  notice.hidden = isStandalone || !deferredInstallPrompt;
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
}

let seedPreviewId = null;

function renderHome() {
  const selectedPlant = getSelectedPlant();
  const hero = document.querySelector(".daily-hero");
  hero.querySelector(".seed-confirm-bar")?.remove();
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
    hero.classList.add("is-seed-choice");
    document.getElementById("home-title").textContent = "最初の作品を選ぶ。";
    document.getElementById("home-active-caption").textContent = "選んだ作品が開花するまで、ひとつの植物を育てます。";
    homeArtwork.removeAttribute("style");
    homeArtwork.removeAttribute("data-stage");
    homeArtwork.removeAttribute("data-home-model-viewer");
    homeArtwork.removeAttribute("data-plant-model");
    homeArtwork.removeAttribute("data-soil-model");
    homeArtwork.removeAttribute("data-environment");
    homeArtwork.removeAttribute("data-ready");
    homeArtwork.dataset.modelRenderToken = String(++modelRenderSerial);
    homeArtwork.classList.remove("is-3d", "is-water-environment", "is-bloom-complete", "is-newly-complete", "is-pearl-material");
    renderCompletionPlaque(null, false);
    homeArtwork.innerHTML = `
      <div class="seed-choice-list">
        ${state.plants.map((plant) => `
          <button class="seed-choice" type="button" data-seed="${plant.id}" style="${paletteVars(plant)}">
            <span class="seed-art">${plantMarkup(1)}</span>
            <span class="seed-copy">
              <strong>${plant.name}</strong>
              <small>${plant.copy?.seedLabel ?? `${plant.motif} / ${plant.artist}`}</small>
            </span>
          </button>
        `).join("")}
      </div>
    `;
    document.querySelectorAll("[data-seed]").forEach((button) => {
      button.addEventListener("click", () => {
        seedPreviewId = button.dataset.seed;
        render();
      });
    });
    document.getElementById("daily-progress-line")?.setAttribute("hidden", "");
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
  homeArtwork.dataset.homeModelViewer = "true";
  homeArtwork.dataset.plantId = selectedPlant.id;
  homeArtwork.dataset.plantModel = getPlantModelPath(selectedPlant, visualStage);
  homeArtwork.dataset.soilModel = getSoilModelPath(selectedPlant, { preferDemo: DEMO_MODE });
  homeArtwork.dataset.environment = getEnvironmentTypeForPlant(selectedPlant, { preferDemo: DEMO_MODE });
  homeArtwork.removeAttribute("data-ready");
  homeArtwork.dataset.modelRenderToken = String(++modelRenderSerial);
  homeArtwork.classList.remove("is-3d");
  homeArtwork.classList.toggle("is-water-environment", getEnvironmentTypeForPlant(selectedPlant, { preferDemo: DEMO_MODE }) === "water");
  homeArtwork.classList.toggle("is-pearl-material", selectedPlant.id === "pearl-light-bloom");
  const awaitingFrameChoice = selectedComplete && !selectedProgress.displayed;
  homeArtwork.classList.toggle("is-bloom-complete", selectedComplete);
  homeArtwork.classList.toggle("is-newly-complete", awaitingFrameChoice);
  // 3Dモデルを読み込む場合、つなぎのCSS水面は出さない（読み込み完了時のチラつき防止）
  const homePlantModelPath = getPlantModelPath(selectedPlant, visualStage);
  homeArtwork.innerHTML = homePlantModelPath
    ? modelLoadingMarkup()
    : `${environmentLayerMarkup(selectedPlant, { preferDemo: DEMO_MODE })}${plantMarkup(visualStage)}`;
  mountSkyBackground(homeArtwork, { waterTint: skyWaterTint(selectedPlant) });
  mountViewingButton(homeArtwork);
  hero.classList.remove("is-seed-preview");
  // 動的な状態表示: 植物名・ステージ・今日の歩数・開花まで
  const STAGE_NAMES = ["", "種", "芽生え", "つぼみ", "ふくらむ蕾", "ほころび", "開花"];
  const todaySteps = state.steps?.todaySteps || 0;
  document.getElementById("home-title").textContent = selectedPlant.name;
  document.getElementById("home-active-caption").textContent = selectedComplete
    ? "作品が完成しました。額装してコレクションへ。"
    : `${STAGE_NAMES[selectedStage] ?? ""} ・ 今日 ${todaySteps.toLocaleString()}歩 ・ 開花まで あと${(Math.max(0, COMPLETION_THRESHOLD - selectedProgress.points) * STEPS_PER_POINT).toLocaleString()}歩`;
  // タブバー直上の目標達成ライン（1日の目標に対する今日の歩数）
  const progressLine = document.getElementById("daily-progress-line");
  if (progressLine) {
    progressLine.hidden = false;
    progressLine.setAttribute("aria-label", `今日の目標 ${DAILY_STEP_GOAL.toLocaleString()}歩 のうち ${todaySteps.toLocaleString()}歩`);
    const fill = document.getElementById("daily-progress-fill");
    if (fill) fill.style.width = `${Math.round(Math.min(1, todaySteps / DAILY_STEP_GOAL) * 100)}%`;
  }
  if (!selectedComplete) maybeShowTapHint(homeArtwork);
  renderCompletionPlaque(selectedPlant, awaitingFrameChoice);
}

function renderSeedPreview(hero, plant) {
  hero.classList.remove("is-seed-choice");
  hero.classList.add("is-seed-preview");
  document.getElementById("home-title").textContent = plant.name;
  document.getElementById("home-active-caption").textContent =
    `${plant.motif} / ${plant.artist}, ${plant.year} — 開花後の姿`;
  const homeArtwork = document.getElementById("home-active-artwork");
  homeArtwork.style.cssText = paletteVars(plant);
  homeArtwork.dataset.stage = "6";
  homeArtwork.dataset.homeModelViewer = "true";
  homeArtwork.dataset.plantId = plant.id;
  homeArtwork.dataset.plantModel = getPlantModelPath(plant, 6);
  homeArtwork.dataset.soilModel = getSoilModelPath(plant, { preferDemo: DEMO_MODE });
  homeArtwork.dataset.environment = getEnvironmentTypeForPlant(plant, { preferDemo: DEMO_MODE });
  homeArtwork.removeAttribute("data-ready");
  homeArtwork.dataset.modelRenderToken = String(++modelRenderSerial);
  homeArtwork.classList.remove("is-3d", "is-bloom-complete", "is-newly-complete");
  homeArtwork.classList.toggle("is-water-environment", getEnvironmentTypeForPlant(plant, { preferDemo: DEMO_MODE }) === "water");
  homeArtwork.classList.toggle("is-pearl-material", plant.id === "pearl-light-bloom");
  homeArtwork.innerHTML = getPlantModelPath(plant, 6)
    ? modelLoadingMarkup()
    : `${environmentLayerMarkup(plant, { preferDemo: DEMO_MODE })}${plantMarkup(6)}`;
  mountSkyBackground(homeArtwork, { waterTint: skyWaterTint(plant) });
  renderCompletionPlaque(null, false);
  document.getElementById("daily-progress-line")?.setAttribute("hidden", "");
  const bar = document.createElement("div");
  bar.className = "seed-confirm-bar";
  bar.innerHTML = `
    <button class="primary-action" type="button" data-seed-confirm>この種を育てる</button>
    <button class="secondary-action" type="button" data-seed-back>ほかの種を見る</button>
  `;
  hero.appendChild(bar);
  bar.querySelector("[data-seed-confirm]").addEventListener("click", () => {
    state.selectedPlantId = plant.id;
    seedPreviewId = null;
    saveProgress();
    render();
  });
  bar.querySelector("[data-seed-back]").addEventListener("click", () => {
    seedPreviewId = null;
    render();
  });
}

const TAP_HINT_KEY = "artarium-tap-hinted";
let tapHintDismissed = false;

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

function maybeShowTapHint(container) {
  if (tapHintDismissed || localStorage.getItem(TAP_HINT_KEY)) return;
  if (container.querySelector(".tap-hint")) return;
  const hint = document.createElement("div");
  hint.className = "tap-hint";
  hint.textContent = "水面にふれてみて";
  container.appendChild(hint);
  const dismiss = () => {
    tapHintDismissed = true;
    localStorage.setItem(TAP_HINT_KEY, "1");
    hint.classList.add("is-done");
    window.setTimeout(() => hint.remove(), 700);
    window.removeEventListener("artarium:ripple", dismiss);
  };
  window.addEventListener("artarium:ripple", dismiss);
}

// 空・水面・植物のキャンバスを1枚に合成し、美術館プレート付きで保存する
function saveArtworkImage() {
  const container = document.getElementById("home-active-artwork");
  const plant = getSelectedPlant();
  if (!container || !plant) return;
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111813";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  container.querySelectorAll("canvas").forEach((layer) => {
    const r = layer.getBoundingClientRect();
    try {
      ctx.drawImage(layer, (r.left - rect.left) * scale, (r.top - rect.top) * scale, r.width * scale, r.height * scale);
    } catch (error) { /* 描けないレイヤーは飛ばす */ }
  });
  const serif = '"Hiragino Mincho ProN", "Yu Mincho", Georgia, serif';
  const pw = canvas.width * 0.66;
  const ph = Math.max(90, canvas.width * 0.16);
  const px = (canvas.width - pw) / 2;
  const py = canvas.height - ph - canvas.width * 0.05;
  ctx.fillStyle = "rgba(12, 18, 14, 0.82)";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "rgba(194, 164, 94, 0.9)";
  ctx.lineWidth = Math.max(2, canvas.width * 0.003);
  ctx.strokeRect(px, py, pw, ph);
  ctx.textAlign = "center";
  ctx.fillStyle = "#edeae0";
  ctx.font = `${Math.round(ph * 0.28)}px ${serif}`;
  ctx.fillText(plant.name, canvas.width / 2, py + ph * 0.42);
  ctx.fillStyle = "#a8b0a4";
  ctx.font = `${Math.round(ph * 0.16)}px ${serif}`;
  const totalSteps = (state.progress[plant.id]?.points ?? 0) * STEPS_PER_POINT;
  ctx.fillText(
    `${state.userName || "artarium"} ・ ${new Date().toLocaleDateString("ja-JP")} ・ ${totalSteps.toLocaleString()}歩の記録`,
    canvas.width / 2,
    py + ph * 0.72
  );
  const link = document.createElement("a");
  link.download = `artarium-${plant.id}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

let completionPlaqueCollapsed = false;
let completionPlaqueInstant = false;

function renderCompletionPlaque(plant, shouldShow) {
  const plaque = document.getElementById("completion-plaque");
  if (!plaque) return;
  const hero = document.querySelector(".daily-hero");
  hero?.querySelector(".plaque-reopen")?.remove();
  if (!plant || !shouldShow) {
    plaque.hidden = true;
    completionPlaqueCollapsed = false;
    completionPlaqueInstant = false;
    return;
  }
  if (completionPlaqueCollapsed) {
    // 折りたたみ中: 植物を隠さない小さなチップだけ残す
    plaque.hidden = true;
    const chip = document.createElement("button");
    chip.className = "plaque-reopen";
    chip.type = "button";
    chip.textContent = "額装へ";
    chip.addEventListener("click", () => {
      completionPlaqueCollapsed = false;
      completionPlaqueInstant = true;
      render();
    });
    hero?.appendChild(chip);
    return;
  }
  plaque.hidden = false;
  plaque.classList.toggle("is-instant", completionPlaqueInstant);
  document.getElementById("completion-title").textContent = plant.name;
  document.getElementById("completion-subtitle").textContent = plant.copy?.completionNote ?? `${plant.motif} / ${plant.artist}, ${plant.year}`;
  const action = plaque.querySelector("[data-completion-action]");
  if (action) {
    const progress = state.progress[plant.id];
    action.textContent = progress?.displayed ? "コレクションを見る" : "額装を選ぶ";
    action.dataset.jump = progress?.displayed ? "gallery" : "";
    action.dataset.frameChoiceOpen = progress?.displayed ? "" : plant.id;
  }
}

function renderPlantSelector() {
  const locked = isActivePlantLocked();
  document.getElementById("plant-selector").innerHTML = state.plants.map((plant) => {
    const progress = state.progress[plant.id];
    const stage = getStage(progress.points);
    const isLocked = locked && plant.id !== state.selectedPlantId;
    return `
      <button class="plant-option ${plant.id === state.selectedPlantId ? "is-selected" : ""}" type="button" data-plant="${plant.id}" ${isLocked ? "disabled" : ""}>
        <span>${plant.name}</span>
        <small>${isLocked ? "現在の作品が開花するまで選択できません" : `開花段階 ${stage} / ${progress.points}pt`}</small>
      </button>
    `;
  }).join("");

  document.querySelectorAll("[data-plant]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPlantId = button.dataset.plant;
      render();
    });
  });
}

function renderGrowView() {
  const plant = getSelectedPlant();
  if (!plant) {
    state.currentView = "home";
    return;
  }

  const progress = state.progress[plant.id];
  const stage = getStage(progress.points);
  const nextThreshold = getNextThreshold(stage);
  const previousThreshold = STAGE_THRESHOLDS[stage - 1];
  const stageProgress = isPlantComplete(progress) ? 100 : ((progress.points - previousThreshold) / (nextThreshold - previousThreshold)) * 100;

  document.getElementById("grow-scene").style.cssText = paletteVars(plant);
  document.getElementById("grow-scene").innerHTML = plantMarkup(stage);
  document.getElementById("grow-motif").textContent = `${plant.motif} / ${plant.artist}, ${plant.year}`;
  document.getElementById("grow-name").textContent = plant.name;
  document.getElementById("grow-description").textContent = plant.temperament;
  document.getElementById("stage-meter-fill").style.width = `${stageProgress}%`;
  document.getElementById("grow-stage-label").textContent = isPlantComplete(progress)
    ? `Stage ${stage}: ${plant.stageNames[stage - 1]} / 開花完了`
    : `Stage ${stage}: ${plant.stageNames[stage - 1]}`;
  document.getElementById("grow-points-label").textContent = isPlantComplete(progress) ? `${progress.points}pt / 完成` : `${progress.points}pt / 次 ${nextThreshold}pt`;
  document.getElementById("today-steps-label").textContent = `${formatNumber(state.steps.todaySteps)}歩`;
  document.getElementById("total-steps-label").textContent = `${formatNumber(state.steps.totalSteps)}歩`;
  document.getElementById("growth-points-label").textContent = `${progress.points}pt`;
  document.getElementById("current-stage-label").textContent = isPlantComplete(progress) ? "Stage 6 開花完了" : `Stage ${stage}`;
  document.getElementById("step-status-label").textContent = state.steps.sourceStatus;

  const displayButton = document.getElementById("display-button");
  displayButton.disabled = !isPlantComplete(progress) || progress.displayed;
  displayButton.textContent = progress.displayed ? "展示済み" : "額装を選ぶ";

  document.getElementById("step-sync-button").disabled = isPlantComplete(progress);
  document.getElementById("motion-button").disabled = isPlantComplete(progress) || state.steps.motionEnabled;
  document.getElementById("test-step-button").disabled = isPlantComplete(progress);
}

async function syncSmartphoneSteps() {
  const bridge = window.ArtariumStepBridge;
  if (!bridge?.getTodaySteps) {
    state.steps.sourceStatus = "スマホ歩数計ブリッジが未接続です。テストボタンで加算できます。";
    saveProgress();
    render();
    return;
  }

  try {
    const data = await bridge.getTodaySteps();
    applyStepSnapshot(data, "スマホ歩数計から同期しました");
  } catch (error) {
    console.warn(error);
    state.steps.sourceStatus = "歩数データを取得できませんでした。テストボタンで加算できます。";
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

function addStepsToSelectedPlant(steps, status) {
  resetDailyStepsIfNeeded();
  state.steps.todaySteps += steps;
  state.steps.totalSteps += steps;
  addGrowthFromSteps(steps);
  recordDailySteps();
  state.steps.sourceStatus = status;
  saveProgress();
  render();
}

function addGrowthFromSteps(steps) {
  const progress = state.progress[state.selectedPlantId];
  if (!progress || isPlantComplete(progress)) return;

  const wasComplete = isPlantComplete(progress);
  const stageBefore = getStage(progress.points);
  const availableSteps = progress.stepRemainder + steps;
  const pointsToAdd = Math.floor(availableSteps / STEPS_PER_POINT);
  progress.stepRemainder = availableSteps % STEPS_PER_POINT;
  if (!pointsToAdd) return;
  progress.points = Math.min(progress.points + pointsToAdd, COMPLETION_THRESHOLD);
  if (getStage(progress.points) > stageBefore) {
    // ステージが上がった: 次の3D描画完了時に開花演出を再生する
    state.pendingBloomCelebration = state.selectedPlantId;
  }
  if (!wasComplete && isPlantComplete(progress)) {
    state.newlyCompletedPlantId = state.selectedPlantId;
  }
}

// 成長の節目の演出: 画面がふわっと明るくなり、金色の粒が舞う
function playBloomCelebration(container) {
  if (!container || !container.isConnected) return;
  container.classList.remove("is-bloom-pop");
  void container.offsetWidth; // アニメーションを再実行できるようリフロー
  container.classList.add("is-bloom-pop");

  const burst = document.createElement("div");
  burst.className = "bloom-burst";
  burst.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 18; i++) {
    const particle = document.createElement("i");
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
    const distance = 90 + Math.random() * 130;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance * 0.8}px`);
    particle.style.setProperty("--delay", `${(Math.random() * 0.25).toFixed(2)}s`);
    burst.appendChild(particle);
  }
  container.appendChild(burst);
  setTimeout(() => {
    burst.remove();
    container.classList.remove("is-bloom-pop");
  }, 2600);
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
  button.addEventListener("click", () => {
    const active = container.classList.toggle("is-viewing");
    document.body.classList.toggle("is-viewing-mode", active);
    button.textContent = active ? "もどる" : "眺める";
  });
  container.appendChild(button);
}

function exitViewingMode() {
  const viewing = document.querySelector(".daily-artwork.is-viewing");
  if (viewing) viewing.querySelector(".viewing-mode-button")?.click();
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
    state.steps.sourceStatus = "この端末ではモーション歩数検知を利用できません。テストボタンで加算できます。";
    saveProgress();
    render();
    return;
  }

  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") {
        state.steps.sourceStatus = "モーション利用が許可されませんでした。テストボタンで加算できます。";
        saveProgress();
        render();
        return;
      }
    }

    window.addEventListener("devicemotion", handleDeviceMotion);
    state.steps.motionEnabled = true;
    state.steps.sourceStatus = "簡易歩数計を開始しました。スマホを持って歩くと加算します。";
    saveProgress();
    render();
  } catch (error) {
    console.warn(error);
    state.steps.sourceStatus = "歩数計を開始できませんでした。テストボタンで加算できます。";
    saveProgress();
    render();
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
  addStepsToSelectedPlant(1, "簡易歩数計で歩数を検知しています");
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
  const keys = Object.keys(state.steps.history).sort();
  while (keys.length > 21) delete state.steps.history[keys.shift()];
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
  modal.hidden = false;
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

function renderCodex() {
  const summary = document.getElementById("codex-summary");
  const grid = document.getElementById("codex-grid");
  const head = document.querySelector(".codex-head");
  if (!summary || !grid) return;
  // 名画の由来は、収蔵した作品のぶんだけ増えていく（美術館のキャプション）
  const collectedPlants = state.plants.filter((plant) => state.progress[plant.id].displayed);
  const hasCollection = collectedPlants.length > 0;
  if (head) head.hidden = !hasCollection;
  grid.hidden = !hasCollection;
  if (!hasCollection) {
    grid.innerHTML = "";
    return;
  }
  summary.textContent = `収蔵 ${collectedPlants.length} / ${state.plants.length}`;
  grid.innerHTML = collectedPlants.map((plant) => {
    const codex = CODEX_NOTES[plant.id];
    return `
      <article class="codex-card is-collected" style="${paletteVars(plant)}">
        <div class="codex-thumb">${plantMarkup(6)}</div>
        <div class="codex-copy">
          <div class="codex-title-row">
            <h3>${plant.name}</h3>
          </div>
          <p class="codex-source">${codex?.source ?? `${plant.motif} / ${plant.artist}, ${plant.year}`}</p>
          <p class="codex-note">${codex?.note ?? plant.temperament ?? ""}</p>
        </div>
      </article>
    `;
  }).join("");
}

function renderSettings() {
  const motionState = document.getElementById("settings-motion-state");
  if (!motionState) return;
  const selectedPlant = getSelectedPlant();
  const selectedProgress = selectedPlant ? state.progress[selectedPlant.id] : null;
  const isComplete = selectedProgress ? isPlantComplete(selectedProgress) : false;
  motionState.textContent = state.steps.motionEnabled ? "接続中" : "未接続";
  document.getElementById("settings-today-steps").textContent = `${formatNumber(state.steps.todaySteps)}歩`;
  document.getElementById("settings-step-status").textContent = state.steps.sourceStatus;
  document.getElementById("settings-motion-button").disabled = state.steps.motionEnabled;
  document.getElementById("settings-sync-button").disabled = isComplete;
  document.getElementById("settings-test-steps-button").disabled = !selectedPlant || isComplete;
  document.getElementById("settings-test-steps-button").hidden = !DEMO_MODE;
  document.getElementById("settings-author-name").textContent = state.userName || "未設定";
  renderDemoModelSettings();
}

function requestUserNameIfNeeded() {
  const modal = document.getElementById("name-entry-modal");
  const input = document.getElementById("name-entry-input");
  if (!modal || state.userName) return;
  modal.hidden = false;
  window.setTimeout(() => input?.focus(), 80);
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
    { key: "reflectionScale", label: "反射 サイズ", min: 0.2, max: 2, step: 0.01 }
  ];
  const selectedPlant = getSelectedPlant();
  const stageSettings = getModelSettings(state.demoModelSettings, selectedPlant?.id, state.demoModelStage);
  const selectedSoilType = selectedPlant ? getSoilTypeForPlant(selectedPlant, { preferDemo: true }) : "";

  panel.innerHTML = `
    <p class="settings-label">デモ用 3D調整</p>
      <div class="demo-settings-panel">
        <div class="demo-settings-head">
          <span>Stage${state.demoModelStage}を調整中</span>
          <span class="demo-settings-actions">
            <button class="secondary-action" data-demo-model-reference type="button">参考画像</button>
            <button class="secondary-action" data-demo-model-reset type="button">初期値</button>
            <button class="primary-action" data-demo-model-save type="button">保存</button>
            <button class="primary-action" data-demo-model-apply-production type="button">本番へ反映</button>
            <button class="secondary-action" data-demo-model-open-production type="button">本番で確認</button>
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
        <button class="secondary-action" data-demo-shed-petals type="button">花びらを散らす</button>
        <button class="secondary-action" data-demo-complete-plant type="button">この植物を完成させる</button>
        <button class="secondary-action" data-demo-parallax type="button">視差プレビュー: ${demoMouseParallax ? "オン" : "オフ"}</button>
      </div>
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

function resetArtariumProgress() {
  if (!confirm("Artariumの進行状況を初期化しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  state.progress = loadProgress(state.plants, {});
  state.steps = loadStepState({});
  state.selectedPlantId = state.plants[0]?.id ?? "";
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

function confirmFrameChoice() {
  const plantId = state.frameChoicePlantId;
  const progress = state.progress[plantId];
  if (!progress) return;
  progress.displayed = true;
  state.frameChoicePlantId = "";
  state.newlyCompletedPlantId = "";
  state.currentView = "gallery";
  saveProgress();
  render();
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
  state.galleryFocusPlantId = "";
  state.galleryFocusAngle = 0;
  renderGalleryFocusModal();
}

function updateGalleryFocusAngle() {
  const stage = document.querySelector("[data-gallery-focus-stage]");
  if (!stage) return;
  stage.dataset.viewYaw = String(state.galleryFocusAngle);
  if (stage.__artariumDisplayGroup && stage.__artariumScene) {
    stage.__artariumDisplayGroup.rotation.y = state.galleryFocusAngle;
    stage.__artariumScene.renderer.render(stage.__artariumScene.scene, stage.__artariumScene.camera);
  }
}

function startGalleryFocusDrag(event, target) {
  event.preventDefault();
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startAngle = state.galleryFocusAngle;
  target.setPointerCapture?.(pointerId);
  target.classList.add("is-dragging");

  const move = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    state.galleryFocusAngle = Math.min(0.38, Math.max(-0.38, startAngle + (moveEvent.clientX - startX) * 0.004));
    updateGalleryFocusAngle();
  };
  const stop = (stopEvent) => {
    if (stopEvent.pointerId !== pointerId) return;
    target.releasePointerCapture?.(pointerId);
    target.classList.remove("is-dragging");
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", stop);
    target.removeEventListener("pointercancel", stop);
  };

  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", stop);
  target.addEventListener("pointercancel", stop);
}

function renderFrameChoiceModal() {
  const modal = document.getElementById("frame-choice-modal");
  if (!modal) return;
  const plant = state.plants.find((item) => item.id === state.frameChoicePlantId);
  const progress = plant ? state.progress[plant.id] : null;
  modal.hidden = !plant || !progress || progress.displayed;
  if (modal.hidden) return;

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
  `;
  document.getElementById("frame-choice-options").innerHTML = getFrameOptions(plant).map((type) => `
    <button
      class="choice-option ${type === frameType ? "is-active" : ""}"
      data-frame-choice="${type}"
      type="button"
    >
      <span class="frame-swatch" style="--frame:${FRAME_TYPES[type]?.material ?? "#5a3b25"}"></span>
      <strong>${FRAME_TYPES[type]?.label ?? type}</strong>
    </button>
  `).join("");
  initGalleryModelViewers();
}

function renderGalleryFocusModal() {
  const modal = document.getElementById("gallery-focus-modal");
  if (!modal) return;
  const plant = state.plants.find((item) => item.id === state.galleryFocusPlantId);
  const progress = plant ? state.progress[plant.id] : null;
  modal.hidden = !plant || !progress?.displayed;
  if (!plant || !progress?.displayed) {
    modal.innerHTML = "";
    return;
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
          <small>${getArchiveLine(plant)}</small>
        </div>
        <p class="plaque-frame-label">額装: ${getFrameLabel(plant)}</p>
      </div>
    </div>
  `;
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
  return `${state.userName || "Artarium Artist"} / ${plant.year}`;
}

function renderGallery() {
  const displayedPlants = state.plants.filter((plant) => state.progress[plant.id].displayed);
  document.getElementById("gallery-summary").textContent = `作品 ${displayedPlants.length} / ${state.plants.length}`;

  if (!displayedPlants.length) {
    const wall = document.getElementById("gallery-wall");
    wall.innerHTML = `
      <div class="empty-gallery">
        <div class="empty-frame is-lit" aria-hidden="true">
          <span class="empty-frame-plate">最初の作品を<br>待っています</span>
        </div>
        <h3>展示を待つ壁</h3>
        <p>開花した作品が、シャドーボックスの額縁に収められてこの壁に並びます。</p>
        <button class="secondary-action" type="button" data-empty-jump-home>育てにいく</button>
      </div>
    `;
    wall.querySelector("[data-empty-jump-home]")?.addEventListener("click", () => {
      state.currentView = "home";
      render();
    });
    return;
  }

  document.getElementById("gallery-wall").innerHTML = displayedPlants.map((plant) => `
    <article
      class="shadow-box"
      style="${paletteVars(plant)}${backdropVars("nocturne")}"
      data-gallery-open="${plant.id}"
      role="button"
      tabindex="0"
      aria-label="${getCollectionTitle(plant)}を拡大表示"
    >
      <div class="exhibit-light" aria-hidden="true"></div>
      <div class="exhibit-hang">
        <div
          class="model-stage ${plant.id === "pearl-light-bloom" ? "is-pearl-material" : ""}"
          data-model-viewer
          data-stage="6"
          data-plant-id="${plant.id}"
          data-plant-model="${getPlantModelPath(plant, 6)}"
          data-soil-model="${getSoilModelPath(plant)}"
          data-environment="${getEnvironmentTypeForPlant(plant)}"
          data-frame-model="${getFrameModelPath(plant)}"
          data-frame-type="${state.progress[plant.id].frameType}"
          data-backdrop-type="nocturne"
          data-settings-source="production"
        >
          ${galleryViewerMarkup(plant)}
        </div>
      </div>
      <div class="artwork-plaque">
        <div>
          <h3>${getCollectionTitle(plant)}</h3>
          <p>${plant.copy?.collectionLabel ?? plant.motif}</p>
          <small>${getArchiveLine(plant)}</small>
        </div>
        <p class="plaque-frame-label">額装: ${getFrameLabel(plant)}</p>
      </div>
    </article>
  `).join("");
}

function paletteVars(plant) {
  return `--c1:${plant.palette[0]};--c2:${plant.palette[1]};--c3:${plant.palette[2]};--c4:${plant.palette[3]};`;
}

function backdropVars(type) {
  const colors = BACKDROP_TYPES[type]?.colors ?? BACKDROP_TYPES.nocturne.colors;
  return `--bg1:${colors[0]};--bg2:${colors[1]};--bg3:${colors[2]};`;
}

function getFrameOptions(plant) {
  return plant.frameOptions?.length ? plant.frameOptions : Object.keys(FRAME_TYPES);
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
  viewer.querySelectorAll("canvas:not(.sky-canvas):not(.water-surface-canvas)").forEach((canvas) => canvas.remove());
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
  const [frameModel, plantModel, soilModel] = await Promise.all([
    safeLoadGltf(loader, container.dataset.frameModel),
    loadGltf(loader, container.dataset.plantModel),
    safeLoadGltf(loader, container.dataset.soilModel)
  ]);
  if (!isCurrentModelRender(container, token)) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const oldCanvases = Array.from(container.querySelectorAll("canvas:not(.sky-canvas):not(.water-surface-canvas)"));
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

  // 額はCSSの額（.fallback-frame）で描く。GLBの額は箱の奥行きが深く、
  // 作品と重ねると板が植物を隠すため使わない（モデルは残置、frameModelは読み込むが未使用）
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
  if (soil) {
    artworkGroup.add(createTunedModelGroup(THREE, soil, {
      x: modelSettings.soilX,
      y: modelSettings.soilY,
      z: modelSettings.soilZ,
      pitch: modelSettings.soilRotX,
      yaw: modelSettings.soilRotY,
      roll: modelSettings.soilRotZ
    }));
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
  const plantEffects = createPlantEffects(THREE, plantDefinition, plantGroup, {
    x: modelSettings.plantX,
    y: modelSettings.plantY,
    z: modelSettings.plantZ,
    reflection: reflectionGroup,
    waterY: waterSurface ? waterSurface.mesh.position.y : undefined,
    onPetalLand: createPetalLandHandler(waterSurface)
  }, Number(container.dataset.stage) || 1);
  if (plantEffects) artworkGroup.add(plantEffects.group);
  displayGroup.add(artworkGroup);
  displayGroup.rotation.y = Number(container.dataset.viewYaw) || 0;
  scene.add(displayGroup);
  container.__artariumDisplayGroup = displayGroup;
  container.__artariumScene = { renderer, scene, camera };

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

  // 拡大表示（フォーカス）ではドラッグで作品をゆっくり回して鑑賞できる
  if (container.classList.contains("gallery-focus-stage")) {
    const dragTarget = renderer.domElement;
    let dragging = false;
    let lastPointerX = 0;
    dragTarget.style.cursor = "grab";
    dragTarget.addEventListener("pointerdown", (event) => {
      dragging = true;
      lastPointerX = event.clientX;
      dragTarget.setPointerCapture(event.pointerId);
      dragTarget.style.cursor = "grabbing";
    });
    // 展示品なので裏側までは回さない（左右±40度に制限）
    const MAX_FOCUS_YAW = Math.PI * 0.22;
    dragTarget.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const nextYaw = displayGroup.rotation.y + (event.clientX - lastPointerX) * 0.008;
      displayGroup.rotation.y = Math.max(-MAX_FOCUS_YAW, Math.min(MAX_FOCUS_YAW, nextYaw));
      lastPointerX = event.clientX;
      state.galleryFocusAngle = displayGroup.rotation.y;
      renderer.render(scene, camera);
    });
    const endDrag = () => {
      dragging = false;
      dragTarget.style.cursor = "grab";
    };
    dragTarget.addEventListener("pointerup", endDrag);
    dragTarget.addEventListener("pointercancel", endDrag);
  }
}

async function createPlantScene(container, runtime, token) {
  const { THREE, GLTFLoader } = runtime;
  const loader = new GLTFLoader();
  const modelSettings = getSceneModelSettings(container.dataset.stage, container.dataset.plantId);
  const environmentType = container.dataset.environment || "soil";
  const plantDefinition = state.plants.find((plant) => plant.id === container.dataset.plantId);
  const [plantModel, soilModel] = await Promise.all([
    loadGltf(loader, container.dataset.plantModel),
    safeLoadGltf(loader, container.dataset.soilModel)
  ]);
  if (!isCurrentModelRender(container, token)) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const oldCanvases = Array.from(container.querySelectorAll("canvas:not(.sky-canvas):not(.water-surface-canvas)"));
  if (!isCurrentModelRender(container, token)) return;
  container.appendChild(renderer.domElement);
  container.classList.add("is-3d");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.55, 5.2);

  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const sunLighting = getSunLighting(THREE);
  const keyLight = new THREE.DirectionalLight(sunLighting.color, 2.4);
  keyLight.position.copy(sunLighting.position);
  scene.add(keyLight);
  addArtworkMaterialLights(THREE, scene, plantDefinition);

  const plant = normalizeModel(THREE, plantModel.scene, modelSettings.plantScale);
  preparePlantSurfaceModel(THREE, plant, plantDefinition, Number(container.dataset.stage) || 1);
  const reflectionPlant = environmentType === "water" ? prepareReflectionModel(THREE, plant.clone(true), Number(container.dataset.stage) || 1, modelSettings) : null;
  const waterSurface = environmentType === "water" ? createShaderWaterSurface(THREE, plantDefinition, modelSettings) : null;
  const soil = environmentType !== "water" && soilModel ? normalizeModel(THREE, soilModel.scene, modelSettings.soilScale) : null;
  if (soil) prepareSoilModel(THREE, soil, plantDefinition);
  const artworkGroup = new THREE.Group();
  if (soil) {
    artworkGroup.add(createTunedModelGroup(THREE, soil, {
      x: modelSettings.soilX,
      y: modelSettings.soilY,
      z: modelSettings.soilZ,
      pitch: modelSettings.soilRotX,
      yaw: modelSettings.soilRotY,
      roll: modelSettings.soilRotZ
    }));
  }
  if (waterSurface) {
    artworkGroup.add(waterSurface.mesh);
  } else if (environmentType === "water") {
    artworkGroup.add(createWaterEnvironmentGroup(THREE, plantDefinition, modelSettings));
  }
  let reflectionGroup = null;
  if (reflectionPlant) {
    reflectionGroup = createWaterReflectionGroup(THREE, reflectionPlant, modelSettings);
    artworkGroup.add(reflectionGroup);
  }
  const plantGroup = createTunedModelGroup(THREE, plant, {
    x: modelSettings.plantX,
    y: modelSettings.plantY,
    z: modelSettings.plantZ,
    pitch: modelSettings.plantRotX,
    yaw: modelSettings.plantRotY,
    roll: modelSettings.plantRotZ
  });
  artworkGroup.add(plantGroup);
  const plantEffects = createPlantEffects(THREE, plantDefinition, plantGroup, {
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
  container.querySelectorAll("canvas:not(.sky-canvas):not(.water-surface-canvas)").forEach((canvas) => canvas.remove());
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
  "scream-bloom": { color: "#8a4a2e", emissive: "#5a1f0f", emissiveIntensity: 0.12, roughness: 0.75 },
  "sunflower-bloom": { color: "#c9942e", emissive: "#7a4d10", emissiveIntensity: 0.1, roughness: 0.65 },
  "renaissance-smile-bloom": { color: "#6f6242", emissive: "#3c3423", emissiveIntensity: 0.06, roughness: 0.82 },
  "nocturne-sky-bloom": { color: "#2c3a6e", emissive: "#1b2f6b", emissiveIntensity: 0.22, roughness: 0.55 },
  "golden-embrace-bloom": { color: "#d4a437", emissive: "#8a6a1a", emissiveIntensity: 0.18, roughness: 0.35, metalness: 0.55 },
  "monochrome-fracture-bloom": { color: "#8f8f8f", emissive: "#2c2c2c", emissiveIntensity: 0.05, roughness: 0.6 },
  "pearl-light-bloom": { color: "#e8dcc2", emissive: "#b9a06b", emissiveIntensity: 0.08, roughness: 0.4 }
};

function prepareSoilModel(THREE, object, plant) {
  const style = SOIL_STYLES[plant?.id]
    || (plant?.palette ? { color: plant.palette[3] || plant.palette[0], emissiveIntensity: 0.08, roughness: 0.7 } : null);
  if (!style) return object;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const tuned = materials.map((material) => {
      const clone = material?.clone ? material.clone() : new THREE.MeshStandardMaterial();
      if (clone.color) clone.color.lerp(new THREE.Color(style.color), 0.62);
      if (clone.emissive !== undefined && style.emissive) {
        clone.emissive = new THREE.Color(style.emissive);
        clone.emissiveIntensity = style.emissiveIntensity ?? 0.08;
      }
      if ("roughness" in clone && style.roughness !== undefined) clone.roughness = style.roughness;
      if ("metalness" in clone && style.metalness !== undefined) clone.metalness = style.metalness;
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
    opacity: modelSettings.waterOpacity ?? 0.92,
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
    // 傾き視差: カメラをわずかに動かし、空は逆方向へずらして奥行きを出す
    if (deviceTilt.active) {
      parallaxX += (deviceTilt.x * 0.14 - parallaxX) * 0.08;
      parallaxY += (deviceTilt.y * 0.08 - parallaxY) * 0.08;
      camera.position.x = baseCameraX + parallaxX;
      camera.position.y = baseCameraY - parallaxY;
      const skyCanvas = container.querySelector(":scope > .sky-canvas");
      if (skyCanvas) {
        skyCanvas.style.transform = `translate(${(-parallaxX * 60).toFixed(1)}px, ${(parallaxY * 30).toFixed(1)}px) scale(1.08)`;
      }
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
    opacity: 0.58,
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
    </div>
  `;
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });
}
