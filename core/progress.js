export const STAGE_THRESHOLDS = Object.freeze([0, 1000, 2000, 3000, 4000, 5000]);
export const COMPLETION_THRESHOLD = 6000;
export const STEPS_PER_POINT = 10;

export function getStage(points) {
  const safePoints = Number.isFinite(Number(points)) ? Math.max(0, Number(points)) : 0;
  const stageIndex = STAGE_THRESHOLDS.reduce((stage, threshold, index) => {
    return safePoints >= threshold ? index : stage;
  }, 0);
  return Math.min(stageIndex + 1, STAGE_THRESHOLDS.length);
}

export function getNextThreshold(stage) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage >= STAGE_THRESHOLDS.length) return COMPLETION_THRESHOLD;
  return STAGE_THRESHOLDS[safeStage] ?? STAGE_THRESHOLDS.at(-1);
}

export function isPlantComplete(progress) {
  return (Number(progress?.points) || 0) >= COMPLETION_THRESHOLD;
}

export function applyStepsToProgress(progress, steps) {
  const currentPoints = Math.min(
    Math.max(0, Number(progress?.points) || 0),
    COMPLETION_THRESHOLD
  );
  const currentRemainder = Math.max(0, Number(progress?.stepRemainder) || 0);
  const safeSteps = Math.max(0, Math.floor(Number(steps) || 0));
  const availableSteps = currentRemainder + safeSteps;
  const pointsToAdd = Math.floor(availableSteps / STEPS_PER_POINT);
  const points = Math.min(currentPoints + pointsToAdd, COMPLETION_THRESHOLD);

  return {
    points,
    stepRemainder: availableSteps % STEPS_PER_POINT,
    pointsAdded: points - currentPoints,
    stageBefore: getStage(currentPoints),
    stageAfter: getStage(points),
    completedNow: currentPoints < COMPLETION_THRESHOLD && points >= COMPLETION_THRESHOLD
  };
}

export function trimStepHistory(history, maximumDays = 21) {
  const safeHistory = history && typeof history === "object" && !Array.isArray(history)
    ? { ...history }
    : {};
  const keys = Object.keys(safeHistory).sort();
  while (keys.length > maximumDays) delete safeHistory[keys.shift()];
  return safeHistory;
}
