// Capacitor 用の webDir (www/) を組み立てる。
// アプリ本体のファイルだけを www/ へコピーする（docs・scripts・tests・android等は含めない）。
// リポジトリ直下をそのまま webDir にすると生成物まで再帰コピーされるため、この方式にしている。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "www");

const FILES = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "app.js",
  "sky-background.js",
  "water-surface.js",
  "weather.js",
  "plant-effects.js",
  "ambient-sound.js",
  "icon.svg",
  "icon-maskable.svg",
  "icon-192.png",
  "icon-512.png",
  "icon-apple-180.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png"
];
const DIRS = ["core", "storage", "ui", "views", "vendor", "data", "models"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of FILES) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn(`skip (not found): ${file}`);
    continue;
  }
  fs.copyFileSync(src, path.join(out, file));
}
for (const dir of DIRS) {
  const src = path.join(root, dir);
  if (!fs.existsSync(src)) {
    console.warn(`skip (not found): ${dir}/`);
    continue;
  }
  fs.cpSync(src, path.join(out, dir), { recursive: true });
}
console.log(`www/ built (${FILES.length} files + ${DIRS.length} dirs)`);
