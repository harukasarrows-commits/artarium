import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPLETION_THRESHOLD,
  applyStepsToProgress,
  getNextThreshold,
  getStage,
  isPlantComplete,
  trimStepHistory,
  advanceStepsDate
} from "../core/progress.js";

test("stage boundaries map to stages 1 through 6", () => {
  assert.equal(getStage(0), 1);
  assert.equal(getStage(999), 1);
  assert.equal(getStage(1000), 2);
  assert.equal(getStage(4999), 5);
  assert.equal(getStage(5000), 6);
  assert.equal(getStage(COMPLETION_THRESHOLD), 6);
});

test("step remainder is carried into the next update", () => {
  const first = applyStepsToProgress({ points: 0, stepRemainder: 0 }, 9);
  assert.deepEqual(first, {
    points: 0,
    stepRemainder: 9,
    pointsAdded: 0,
    stageBefore: 1,
    stageAfter: 1,
    completedNow: false
  });

  const second = applyStepsToProgress(first, 1);
  assert.equal(second.points, 1);
  assert.equal(second.stepRemainder, 0);
  assert.equal(second.pointsAdded, 1);
});

test("growth stops exactly at completion", () => {
  const result = applyStepsToProgress({ points: 5999, stepRemainder: 0 }, 1000);
  assert.equal(result.points, COMPLETION_THRESHOLD);
  assert.equal(result.pointsAdded, 1);
  assert.equal(result.completedNow, true);
  assert.equal(isPlantComplete(result), true);
});

test("next threshold follows the current stage", () => {
  assert.equal(getNextThreshold(1), 1000);
  assert.equal(getNextThreshold(5), 5000);
  assert.equal(getNextThreshold(6), COMPLETION_THRESHOLD);
});

test("step history retains the most recent 21 date keys", () => {
  const history = Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => [`2026-07-${String(index + 1).padStart(2, "0")}`, index])
  );
  const trimmed = trimStepHistory(history);
  assert.equal(Object.keys(trimmed).length, 21);
  assert.equal(trimmed["2026-07-01"], undefined);
  assert.equal(trimmed["2026-07-04"], 3);
});

test("same-day call is a no-op (date crossing not yet happened)", () => {
  const steps = { date: "2026-11-20", todaySteps: 3200, totalSteps: 50000, history: { "2026-11-19": 8000 } };
  const result = advanceStepsDate(steps, "2026-11-20");
  assert.equal(result, steps);
});

test("crossing midnight records yesterday's total and starts today at 0", () => {
  const steps = { date: "2026-11-20", todaySteps: 9100, totalSteps: 50000, history: { "2026-11-19": 8000 } };
  const result = advanceStepsDate(steps, "2026-11-21");
  assert.equal(result.date, "2026-11-21");
  assert.equal(result.todaySteps, 0);
  assert.equal(result.totalSteps, 50000);
  assert.deepEqual(result.history, { "2026-11-19": 8000, "2026-11-20": 9100, "2026-11-21": 0 });
});

test("skipping several days without opening the app only records the last active day", () => {
  // アプリを数日開かなかった場合、中日は記録されない（累計は正確・日別内訳は近似。roadmap.md「歩数連携」参照）
  const steps = { date: "2026-11-18", todaySteps: 4000, totalSteps: 50000, history: {} };
  const result = advanceStepsDate(steps, "2026-11-21");
  assert.deepEqual(result.history, { "2026-11-18": 4000, "2026-11-21": 0 });
});

test("date crossing keeps only the most recent 21 history entries", () => {
  const history = Object.fromEntries(
    Array.from({ length: 21 }, (_, index) => [`2026-10-${String(index + 1).padStart(2, "0")}`, index])
  );
  const steps = { date: "2026-10-21", todaySteps: 500, totalSteps: 1000, history };
  const result = advanceStepsDate(steps, "2026-10-22");
  assert.equal(Object.keys(result.history).length, 21);
  assert.equal(result.history["2026-10-01"], undefined);
  assert.equal(result.history["2026-10-21"], 500);
  assert.equal(result.history["2026-10-22"], 0);
});
