---
name: artarium-task
description: artariumのバックログ項目を定型の品質で実行する。roadmapの「次にやる候補」や監査ID（G-x / U-x / A-x / S-x / C-x / M-x）でタスクを指定されたとき、「◯◯をやって」「roadmapの次を進めて」と言われたときに使う。調査→計画提示→承認→実装→ドキュメント閉じ→検証→コミット提案の順で進める。
---

# artarium タスク実行の型

roadmap の候補や監査ID で指定されたタスクを、以下の7ステップで進める。
ステップを飛ばさない。特に「3. 承認待ち」と「5. ドキュメントを閉じる」は省略しがちなので注意。

## 1. 現在地の確認

- `git status` と `index.html` の `?v=` 版数を確認する
- 対象ファイル（app.js / styles.css / index.html / sw.js）が数分以内に更新されていたら、**並行セッションの可能性をユーザーに確認**してから進む（「1. 待つ / 2. 並行作業を止めて進める」の二択で聞く）
- 未コミットの自分以外の変更があれば、先に独立したコミットで保全を提案する

## 2. 調査

- 対象IDの記載を `docs/requirements.md` / `docs/architecture.md` / `docs/ux-review.md` / `docs/roadmap.md` で読む
- 関連コードを**実際に読み**、文書の記載と実態のズレがないか確かめる。ズレがあれば報告に含める

## 3. 計画の提示 → 承認待ち

- 変更するファイル・影響範囲・**やらないこと**を箇条書きで提示する
- 方針の分岐があれば「選択肢＋推奨案」の形で質問する（AskUserQuestion可）
- 承認が得られるまで実装に入らない

## 4. 実装

- `CLAUDE.md`（artarium）の鉄則1〜7に従う
- 新規ファイルを追加したら `sw.js` の APP_SHELL への追加を忘れない
- 持続キャンバスを増やしたら再描画の掃除セレクタへ除外を追加する

## 5. ドキュメントを閉じる

- 仕様が変わったら `docs/specification.md`、バックログの増減は `docs/roadmap.md` に反映
- 解消した監査項目（requirements / architecture / ux-review）に「→ **対応済み（日付）**」を追記
- `node docs/build-html.mjs` でHTMLを再生成

## 6. 検証

- `node --check app.js`。CSSを触ったらブレース整合も確認
- `docs/testing.md` の該当チェックを実施し、実機でしか確認できない項目は「未検証」として報告に明示する

## 7. 版数とコミット提案

- 版数更新は `node scripts/sync-models.mjs` **のみ**を使う（sedによる一括置換は app.js の ASSET_VERSION を取りこぼす前科があるため禁止）
- コミットメッセージは日本語。コード変更を含む場合は末尾に `(vYYYYMMDD-NN)`
- ドキュメントだけの変更とコード変更は別コミットに分ける
- `git commit` はユーザーの明示的な承認後にのみ実行する
