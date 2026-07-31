function setText(documentRef, id, value) {
  const element = documentRef.getElementById(id);
  if (element) element.textContent = value;
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
    effectsEnabled
  } = viewState;

  setText(documentRef, "settings-motion-state", motionEnabled ? "接続中" : "未接続");
  setText(documentRef, "settings-today-steps", `${new Intl.NumberFormat("ja-JP").format(todaySteps || 0)}歩`);
  setText(documentRef, "settings-step-status", sourceStatus);
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
  documentRef.getElementById("settings-weekly-recap-button")?.addEventListener("click", handlers.onOpenRecap);
  documentRef.getElementById("settings-test-steps-button")?.addEventListener("click", handlers.onAddTestSteps);
  documentRef.querySelector("[data-recap-close]")?.addEventListener("click", handlers.onCloseRecap);
}
