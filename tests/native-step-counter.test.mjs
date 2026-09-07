import test from "node:test";
import assert from "node:assert/strict";

import {
  NATIVE_STEP_STORAGE_KEY,
  computeNativeStepUpdate,
  createNativeStepBridge
} from "../core/native-step-counter.js";

test("初回はアプリが持つ今日の歩数を引き継ぎ、そこから先を加算する", () => {
  const first = computeNativeStepUpdate(null, 10000, "2026-09-07", 15);
  assert.equal(first.todaySteps, 15);
  assert.deepEqual(first.record, { date: "2026-09-07", dayBase: 9985, lastCumulative: 10000 });

  const later = computeNativeStepUpdate(first.record, 10120, "2026-09-07", 15);
  assert.equal(later.todaySteps, 135);
  assert.equal(later.record.dayBase, 9985);
});

test("日付が変わったら、前回読み取り以降の歩数を今日に計上する", () => {
  const record = { date: "2026-09-06", dayBase: 9000, lastCumulative: 9500 };
  const next = computeNativeStepUpdate(record, 9800, "2026-09-07", 500);
  assert.equal(next.todaySteps, 300);
  assert.deepEqual(next.record, { date: "2026-09-07", dayBase: 9500, lastCumulative: 9800 });
});

test("端末の再起動で累計が減ったら、今日の歩数を保ったまま基準を取り直す", () => {
  const record = { date: "2026-09-07", dayBase: 9000, lastCumulative: 9800 };
  const next = computeNativeStepUpdate(record, 40, "2026-09-07", 800);
  assert.equal(next.todaySteps, 800);
  assert.equal(next.record.dayBase, -760);
  assert.equal(next.record.lastCumulative, 40);
});

test("今日の歩数が負にならない", () => {
  const record = { date: "2026-09-07", dayBase: 9000, lastCumulative: 9000 };
  assert.equal(computeNativeStepUpdate(record, 9000, "2026-09-07", 0).todaySteps, 0);
});

test("ブリッジはセンサー値から今日の歩数を返し、基準値を保存する", async () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value))
  };
  let cumulative = 5000;
  const calls = [];
  const bridge = createNativeStepBridge({
    storage,
    callNative: async (plugin, method) => {
      calls.push(`${plugin}.${method}`);
      if (method === "isAvailable") return { available: true };
      if (method === "requestPermission") return { activity: "granted" };
      return { cumulativeSteps: cumulative };
    },
    getTodayKey: () => "2026-09-07",
    getCurrentTodaySteps: () => 3
  });

  assert.equal(await bridge.isAvailable(), true);
  assert.equal(await bridge.requestPermission(), true);
  assert.deepEqual(await bridge.getTodaySteps(), { todaySteps: 3 });
  cumulative = 5250;
  assert.deepEqual(await bridge.getTodaySteps(), { todaySteps: 253 });
  assert.deepEqual(JSON.parse(store.get(NATIVE_STEP_STORAGE_KEY)), {
    date: "2026-09-07",
    dayBase: 4997,
    lastCumulative: 5250
  });
  assert.deepEqual(calls, [
    "StepCounter.isAvailable",
    "StepCounter.requestPermission",
    "StepCounter.getCumulativeSteps",
    "StepCounter.getCumulativeSteps"
  ]);
});

test("センサー値が不正なら例外にする（アプリ側で失敗表示に回す）", async () => {
  const bridge = createNativeStepBridge({
    storage: { getItem: () => null, setItem: () => {} },
    callNative: async () => ({}),
    getTodayKey: () => "2026-09-07",
    getCurrentTodaySteps: () => 0
  });
  await assert.rejects(bridge.getTodaySteps());
});
