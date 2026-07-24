import test from "node:test";
import assert from "node:assert/strict";

import {
  PROGRESS_SCHEMA_VERSION,
  loadProgressState,
  migrateProgressState,
  saveProgressState
} from "../storage/progress-store.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    value: (key) => values.get(key)
  };
}

test("legacy progress receives schema version without losing plant data", () => {
  const legacy = {
    "sunflower-bloom": { points: 2300, stepRemainder: 7 },
    __activePlantId: "sunflower-bloom"
  };
  const migrated = migrateProgressState(legacy);
  assert.equal(migrated.__schemaVersion, PROGRESS_SCHEMA_VERSION);
  assert.deepEqual(migrated["sunflower-bloom"], legacy["sunflower-bloom"]);
  assert.equal(migrated.__activePlantId, "sunflower-bloom");
});

test("malformed saved JSON falls back safely and reports the error", () => {
  const storage = memoryStorage({ progress: "{broken" });
  let reported = false;
  const saved = loadProgressState(storage, "progress", () => { reported = true; });
  assert.equal(reported, true);
  assert.deepEqual(saved, { __schemaVersion: PROGRESS_SCHEMA_VERSION });
});

test("save writes the current schema and preserves progress", () => {
  const storage = memoryStorage();
  saveProgressState(storage, "progress", {
    "wave-crest-bloom": { points: 6000, displayed: true }
  });
  const saved = JSON.parse(storage.value("progress"));
  assert.equal(saved.__schemaVersion, PROGRESS_SCHEMA_VERSION);
  assert.equal(saved["wave-crest-bloom"].displayed, true);
});

test("future schema data is read without destructive downgrading", () => {
  const future = { __schemaVersion: 4, futureField: { enabled: true } };
  assert.deepEqual(migrateProgressState(future), future);
});
