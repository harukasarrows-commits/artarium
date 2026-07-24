import test from "node:test";
import assert from "node:assert/strict";

import {
  bindCollectionView,
  renderCodexView,
  renderCollectionView
} from "../views/collection-view.js";

function fakeElement() {
  const listeners = new Map();
  return {
    dataset: {},
    textContent: "",
    innerHTML: "",
    hidden: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, event) { listeners.get(type)?.(event); }
  };
}

function fakeDocument() {
  const elements = new Map([
    ["gallery-wall", fakeElement()],
    ["gallery-summary", fakeElement()],
    ["codex-summary", fakeElement()],
    ["codex-grid", fakeElement()]
  ]);
  const codexHead = fakeElement();
  return {
    elements,
    codexHead,
    getElementById: (id) => elements.get(id) ?? null,
    querySelector: (selector) => selector === ".codex-head" ? codexHead : null
  };
}

const plant = {
  id: "test-plant",
  name: "Test <Bloom>",
  motif: "Test motif",
  artist: "Archive",
  year: "2026",
  palette: ["#1", "#2", "#3", "#4"],
  copy: { collectionTitle: "静かな<花>", collectionLabel: "展示作品" },
  defaultFrameType: "walnut",
  temperament: "説明"
};

const helpers = {
  getCollectionTitle: (item) => item.copy.collectionTitle,
  getArchiveLine: () => "作者 / 収蔵 22 JUL 2026",
  paletteVars: () => "--c1:#111;",
  backdropVars: () => "--bg1:#000;",
  getPlantModelPath: () => "./plant.glb",
  getSoilModelPath: () => "./soil.glb",
  getEnvironmentTypeForPlant: () => "soil",
  getFrameModelPath: () => "",
  galleryViewerMarkup: () => "<span data-fallback></span>"
};

test("empty collection renders its home action", () => {
  const documentRef = fakeDocument();
  renderCollectionView(documentRef, {
    plants: [plant],
    progress: { [plant.id]: { displayed: false } },
    newlyCollectedPlantId: "",
    ...helpers
  });
  const wall = documentRef.elements.get("gallery-wall");
  assert.equal(wall.dataset.artworkCount, "0");
  assert.match(wall.innerHTML, /data-empty-jump-home/);
});

test("collected artwork and codex are rendered with escaped text", () => {
  const documentRef = fakeDocument();
  const progress = { [plant.id]: { displayed: true, frameType: "walnut" } };
  renderCollectionView(documentRef, {
    plants: [plant], progress, newlyCollectedPlantId: plant.id, ...helpers
  });
  renderCodexView(documentRef, {
    plants: [plant],
    progress,
    codexNotes: { [plant.id]: { source: "出典", note: "解説" } },
    paletteVars: helpers.paletteVars,
    plantMarkup: () => "<span data-plant></span>"
  });

  const wallHtml = documentRef.elements.get("gallery-wall").innerHTML;
  assert.match(wallHtml, /data-gallery-open="test-plant"/);
  assert.match(wallHtml, /静かな&lt;花&gt;/);
  assert.equal(documentRef.elements.get("gallery-summary").textContent, "「静かな<花>」を収蔵しました");
  assert.match(documentRef.elements.get("codex-grid").innerHTML, /Test &lt;Bloom&gt;/);
});

test("collection interactions delegate home and artwork actions", () => {
  const documentRef = fakeDocument();
  const calls = [];
  bindCollectionView(documentRef, {
    onGoHome: () => calls.push("home"),
    onOpenArtwork: (id) => calls.push(id)
  });
  const wall = documentRef.elements.get("gallery-wall");
  wall.dispatch("click", { target: { closest: (selector) => selector.includes("empty") ? {} : null } });
  wall.dispatch("click", { target: { closest: (selector) => selector.includes("gallery-open") ? { dataset: { galleryOpen: plant.id } } : null } });
  let prevented = false;
  wall.dispatch("keydown", {
    key: "Enter",
    target: { closest: () => ({ dataset: { galleryOpen: plant.id } }) },
    preventDefault: () => { prevented = true; }
  });
  assert.deepEqual(calls, ["home", plant.id, plant.id]);
  assert.equal(prevented, true);
});
