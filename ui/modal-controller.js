const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function createModalController(documentRef = document) {
  const openModals = [];
  const previousFocus = new WeakMap();
  const appShell = documentRef.querySelector(".app-shell");

  function focusableElements(modal) {
    return [...modal.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
      return !element.hidden && element.getAttribute("aria-hidden") !== "true";
    });
  }

  function syncBackgroundState() {
    const hasOpenModal = openModals.length > 0;
    documentRef.body.classList.toggle("has-open-modal", hasOpenModal);
    if (appShell) appShell.inert = hasOpenModal;
  }

  function open(modal, { initialFocus } = {}) {
    if (!modal) return;
    const wasHidden = modal.hidden;
    if (wasHidden) {
      previousFocus.set(modal, documentRef.activeElement);
      modal.hidden = false;
    }
    const existingIndex = openModals.indexOf(modal);
    if (existingIndex >= 0) openModals.splice(existingIndex, 1);
    openModals.push(modal);
    syncBackgroundState();

    if (!wasHidden) return;
    queueMicrotask(() => {
      if (modal.hidden) return;
      const target = typeof initialFocus === "string"
        ? modal.querySelector(initialFocus)
        : initialFocus;
      (target || focusableElements(modal)[0])?.focus();
    });
  }

  function close(modal, { restoreFocus = true } = {}) {
    if (!modal) return;
    modal.hidden = true;
    const index = openModals.indexOf(modal);
    if (index >= 0) openModals.splice(index, 1);
    syncBackgroundState();

    if (!restoreFocus) return;
    const target = previousFocus.get(modal);
    previousFocus.delete(modal);
    queueMicrotask(() => {
      if (target?.isConnected && typeof target.focus === "function") target.focus();
    });
  }

  documentRef.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !openModals.length) return;
    const modal = openModals.at(-1);
    const focusable = focusableElements(modal);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!modal.contains(documentRef.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  });

  return { open, close };
}
