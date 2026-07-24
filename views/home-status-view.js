export function bindHomeStatusView(documentRef, handlers) {
  documentRef.querySelector("[data-plaque-close]")?.addEventListener("click", handlers.onCollapsePlaque);
  documentRef.querySelector("[data-completion-action]")?.addEventListener("click", handlers.onCompletionAction);

  const progressLine = documentRef.getElementById("daily-progress-line");
  const toggleProgressDetails = () => {
    if (!progressLine || progressLine.hidden) return;
    const expanded = progressLine.getAttribute("aria-expanded") !== "true";
    progressLine.setAttribute("aria-expanded", String(expanded));
    progressLine.querySelector(".growth-progress-detail")?.toggleAttribute("hidden", !expanded);
  };
  progressLine?.addEventListener("click", toggleProgressDetails);
  progressLine?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleProgressDetails();
  });

  documentRef.querySelector(".daily-hero")?.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-plaque-reopen]")) handlers.onReopenPlaque();
  });
}

export function renderHomeProgressView(documentRef, viewState) {
  const line = documentRef.getElementById("daily-progress-line");
  if (!line) return;
  if (!viewState?.visible) {
    line.hidden = true;
    line.setAttribute("aria-expanded", "false");
    return;
  }

  const percent = Math.round(Math.min(1, Math.max(0, viewState.progress || 0)) * 100);
  line.hidden = false;
  line.setAttribute("aria-expanded", "false");
  line.setAttribute("aria-label", `${viewState.nextGrowthLabel} ${percent}%。タップで歩数の詳細を表示します`);
  setText(documentRef, "growth-progress-label", viewState.title);
  setText(documentRef, "growth-progress-percent", `${percent}%`);

  const detail = documentRef.getElementById("growth-progress-detail");
  if (detail) {
    detail.hidden = true;
    detail.textContent = `今日 ${formatNumber(viewState.todaySteps)}歩　・　開花まで ${formatNumber(viewState.totalStepsRemaining)}歩`;
  }
  const fill = documentRef.getElementById("daily-progress-fill");
  if (fill) fill.style.width = `${percent}%`;
}

export function renderCompletionPlaqueView(documentRef, viewState) {
  const plaque = documentRef.getElementById("completion-plaque");
  const hero = documentRef.querySelector(".daily-hero");
  if (!plaque) return;
  hero?.querySelector(".plaque-reopen")?.remove();

  if (viewState.bloomCelebrationActive || !viewState.plant || !viewState.shouldShow) {
    plaque.hidden = true;
    return;
  }
  if (viewState.collapsed) {
    plaque.hidden = true;
    const chip = documentRef.createElement("button");
    chip.className = "plaque-reopen";
    chip.type = "button";
    chip.dataset.plaqueReopen = "true";
    chip.textContent = "額装へ";
    hero?.appendChild(chip);
    return;
  }

  plaque.hidden = false;
  plaque.classList.toggle("is-instant", viewState.instant);
  setText(documentRef, "completion-title", viewState.plant.name);
  setText(documentRef, "completion-subtitle", viewState.subtitle);
  const action = plaque.querySelector("[data-completion-action]");
  if (action) {
    action.textContent = viewState.displayed ? "コレクションを見る" : "額装を選ぶ";
    action.dataset.frameChoiceOpen = viewState.displayed ? "" : viewState.plant.id;
  }
}

function setText(documentRef, id, value) {
  const element = documentRef.getElementById(id);
  if (element) element.textContent = value;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(Number(value) || 0);
}
