function setText(documentRef, id, value) {
  const element = documentRef.getElementById(id);
  if (element) element.textContent = value;
}

/**
 * 歩数の取得元の表示文と、導入・許可への導線（2026-09-07）。
 * stepSource: { kind: "health-connect" | "sensor" | "motion" | "none", action?: "install" | "permission" | "settings" }
 */
export function describeStepSource(stepSource) {
  const kind = stepSource?.kind ?? "none";
  const labels = {
    "health-connect": "取得元: Health Connect（Samsung Health などが数えた歩数。アプリを閉じていても記録）",
    sensor: "取得元: 端末の歩数センサー（アプリが動いている間だけ記録）",
    motion: "取得元: 簡易歩数計（画面を開いている間だけ記録）",
    none: "取得元: 未接続"
  };
  const actions = {
    install: "Health Connect を導入して、閉じている間も記録する",
    permission: "Health Connect の歩数の読み取りを許可する",
    settings: "Health Connect の設定を開く"
  };
  return { label: labels[kind] ?? labels.none, actionLabel: stepSource?.action ? actions[stepSource.action] ?? "" : "" };
}

export function renderSettingsView(documentRef, viewState) {
  const {
    todaySteps,
    sourceStatus,
    motionEnabled,
    selectedPlant,
    selectedPlantComplete,
    userName,
    demoMode,
    soundEnabled,
    effectsEnabled,
    stepSource
  } = viewState;

  setText(documentRef, "settings-motion-state", motionEnabled ? "接続中" : "未接続");
  setText(documentRef, "settings-today-steps", `${new Intl.NumberFormat("ja-JP").format(todaySteps || 0)}歩`);
  setText(documentRef, "settings-step-status", sourceStatus);
  const source = describeStepSource(stepSource);
  setText(documentRef, "settings-step-source", source.label);
  const actionButton = documentRef.getElementById("settings-step-source-action");
  if (actionButton) {
    actionButton.textContent = source.actionLabel;
    actionButton.hidden = !source.actionLabel;
  }
  setText(documentRef, "settings-author-name", userName || "未設定");
  setText(documentRef, "settings-sound-state", soundEnabled ? "オン" : "オフ");
  setText(documentRef, "settings-effects-state", effectsEnabled ? "オン" : "オフ");

  const motionButton = documentRef.getElementById("settings-motion-button");
  const syncButton = documentRef.getElementById("settings-sync-button");
  const testButton = documentRef.getElementById("settings-test-steps-button");
  if (motionButton) motionButton.disabled = motionEnabled;
  if (syncButton) syncButton.disabled = selectedPlantComplete;
  if (testButton) {
    testButton.disabled = !selectedPlant || selectedPlantComplete;
    testButton.hidden = !demoMode;
  }
}

export function bindSettingsView(documentRef, handlers) {
  documentRef.getElementById("settings-sound-button")?.addEventListener("click", () => {
    setText(documentRef, "settings-sound-state", handlers.onToggleSound() ? "オン" : "オフ");
  });
  documentRef.getElementById("settings-effects-button")?.addEventListener("click", () => {
    setText(documentRef, "settings-effects-state", handlers.onToggleEffects() ? "オン" : "オフ");
  });
  documentRef.getElementById("settings-reset-button")?.addEventListener("click", handlers.onReset);
  documentRef.getElementById("settings-export-button")?.addEventListener("click", handlers.onExportData);
  documentRef.getElementById("settings-import-button")?.addEventListener("click", () => {
    documentRef.getElementById("settings-import-file")?.click();
  });
  documentRef.getElementById("settings-import-file")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) handlers.onImportData(file);
    event.target.value = "";
  });
  documentRef.getElementById("settings-author-button")?.addEventListener("click", handlers.onEditAuthor);
  documentRef.getElementById("settings-motion-button")?.addEventListener("click", handlers.onStartMotion);
  documentRef.getElementById("settings-sync-button")?.addEventListener("click", handlers.onSyncSteps);
  documentRef.getElementById("settings-step-source-action")?.addEventListener("click", () => handlers.onStepSourceAction?.());
  documentRef.getElementById("settings-weekly-recap-button")?.addEventListener("click", handlers.onOpenRecap);
  documentRef.getElementById("settings-test-steps-button")?.addEventListener("click", handlers.onAddTestSteps);
  documentRef.querySelector("[data-recap-close]")?.addEventListener("click", handlers.onCloseRecap);
}
