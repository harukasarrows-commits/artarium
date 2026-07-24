export const PROGRESS_SCHEMA_VERSION = 1;

export function migrateProgressState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const saved = { ...value };
  const version = Number(saved.__schemaVersion) || 0;

  if (version < 1) {
    saved.__schemaVersion = PROGRESS_SCHEMA_VERSION;
  }

  return saved;
}

export function loadProgressState(storage, storageKey, onError = () => {}) {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return migrateProgressState({});
    return migrateProgressState(JSON.parse(raw));
  } catch (error) {
    onError(error);
    return migrateProgressState({});
  }
}

export function saveProgressState(storage, storageKey, value) {
  const saved = migrateProgressState({
    ...value,
    __schemaVersion: PROGRESS_SCHEMA_VERSION
  });
  storage.setItem(storageKey, JSON.stringify(saved));
  return saved;
}
