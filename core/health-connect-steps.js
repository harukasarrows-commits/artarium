// Health Connect（Android の健康データの共通倉庫）から取り込んだ日別歩数を、
// アプリの「今日の歩数」と「日別履歴」に変換するロジック。
//
// 数えるのは Samsung Health などの別アプリ。Health Connect に書き込まれた値を
// 起動時・前面復帰時に読み、アプリを閉じていた間の歩数も反映する（2026-09-07 B 案）。

/**
 * プラグインの readDailySteps 結果を { todaySteps, history } に整える。
 * history は今日より前の日だけ（今日は todaySteps 側で扱う）。
 */
export function normalizeDailySteps(days, todayKey) {
  const history = {};
  let todaySteps = 0;
  for (const entry of Array.isArray(days) ? days : []) {
    const date = String(entry?.date ?? "");
    const steps = Math.max(0, Math.floor(Number(entry?.steps) || 0));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date === todayKey) {
      todaySteps = steps;
    } else if (date < todayKey) {
      history[date] = steps;
    }
  }
  return { todaySteps, history };
}

/** 日別履歴を日付ごとに大きい方で統合する（Health Connect の値とアプリ内の値のどちらも減らさない） */
export function mergeStepHistory(existing, incoming) {
  const merged = { ...(existing ?? {}) };
  for (const [date, steps] of Object.entries(incoming ?? {})) {
    const value = Math.max(0, Math.floor(Number(steps) || 0));
    merged[date] = Math.max(merged[date] ?? 0, value);
  }
  return merged;
}

/**
 * Health Connect と歩数センサーの両方があるときの「今日の歩数」の決め方。
 * どちらも減らさない（大きい方）。センサーはアプリ表示中の即時反映、Health Connect は
 * 閉じていた間の分を担い、同じ歩数を二重に数えないよう max で揃える。
 */
export function pickTodaySteps(...candidates) {
  return candidates.reduce((best, value) => {
    const steps = Math.floor(Number(value));
    return Number.isFinite(steps) && steps > best ? steps : best;
  }, 0);
}

/**
 * callNative は (pluginName, methodName, options) => Promise
 * （実機では window.Capacitor.nativePromise をそのまま渡す）。
 */
export function createHealthConnectBridge({ callNative, getTodayKey, days = 7 }) {
  return {
    async getStatus() {
      try {
        const result = await callNative("HealthConnect", "getStatus", {});
        return {
          sdkStatus: String(result?.sdkStatus ?? "unavailable"),
          permissionGranted: Boolean(result?.permissionGranted)
        };
      } catch {
        return { sdkStatus: "unavailable", permissionGranted: false };
      }
    },
    async requestPermission() {
      const result = await callNative("HealthConnect", "requestPermission", {});
      return Boolean(result?.permissionGranted);
    },
    async readDailySteps() {
      const result = await callNative("HealthConnect", "readDailySteps", { days });
      return normalizeDailySteps(result?.days, getTodayKey());
    },
    async openSettings() {
      await callNative("HealthConnect", "openSettings", {});
    }
  };
}
