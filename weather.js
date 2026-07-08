// 実際の天気との連動
// Open-Meteo（APIキー不要・無料）から現在の天気を取得し、空と水面の表現に渡す。
// 位置情報は許可されれば現在地、拒否・失敗時は東京にフォールバック。
// オフラインや取得失敗時は何もしない（時刻連動のみの空になる）。

// デバッグ・プレビュー用の天気プリセット（デモ版の切り替えUIから使う）
export const WEATHER_PRESETS = {
  clear: { cloud: 0.12, rain: 0, snow: 0, fog: 0, dark: 0 },
  cloudy: { cloud: 0.65, rain: 0, snow: 0, fog: 0, dark: 0.06 },
  overcast: { cloud: 0.95, rain: 0, snow: 0, fog: 0, dark: 0.14 },
  fog: { cloud: 0.6, rain: 0, snow: 0, fog: 0.85, dark: 0.08 },
  rain: { cloud: 0.9, rain: 0.6, snow: 0, fog: 0, dark: 0.2 },
  downpour: { cloud: 1, rain: 1, snow: 0, fog: 0, dark: 0.32 },
  snow: { cloud: 0.9, rain: 0, snow: 0.85, fog: 0, dark: 0.1 },
  thunder: { cloud: 1, rain: 0.9, snow: 0, fog: 0, dark: 0.45, thunder: 1 }
};

const FALLBACK_COORDS = { latitude: 35.6785, longitude: 139.6823 }; // 東京
const CACHE_KEY = "artarium-weather-v1";
const CACHE_TTL_MS = 30 * 60 * 1000;
const REFRESH_MS = 30 * 60 * 1000;

// WMO天気コード → 表現パラメータ
// cloud: 雲量 0-1 / rain: 雨 0-1 / snow: 雪 0-1 / fog: 霧 0-1 / dark: 空全体の暗さ 0-1
function mapWeatherCode(code, cloudCoverPercent) {
  const c = Number(code);
  let w = { cloud: 0.2, rain: 0, snow: 0, fog: 0, dark: 0 };
  if (c === 1) w = { cloud: 0.35, rain: 0, snow: 0, fog: 0, dark: 0 };
  else if (c === 2) w = { cloud: 0.6, rain: 0, snow: 0, fog: 0, dark: 0.05 };
  else if (c === 3) w = { cloud: 0.9, rain: 0, snow: 0, fog: 0, dark: 0.12 };
  else if (c === 45 || c === 48) w = { cloud: 0.6, rain: 0, snow: 0, fog: 0.8, dark: 0.08 };
  else if (c >= 51 && c <= 57) w = { cloud: 0.8, rain: 0.3, snow: 0, fog: 0, dark: 0.12 };
  else if (c === 61 || c === 80 || c === 66) w = { cloud: 0.85, rain: 0.5, snow: 0, fog: 0, dark: 0.18 };
  else if (c === 63 || c === 81) w = { cloud: 0.95, rain: 0.75, snow: 0, fog: 0, dark: 0.25 };
  else if (c === 65 || c === 82 || c === 67) w = { cloud: 1, rain: 1, snow: 0, fog: 0, dark: 0.32 };
  else if ((c >= 71 && c <= 77) || c === 85 || c === 86) w = { cloud: 0.9, rain: 0, snow: 0.8, fog: 0, dark: 0.1 };
  else if (c >= 95) w = { cloud: 1, rain: 0.9, snow: 0, fog: 0, dark: 0.45, thunder: 1 };
  // APIの実測雲量が多ければそちらを優先
  if (Number.isFinite(cloudCoverPercent)) {
    w.cloud = Math.max(w.cloud, Math.min(1, cloudCoverPercent / 100));
  }
  return { ...w, code: c };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    return cached.weather;
  } catch {
    return null;
  }
}

function saveCache(weather) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), weather }));
  } catch {
    // ストレージ不可でも動作継続
  }
}

function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(FALLBACK_COORDS);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(FALLBACK_COORDS),
      { timeout: 8000, maximumAge: 60 * 60 * 1000 }
    );
  });
}

async function fetchWeather() {
  const cached = loadCache();
  if (cached) return cached;

  const { latitude, longitude } = await getCoords();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&current=weather_code,cloud_cover&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`weather api ${response.status}`);
  const data = await response.json();
  const weather = mapWeatherCode(data?.current?.weather_code, data?.current?.cloud_cover);
  saveCache(weather);
  return weather;
}

export function initWeatherSync(onUpdate) {
  const run = async () => {
    try {
      const weather = await fetchWeather();
      console.info("Artarium weather:", weather);
      onUpdate(weather);
    } catch (error) {
      console.warn("天気の取得に失敗しました（時刻連動のみで表示します）:", error);
    }
  };
  run();
  setInterval(run, REFRESH_MS);
}
