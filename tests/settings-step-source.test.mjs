import test from "node:test";
import assert from "node:assert/strict";

import { bindSettingsView, describeStepSource, renderSettingsView } from "../views/settings-view.js";

function fakeElement() {
  const listeners = new Map();
  return {
    textContent: "",
    disabled: false,
    hidden: false,
    addEventListener: (type, listener) => listeners.set(type, listener),
    click: () => listeners.get("click")?.()
  };
}

function fakeDocument(ids) {
  const elements = new Map(ids.map((id) => [id, fakeElement()]));
  return { elements, getElementById: (id) => elements.get(id) ?? null, querySelector: () => null };
}

test("取得元の文言と導線の文言", () => {
  assert.match(describeStepSource({ kind: "health-connect" }).label, /Health Connect/);
  assert.match(describeStepSource({ kind: "sensor", action: "install" }).actionLabel, /導入/);
  assert.match(describeStepSource({ kind: "sensor", action: "permission" }).actionLabel, /許可/);
  assert.equal(describeStepSource({ kind: "motion" }).actionLabel, "");
  assert.equal(describeStepSource(undefined).label, "取得元: 未接続");
});

test("導線が無いときはボタンを隠し、あるときは文言を入れて表示する", () => {
  const doc = fakeDocument(["settings-step-source", "settings-step-status", "settings-step-source-action"]);
  const base = { todaySteps: 0, sourceStatus: "s", motionEnabled: false, selectedPlant: null, selectedPlantComplete: false, userName: "", demoMode: false, soundEnabled: false, effectsEnabled: true };
  renderSettingsView(doc, { ...base, stepSource: { kind: "motion" } });
  assert.equal(doc.elements.get("settings-step-source-action").hidden, true);
  renderSettingsView(doc, { ...base, stepSource: { kind: "sensor", action: "install" } });
  const button = doc.elements.get("settings-step-source-action");
  assert.equal(button.hidden, false);
  assert.match(button.textContent, /Health Connect を導入/);
});

test("導線のタップで onStepSourceAction が呼ばれる", () => {
  const doc = fakeDocument(["settings-step-source-action"]);
  let called = 0;
  bindSettingsView(doc, { onStepSourceAction: () => called++ });
  doc.elements.get("settings-step-source-action").click();
  assert.equal(called, 1);
});
