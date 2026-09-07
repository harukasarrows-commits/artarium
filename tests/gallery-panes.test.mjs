import test from "node:test";
import assert from "node:assert/strict";

import { bindCollectionView, renderGalleryPanes } from "../views/collection-view.js";

function fakeToggleElement(dataset) {
  const classes = new Set();
  return {
    dataset,
    hidden: false,
    attributes: {},
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) },
    setAttribute(name, value) { this.attributes[name] = value; },
    has: (name) => classes.has(name)
  };
}

function fakeDocument() {
  const panes = [fakeToggleElement({ galleryPane: "works" }), fakeToggleElement({ galleryPane: "codex" })];
  const buttons = [fakeToggleElement({ galleryPaneTarget: "works" }), fakeToggleElement({ galleryPaneTarget: "codex" })];
  const listeners = new Map();
  const switchEl = { addEventListener: (type, fn) => listeners.set(type, fn) };
  return {
    panes,
    buttons,
    listeners,
    getElementById: () => null,
    querySelector: (selector) => (selector === ".gallery-switch" ? switchEl : null),
    querySelectorAll: (selector) => (selector === "[data-gallery-pane]" ? panes : selector === "[data-gallery-pane-target]" ? buttons : [])
  };
}

test("収蔵作品が無いときは「由来」を隠し、作品面に固定する", () => {
  const doc = fakeDocument();
  const pane = renderGalleryPanes(doc, { activePane: "codex", hasCodex: false });
  assert.equal(pane, "works");
  assert.equal(doc.panes[0].has("is-active"), true);
  assert.equal(doc.panes[1].has("is-active"), false);
  assert.equal(doc.buttons[1].hidden, true);
  assert.equal(doc.buttons[0].attributes["aria-selected"], "true");
});

test("収蔵作品があれば「由来」面に切り替えられる", () => {
  const doc = fakeDocument();
  const pane = renderGalleryPanes(doc, { activePane: "codex", hasCodex: true });
  assert.equal(pane, "codex");
  assert.equal(doc.panes[1].has("is-active"), true);
  assert.equal(doc.buttons[1].hidden, false);
  assert.equal(doc.buttons[1].attributes["aria-selected"], "true");
  assert.equal(doc.buttons[0].attributes["aria-selected"], "false");
});

test("切り替えボタンのタップで onSwitchPane に面の名前が渡る", () => {
  const doc = fakeDocument();
  const switched = [];
  bindCollectionView(doc, { onGoHome() {}, onOpenArtwork() {}, onSwitchPane: (pane) => switched.push(pane) });
  doc.listeners.get("click")({ target: { closest: (selector) => (selector === "[data-gallery-pane-target]" ? { dataset: { galleryPaneTarget: "codex" } } : null) } });
  assert.deepEqual(switched, ["codex"]);
});
