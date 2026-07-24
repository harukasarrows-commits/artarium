import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPLETION_THRESHOLD,
  applyStepsToProgress,
  getNextThreshold,
  getStage,
  isPlantComplete,
  trimStepHistory
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
