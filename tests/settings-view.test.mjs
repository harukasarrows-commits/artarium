import test from "node:test";
import assert from "node:assert/strict";

import { bindSettingsView, renderSettingsView } from "../views/settings-view.js";

const IDS = [
  "settings-motion-state", "settings-today-steps", "settings-step-status",
  "settings-author-name", "settings-sound-state", "settings-effects-state",
  "settings-motion-button", "settings-sync-button", "settings-test-steps-button",
  "settings-sound-button", "settings-effects-button", "settings-reset-button",
  "settings-author-button", "settings-weekly-recap-button"
];

function fakeDocument() {
  const elements = new Map(IDS.map((id) => [id, fakeElement()]));
  const recapClose = fakeElement();
  return {
    elements,
    recapClose,
    getElementById: (id) => elements.get(id) ?? null,
    querySelector: (selector) => selector === "[data-recap-close]" ? recapClose : null
  };
}

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

test("settings rendering reflects app state", () => {
  const documentRef = fakeDocument();
  renderSettingsView(documentRef, {
    todaySteps: 12345,
    sourceStatus: "同期済み",
    motionEnabled: true,
    selectedPlant: { id: "sunflower-bloom" },
    selectedPlantComplete: false,
    userName: "テスト作者",
    demoMode: false,
    soundEnabled: true,
    effectsEnabled: false
  });

  assert.equal(documentRef.elements.get("settings-today-steps").textContent, "12,345歩");
  assert.equal(documentRef.elements.get("settings-motion-state").textContent, "接続中");
  assert.equal(documentRef.elements.get("settings-author-name").textContent, "テスト作者");
  assert.equal(documentRef.elements.get("settings-sound-state").textContent, "オン");
  assert.equal(documentRef.elements.get("settings-effects-state").textContent, "オフ");
  assert.equal(documentRef.elements.get("settings-motion-button").disabled, true);
  assert.equal(documentRef.elements.get("settings-test-steps-button").hidden, true);
});

test("settings bindings delegate actions to injected handlers", () => {
  const documentRef = fakeDocument();
  const calls = [];
  bindSettingsView(documentRef, {
    onToggleSound: () => true,
    onToggleEffects: () => false,
    onReset: () => calls.push("reset"),
    onEditAuthor: () => calls.push("author"),
    onStartMotion: () => calls.push("motion"),
    onSyncSteps: () => calls.push("sync"),
    onOpenRecap: () => calls.push("recap"),
    onCloseRecap: () => calls.push("close-recap"),
    onAddTestSteps: () => calls.push("test-steps")
  });

  documentRef.elements.get("settings-sound-button").click();
  documentRef.elements.get("settings-effects-button").click();
  documentRef.elements.get("settings-reset-button").click();
  documentRef.elements.get("settings-author-button").click();
  documentRef.elements.get("settings-motion-button").click();
  documentRef.elements.get("settings-sync-button").click();
  documentRef.elements.get("settings-weekly-recap-button").click();
  documentRef.elements.get("settings-test-steps-button").click();
  documentRef.recapClose.click();

  assert.equal(documentRef.elements.get("settings-sound-state").textContent, "オン");
  assert.equal(documentRef.elements.get("settings-effects-state").textContent, "オフ");
  assert.deepEqual(calls, ["reset", "author", "motion", "sync", "recap", "test-steps", "close-recap"]);
});
