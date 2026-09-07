function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

export function bindCollectionView(documentRef, handlers) {
  const wall = documentRef.getElementById("gallery-wall");
  wall?.addEventListener("click", (event) => {
    const homeButton = event.target.closest?.("[data-empty-jump-home]");
    if (homeButton) {
      handlers.onGoHome();
      return;
    }
    const item = event.target.closest?.("[data-gallery-open]");
    if (item) handlers.onOpenArtwork(item.dataset.galleryOpen);
  });
  wall?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest?.("[data-gallery-open]");
    if (!item) return;
    event.preventDefault();
    handlers.onOpenArtwork(item.dataset.galleryOpen);
  });
  // 「作品 / 由来」の切り替え（2026-09-07 固定シェル: 縦に並べずどちらか一方を画面に収める）
  documentRef.querySelector?.(".gallery-switch")?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-gallery-pane-target]");
    if (button) handlers.onSwitchPane?.(button.dataset.galleryPaneTarget);
  });
}

/**
 * 表示する面を切り替える。収蔵作品が無いときは「由来」を出さず「作品」に固定する。
 * @returns {"works"|"codex"} 実際に表示した面
 */
export function renderGalleryPanes(documentRef, { activePane = "works", hasCodex = false }) {
  const pane = hasCodex && activePane === "codex" ? "codex" : "works";
  for (const element of documentRef.querySelectorAll?.("[data-gallery-pane]") ?? []) {
    element.classList.toggle("is-active", element.dataset.galleryPane === pane);
  }
  for (const button of documentRef.querySelectorAll?.("[data-gallery-pane-target]") ?? []) {
    const target = button.dataset.galleryPaneTarget;
    const isActive = target === pane;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    if (target === "codex") button.hidden = !hasCodex;
  }
  return pane;
}

export function renderCodexView(documentRef, { plants, progress, codexNotes, paletteVars, plantMarkup }) {
  const summary = documentRef.getElementById("codex-summary");
  const grid = documentRef.getElementById("codex-grid");
  const head = documentRef.querySelector(".codex-head");
  if (!summary || !grid) return;
  const collectedPlants = plants.filter((plant) => progress[plant.id]?.displayed);
  const hasCollection = collectedPlants.length > 0;
  if (head) head.hidden = !hasCollection;
  grid.hidden = !hasCollection;
  if (!hasCollection) {
    summary.textContent = "";
    grid.innerHTML = "";
    return;
  }

  summary.textContent = `収蔵 ${collectedPlants.length}点`;
  grid.innerHTML = collectedPlants.map((plant) => {
    const codex = codexNotes[plant.id];
    const source = codex?.source ?? `${plant.motif} / ${plant.artist}, ${plant.year}`;
    const note = codex?.note ?? plant.temperament ?? "";
    return `
      <article class="codex-card is-collected" style="${escapeHtml(paletteVars(plant))}">
        <div class="codex-thumb">${plantMarkup(6)}</div>
        <div class="codex-copy">
          <div class="codex-title-row"><h3>${escapeHtml(plant.name)}</h3></div>
          <p class="codex-source">${escapeHtml(source)}</p>
          <p class="codex-note">${escapeHtml(note)}</p>
        </div>
      </article>
    `;
  }).join("");
}

export function renderCollectionView(documentRef, options) {
  const {
    plants,
    progress,
    newlyCollectedPlantId,
    animateArrival = false,
    getCollectionTitle,
    getArchiveLine,
    paletteVars,
    backdropVars,
    getPlantModelPath,
    getSoilModelPath,
    getEnvironmentTypeForPlant,
    getFrameModelPath,
    galleryViewerMarkup
  } = options;
  const wall = documentRef.getElementById("gallery-wall");
  const summary = documentRef.getElementById("gallery-summary");
  if (!wall || !summary) return;
  const displayedPlants = plants.filter((plant) => progress[plant.id]?.displayed);
  const newlyCollectedPlant = plants.find((plant) => plant.id === newlyCollectedPlantId);
  wall.dataset.artworkCount = String(displayedPlants.length);
  summary.textContent = newlyCollectedPlant
    ? `「${getCollectionTitle(newlyCollectedPlant)}」を収蔵しました`
    : displayedPlants.length ? `作品 ${displayedPlants.length}点` : "";
  summary.setAttribute("role", "status");

  if (!displayedPlants.length) {
    wall.innerHTML = `
      <div class="empty-gallery">
        <div class="empty-frame is-lit" aria-hidden="true">
          <span class="empty-frame-plate">最初の作品を<br>待っています</span>
        </div>
        <h3>展示を待つ壁</h3>
        <p>開花した作品が、シャドーボックスの額縁に収められてこの壁に並びます。</p>
        <button class="secondary-action" type="button" data-empty-jump-home>育てにいく</button>
      </div>
    `;
    return;
  }

  // 入館演出は切替時だけ（開いたままの再描画で作品が点滅しないように）
  wall.classList?.toggle?.("is-arriving", animateArrival);

  const ROOM_SIZE = 6; // 展示室ひと部屋あたりの作品数
  const ROOM_NAMES = ["一", "二", "三"];
  const ROOM_CODES = ["I", "II", "III"];
  wall.innerHTML = displayedPlants.map((plant, index) => {
    const title = getCollectionTitle(plant);
    const frameType = progress[plant.id]?.frameType ?? plant.defaultFrameType ?? "walnut";
    const room = Math.floor(index / ROOM_SIZE);
    const roomLabel = index % ROOM_SIZE === 0
      ? `
        <div class="gallery-room-label" aria-hidden="true">
          <span class="eyebrow">Gallery ${ROOM_CODES[room] ?? room + 1}</span>
          <span>第${ROOM_NAMES[room] ?? room + 1}展示室</span>
        </div>
      `
      : "";
    return `
      ${roomLabel}
      <article
        class="shadow-box ${plant.id === newlyCollectedPlantId ? "is-new-arrival" : ""}"
        style="${escapeHtml(`${paletteVars(plant)}${backdropVars("nocturne")}`)}--work-index:${index};"
        data-gallery-open="${escapeHtml(plant.id)}"
        role="button"
        tabindex="0"
        aria-label="${escapeHtml(title)}を拡大表示"
      >
        <div class="exhibit-light" aria-hidden="true"></div>
        <div class="exhibit-hang">
          <div
            class="model-stage ${plant.id === "pearl-light-bloom" ? "is-pearl-material" : ""}"
            data-model-viewer
            data-stage="6"
            data-plant-id="${escapeHtml(plant.id)}"
            data-plant-model="${escapeHtml(getPlantModelPath(plant, 6))}"
            data-soil-model="${escapeHtml(getSoilModelPath(plant))}"
            data-environment="${escapeHtml(getEnvironmentTypeForPlant(plant))}"
            data-frame-model="${escapeHtml(getFrameModelPath(plant))}"
            data-frame-type="${escapeHtml(frameType)}"
            data-backdrop-type="nocturne"
            data-settings-source="production"
          >${galleryViewerMarkup(plant)}</div>
        </div>
        <div class="artwork-plaque">
          <div>
            <p class="plaque-no">No. ${String(index + 1).padStart(2, "0")}</p>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(plant.copy?.collectionLabel ?? plant.motif)}</p>
            <small>${escapeHtml(getArchiveLine(plant))}</small>
          </div>
        </div>
      </article>
    `;
  }).join("");
}
