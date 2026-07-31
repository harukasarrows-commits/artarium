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

// 進行データが「中身を持っている」とみなせるか（予備コピーからの復元判断に使う）
function hasMeaningfulProgress(value) {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => !key.startsWith("__"));
}

export function loadProgressState(storage, storageKey, onError = () => {}) {
  try {
    const raw = storage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    if (hasMeaningfulProgress(parsed)) {
      // 予備コピーがまだ無ければ、読み込んだこの時点で作っておく
      // （次回の保存を待たずに、起動しただけで守られる状態にする）
      if (!storage.getItem(`${storageKey}-backup`)) {
        storage.setItem(`${storageKey}-backup`, raw);
      }
      return migrateProgressState(parsed);
    }
    // 本体が空・破損でも予備コピーが残っていれば自動復元する
    // （2026-07-31 実機で進行データ消失の報告があったため）。
    // メモリ上で返すだけでなく本体キーへも書き戻し、次回以降も一貫させる
    const backupRaw = storage.getItem(`${storageKey}-backup`);
    if (backupRaw) {
      const backup = JSON.parse(backupRaw);
      if (hasMeaningfulProgress(backup)) {
        storage.setItem(storageKey, backupRaw);
        onError(new Error("main state empty; restored from backup"));
        return migrateProgressState(backup);
      }
    }
    return migrateProgressState(parsed);
  } catch (error) {
    onError(error);
    try {
      const backupRaw = storage.getItem(`${storageKey}-backup`);
      if (backupRaw) {
        storage.setItem(storageKey, backupRaw);
        return migrateProgressState(JSON.parse(backupRaw));
      }
    } catch {
      // 予備も読めなければ初期状態から始めるしかない
    }
    return migrateProgressState({});
  }
}

export function saveProgressState(storage, storageKey, value) {
  const saved = migrateProgressState({
    ...value,
    __schemaVersion: PROGRESS_SCHEMA_VERSION
  });
  const serialized = JSON.stringify(saved);
  storage.setItem(storageKey, serialized);
  // 予備コピー（本体が空で保存されてしまう類の事故から守る。
  // 中身のある状態だけを予備に写す — 空の状態で予備を潰さない）
  if (hasMeaningfulProgress(saved)) {
    storage.setItem(`${storageKey}-backup`, serialized);
  }
  return saved;
}

export function clearProgressState(storage, storageKey) {
  storage.removeItem(storageKey);
  storage.removeItem(`${storageKey}-backup`);
}
