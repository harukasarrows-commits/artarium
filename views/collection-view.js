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

  wall.innerHTML = displayedPlants.map((plant) => {
    const title = getCollectionTitle(plant);
    const frameType = progress[plant.id]?.frameType ?? plant.defaultFrameType ?? "walnut";
    return `
      <article
        class="shadow-box ${plant.id === newlyCollectedPlantId ? "is-new-arrival" : ""}"
        style="${escapeHtml(`${paletteVars(plant)}${backdropVars("nocturne")}`)}"
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
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(plant.copy?.collectionLabel ?? plant.motif)}</p>
            <small>${escapeHtml(getArchiveLine(plant))}</small>
          </div>
        </div>
      </article>
    `;
  }).join("");
}
