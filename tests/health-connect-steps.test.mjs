import test from "node:test";
import assert from "node:assert/strict";

import {
  createHealthConnectBridge,
  mergeStepHistory,
  normalizeDailySteps,
  pickTodaySteps
} from "../core/health-connect-steps.js";

test("日別歩数を今日と履歴に分け、未来や不正な日付は捨てる", () => {
  const result = normalizeDailySteps(
    [
      { date: "2026-09-05", steps: 4200 },
      { date: "2026-09-06", steps: 3100.7 },
      { date: "2026-09-07", steps: 820 },
      { date: "2026-09-08", steps: 99 },
      { date: "bad", steps: 1 },
      { date: "2026-09-04", steps: -5 }
    ],
    "2026-09-07"
  );
  assert.equal(result.todaySteps, 820);
  assert.deepEqual(result.history, { "2026-09-05": 4200, "2026-09-06": 3100, "2026-09-04": 0 });
});

test("履歴の統合は日付ごとに大きい方を採る", () => {
  const merged = mergeStepHistory({ "2026-09-05": 4500, "2026-09-06": 10 }, { "2026-09-05": 4200, "2026-09-06": 3100, "2026-09-04": 900 });
  assert.deepEqual(merged, { "2026-09-05": 4500, "2026-09-06": 3100, "2026-09-04": 900 });
});

test("今日の歩数はセンサーと Health Connect の大きい方", () => {
  assert.equal(pickTodaySteps(20, 1850), 1850);
  assert.equal(pickTodaySteps(1900, 1850), 1900);
  assert.equal(pickTodaySteps(undefined, NaN), 0);
});

test("ブリッジは状態・許可・日別歩数をプラグインから取り出す", async () => {
  const calls = [];
  const bridge = createHealthConnectBridge({
    callNative: async (plugin, method, options) => {
      calls.push([plugin, method, options]);
      if (method === "getStatus") return { sdkStatus: "available", permissionGranted: false };
      if (method === "requestPermission") return { sdkStatus: "available", permissionGranted: true };
      if (method === "readDailySteps") {
        return { days: [{ date: "2026-09-06", steps: 3100 }, { date: "2026-09-07", steps: 820 }] };
      }
      return {};
    },
    getTodayKey: () => "2026-09-07",
    days: 7
  });
  assert.deepEqual(await bridge.getStatus(), { sdkStatus: "available", permissionGranted: false });
  assert.equal(await bridge.requestPermission(), true);
  assert.deepEqual(await bridge.readDailySteps(), { todaySteps: 820, history: { "2026-09-06": 3100 } });
  assert.deepEqual(calls[2], ["HealthConnect", "readDailySteps", { days: 7 }]);
});

test("プラグイン呼び出しが失敗しても getStatus は unavailable を返す", async () => {
  const bridge = createHealthConnectBridge({
    callNative: async () => {
      throw new Error("no plugin");
    },
    getTodayKey: () => "2026-09-07"
  });
  assert.deepEqual(await bridge.getStatus(), { sdkStatus: "unavailable", permissionGranted: false });
});
