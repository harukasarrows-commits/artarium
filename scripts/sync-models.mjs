import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageFolders = [
  "stage-01-seed",
  "stage-02-sprout",
  "stage-03-leaves",
  "stage-04-bud",
  "stage-05-pre-bloom",
  "stage-06-bloom"
];

function toWebPath(filePath) {
  return `./${path.relative(root, filePath).split(path.sep).join("/")}`;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function newestGlbIn(folderPath) {
  if (!(await fileExists(folderPath))) return "";
  const entries = await readdir(folderPath, { withFileTypes: true });
  const glbs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".glb")) continue;
    const filePath = path.join(folderPath, entry.name);
    const info = await stat(filePath);
    glbs.push({ filePath, mtimeMs: info.mtimeMs });
  }
  glbs.sort((left, right) => right.mtimeMs - left.mtimeMs || left.filePath.localeCompare(right.filePath));
  return glbs[0]?.filePath || "";
}

function nextVersion(current) {
  const match = String(current).match(/^(\d{8})-(\d+)$/);
  if (!match) return current;
  return `${match[1]}-${String(Number(match[2]) + 1).padStart(match[2].length, "0")}`;
}

function extractAppVersion(appSource) {
  return appSource.match(/const ASSET_VERSION = "([^"]+)";/)?.[1] || "20260629-01";
}

function replaceAssetVersion(source, version) {
  return source
    .replace(/const ASSET_VERSION = "[^"]+";/, `const ASSET_VERSION = "${version}";`)
    .replaceAll(/v=\d{8}-\d+/g, `v=${version}`);
}

function replaceServiceWorkerVersion(source, version) {
  const nextCacheName = source.replace(/const CACHE_NAME = "artarium-shell-v(\d+)";/, (_, number) => {
    return `const CACHE_NAME = "artarium-shell-v${Number(number) + 1}";`;
  });
  return replaceAssetVersion(nextCacheName, version);
}

function jsObjectLiteral(value) {
  return JSON.stringify(value, null, 2)
    .replace(/"([^"]+)":/g, "$1:")
    .replace(/"(\d+)":/g, "$1:");
}

function syncFallbackPlants(appSource, plants) {
  const fallbackLiteral = `const fallbackPlants = ${jsObjectLiteral(plants)};`;
  return appSource.replace(/const fallbackPlants = \[[\s\S]*?\];\n\nasync function init\(\)/, `${fallbackLiteral}\n\nasync function init()`);
}

async function syncPlantModels(plants) {
  const changes = [];
  for (const plant of plants) {
    const plantDir = path.join(root, "models", "plants", plant.id);
    if (!(await fileExists(plantDir))) continue;

    plant.stageModelPaths = plant.stageModelPaths || {};
    for (const [index, stageFolder] of stageFolders.entries()) {
      const stage = String(index + 1);
      const glb = await newestGlbIn(path.join(plantDir, stageFolder));
      if (!glb) continue;
      const nextPath = toWebPath(glb);
      if (plant.stageModelPaths[stage] !== nextPath) {
        plant.stageModelPaths[stage] = nextPath;
        changes.push(`${plant.id} Stage${stage}: ${nextPath}`);
      }
    }

    if (plant.stageModelPaths["1"] && plant.modelPath !== plant.stageModelPaths["1"]) {
      plant.modelPath = plant.stageModelPaths["1"];
      changes.push(`${plant.id} modelPath: ${plant.modelPath}`);
    }
  }
  return changes;
}

async function main() {
  const plantsPath = path.join(root, "data", "plants.json");
  const appPath = path.join(root, "app.js");
  const indexPath = path.join(root, "index.html");
  const swPath = path.join(root, "sw.js");

  const plants = JSON.parse(await readFile(plantsPath, "utf8"));
  const appSource = await readFile(appPath, "utf8");
  const nextAssetVersion = nextVersion(extractAppVersion(appSource));
  const changes = await syncPlantModels(plants);

  await writeFile(plantsPath, `${JSON.stringify(plants, null, 2)}\n`);
  await writeFile(appPath, replaceAssetVersion(syncFallbackPlants(appSource, plants), nextAssetVersion));
  await writeFile(indexPath, replaceAssetVersion(await readFile(indexPath, "utf8"), nextAssetVersion));
  await writeFile(swPath, replaceServiceWorkerVersion(await readFile(swPath, "utf8"), nextAssetVersion));

  console.log(`Synced ${changes.length} model path change(s).`);
  changes.forEach((change) => console.log(`- ${change}`));
  console.log(`Asset version: ${nextAssetVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
