import test from "node:test";
import assert from "node:assert/strict";

import {
  bindHomeStatusView,
  renderCompletionPlaqueView,
  renderHomeProgressView
} from "../views/home-status-view.js";

function fakeElement() {
  const listeners = new Map();
  return {
    hidden: false,
    textContent: "",
    dataset: {},
    style: {},
    attributes: {},
    className: "",
    classList: { toggle() {} },
    children: [],
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    toggleAttribute(name, force) { this.attributes[name] = force ? "" : undefined; this.hidden = Boolean(force); },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, event = {}) { listeners.get(type)?.(event); },
    appendChild(child) { this.children.push(child); },
    remove() { this.removed = true; },
    querySelector() { return null; }
  };
}

function fakeDocument() {
  const detail = fakeElement();
  const action = fakeElement();
  const plaque = fakeElement();
  plaque.querySelector = (selector) => selector === "[data-completion-action]" ? action : null;
  const line = fakeElement();
  line.querySelector = (selector) => selector === ".growth-progress-detail" ? detail : null;
  const hero = fakeElement();
  hero.querySelector = () => null;
  const elements = new Map([
    ["daily-progress-line", line],
    ["growth-progress-label", fakeElement()],
    ["growth-progress-percent", fakeElement()],
    ["growth-progress-detail", detail],
    ["daily-progress-fill", fakeElement()],
    ["completion-plaque", plaque],
    ["completion-title", fakeElement()],
    ["completion-subtitle", fakeElement()]
  ]);
  return {
    elements, line, detail, plaque, action, hero,
    getElementById: (id) => elements.get(id) ?? null,
    querySelector: (selector) => selector === ".daily-hero" ? hero : null,
    createElement: () => fakeElement()
  };
}

test("home progress renders percentage and step details", () => {
  const documentRef = fakeDocument();
  renderHomeProgressView(documentRef, {
    visible: true,
    progress: 0.426,
    nextGrowthLabel: "葉がひらくまで",
    title: "葉ひらきへの歩み",
    todaySteps: 1234,
    totalStepsRemaining: 45670
  });
  assert.equal(documentRef.line.hidden, false);
  assert.equal(documentRef.elements.get("growth-progress-percent").textContent, "43%");
  assert.equal(documentRef.elements.get("daily-progress-fill").style.width, "43%");
  assert.match(documentRef.detail.textContent, /1,234歩/);
  assert.match(documentRef.detail.textContent, /45,670歩/);
});

test("completion plaque renders full and collapsed states", () => {
  const documentRef = fakeDocument();
  const plant = { id: "sunflower-bloom", name: "Sunflower Bloom" };
  renderCompletionPlaqueView(documentRef, {
    plant,
    shouldShow: true,
    bloomCelebrationActive: false,
    collapsed: false,
    instant: true,
    displayed: false,
    subtitle: "完成しました"
  });
  assert.equal(documentRef.plaque.hidden, false);
  assert.equal(documentRef.elements.get("completion-title").textContent, plant.name);
  assert.equal(documentRef.action.textContent, "額装を選ぶ");

  renderCompletionPlaqueView(documentRef, {
    plant,
    shouldShow: true,
    bloomCelebrationActive: false,
    collapsed: true
  });
  assert.equal(documentRef.plaque.hidden, true);
  assert.equal(documentRef.hero.children[0].dataset.plaqueReopen, "true");
});

test("home status bindings delegate plaque actions and keyboard progress toggle", () => {
  const documentRef = fakeDocument();
  const close = fakeElement();
  const action = fakeElement();
  documentRef.querySelector = (selector) => {
    if (selector === "[data-plaque-close]") return close;
    if (selector === "[data-completion-action]") return action;
    if (selector === ".daily-hero") return documentRef.hero;
    return null;
  };
  const calls = [];
  bindHomeStatusView(documentRef, {
    onCollapsePlaque: () => calls.push("collapse"),
    onCompletionAction: () => calls.push("complete"),
    onReopenPlaque: () => calls.push("reopen")
  });
  close.dispatch("click");
  action.dispatch("click");
  let prevented = false;
  documentRef.line.dispatch("keydown", { key: "Enter", preventDefault: () => { prevented = true; } });
  documentRef.hero.dispatch("click", { target: { closest: () => ({}) } });
  assert.deepEqual(calls, ["collapse", "complete", "reopen"]);
  assert.equal(documentRef.line.getAttribute("aria-expanded"), "true");
  assert.equal(prevented, true);
});
