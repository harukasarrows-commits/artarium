// PostToolUse(Edit|Write) フック: 編集された .js/.mjs を node --check で構文検証する。
// 失敗時は exit 2 で stderr が Claude に差し戻され、その場で修正させる。
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // 入力が読めない場合は妨げない
}

const filePath = input?.tool_input?.file_path;
if (!filePath || !/\.(js|mjs)$/.test(filePath) || !existsSync(filePath)) {
  process.exit(0);
}

const result = spawnSync("node", ["--check", filePath], { encoding: "utf8" });
if (result.status !== 0) {
  console.error(`node --check 失敗: ${filePath}\n${result.stderr}`);
  process.exit(2);
}
process.exit(0);
