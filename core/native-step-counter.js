// ネイティブ（Android）の歩数センサーから「今日の歩数」を求めるためのロジック。
//
// センサーが返すのは「端末を起動してからの累計歩数」だけなので、
// 「今日の始まりの累計値（dayBase）」を localStorage に覚えておき、
// 今日の歩数 = 現在の累計 − dayBase として求める。
//
// 割り切り: 日付をまたいでアプリを開かなかった場合、前回読み取り以降の歩数は
// すべて「今日」に計上する（累計はずれないが、日ごとの内訳は近似になる）。

export const NATIVE_STEP_STORAGE_KEY = "artarium-native-steps";

/**
 * @param {{date:string, dayBase:number, lastCumulative:number}|null} record 前回の基準値
 * @param {number} cumulative センサーの累計歩数（起動後）
 * @param {string} todayKey 今日の日付キー（YYYY-MM-DD）
 * @param {number} currentTodaySteps アプリが現在持っている今日の歩数（初回・再起動時の引き継ぎ用）
 */
export function computeNativeStepUpdate(record, cumulative, todayKey, currentTodaySteps = 0) {
  const current = Math.max(0, Math.floor(Number(currentTodaySteps) || 0));
  let dayBase;

  if (!record || !Number.isFinite(record.dayBase) || !Number.isFinite(record.lastCumulative)) {
    // 初回: いまアプリが持っている今日の歩数を引き継ぎ、ここから先を加算する
    dayBase = cumulative - current;
  } else if (cumulative < record.lastCumulative) {
    // 端末の再起動でセンサーの累計が 0 に戻った
    dayBase = cumulative - current;
  } else if (record.date !== todayKey) {
    // 日付が変わった: 前回読み取り以降の歩数は今日に計上する
    dayBase = record.lastCumulative;
  } else {
    dayBase = record.dayBase;
  }

  const todaySteps = Math.max(0, Math.floor(cumulative - dayBase));
  return {
    record: { date: todayKey, dayBase, lastCumulative: cumulative },
    todaySteps
  };
}

export function loadNativeStepRecord(storage, key = NATIVE_STEP_STORAGE_KEY) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * app.js が期待する window.ArtariumStepBridge 互換のブリッジを作る。
 * callNative は (pluginName, methodName, options) => Promise を受け取る
 * （実機では window.Capacitor.nativePromise をそのまま渡す）。
 */
export function createNativeStepBridge({ storage, callNative, getTodayKey, getCurrentTodaySteps, storageKey = NATIVE_STEP_STORAGE_KEY }) {
  return {
    async isAvailable() {
      try {
        const result = await callNative("StepCounter", "isAvailable", {});
        return Boolean(result?.available);
      } catch {
        return false;
      }
    },
    async requestPermission() {
      const result = await callNative("StepCounter", "requestPermission", {});
      return result?.activity === "granted";
    },
    async getTodaySteps() {
      const result = await callNative("StepCounter", "getCumulativeSteps", {});
      const cumulative = Number(result?.cumulativeSteps);
      if (!Number.isFinite(cumulative) || cumulative < 0) {
        throw new Error("歩数センサーの値を読み取れませんでした");
      }
      const update = computeNativeStepUpdate(
        loadNativeStepRecord(storage, storageKey),
        cumulative,
        getTodayKey(),
        getCurrentTodaySteps()
      );
      storage.setItem(storageKey, JSON.stringify(update.record));
      return { todaySteps: update.todaySteps };
    }
  };
}
