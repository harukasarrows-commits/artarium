# artarium

歩数×植物育成のPWA（Three.js + 自作GLSLシェーダー）。

## デザイン

UIは **「ダークギャラリー」**（2026-07-08 ユーザー決定: 黒基調＋高級感）に従う。正は `styles.css` の `:root` トークン。

- **構成の原則（2026-07-08）**: ホームは**没入型** — シーンが画面そのもので、UI（コピー・プレート・ボタン）はその上に浮く。「育てている間は生きた庭、完成したら額装されて美術館（コレクション）へ」という物語の弧に対応する。額縁のメタファーはコレクション側だけに使う。ヒーローを幅100vwにするのは不可（シーンcanvasのリサイズが追随しない）。シェル幅＋100dvhで実装する。

## 詳細ルール（.claude/rules/ — 対象ファイルを触ると自動で読み込まれる）

- `design-tokens.md` — 配色・英語ラベル・UXの決まりごと・質感の作法（styles.css / index.html / app.js）
- `3d-placement.md` — 3D配置調整の正・新植物追加の初期配置・焼き込みの鉄則1〜3, 7（app.js / data / models / scripts）
- `sw-cache.md` — SWキャッシュ汚染・持続キャンバスの鉄則4〜6（sw.js / app.js / index.html / data）

鉄則1〜7は一連のセット（2026-07-09 の回帰から）。番号は分割後も通しで維持する。

## 検証スクリプト（scripts/ に常備）

- `scripts/sync-models.mjs` — モデルパス同期＋版数一括更新の**唯一の正規手段**（sed/perl での一括置換は禁止。ハーネスの deny でもブロック済み）
- `scripts/check-stale-settings.mjs` — 旧設定残存＋焼き込み優先の検証（鉄則7の必須PASS条件）。要: 127.0.0.1:3025 の配信＋ポート9333のヘッドレスChrome
- `scripts/autotune.mjs` — 新植物の初期配置を自動生成（結果は scripts/tuned-settings.json に出力）
