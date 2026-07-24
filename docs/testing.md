# Artarium 検証チェックリスト

最終更新: 2026-07-10

## 更新ルール

検証の手順・観点が増えたらこの資料に追記する。
検証で見つかった不具合は `roadmap.md`（バックログ）へ、確定した仕様変更は `specification.md` へ反映する。

## 起動と基本動作

```bash
python3 -m http.server 3025 --bind 127.0.0.1
```

- 本番: `http://127.0.0.1:3025/?v=<最新版数>`
- デモ: `http://127.0.0.1:3025/?demo=1&v=<最新版数>`
- 天気の強制: `?weather=rain` など（`WEATHER_PRESETS` のキー）

チェック:

- [ ] ホーム・コレクション・設定のタブが切り替わる
- [ ] 種選択 → 開花プレビュー → 「この種を育てる」が通る
- [ ] デモの歩数加算でステージが上がり、点灯式が再生される
- [ ] 額装フロー（名前入力 → 額縁選択 → 収蔵）が一周する
- [ ] コレクションの拡大鑑賞・図鑑が動く

## 自動テスト

```bash
node --test tests/*.test.mjs
```

- [ ] 成長段階の境界値がすべてPASSする
- [ ] 10歩未満の端数繰越がPASSする
- [ ] 6,000ptの完成上限がPASSする
- [ ] 歩数履歴が直近21日へ整理される
- [ ] 旧形式・壊れたJSON・将来版の進行保存テストがPASSする
- [ ] 設定画面の表示反映と全ボタンのイベント委譲テストがPASSする
- [ ] コレクションの空状態・作品一覧・図鑑・クリック／キーボード操作テストがPASSする
- [ ] ホーム進捗の表示・詳細展開と完成プレートの折りたたみ／再表示テストがPASSする

## 初回負荷・オフライン

Chromeを `--remote-debugging-port=9333` で起動し、390×844相当で以下を実行する。

```bash
node scripts/check-runtime-performance.mjs
```

- [ ] 初回転送量が6MB以下
- [ ] 初回GLB要求が6件以下
- [ ] JavaScript例外・console.errorが0件
- [ ] `scripts/check-stale-settings.mjs` でオフライン再読込と保存済み3D表示がPASSする

## リリース前の版数チェック（毎回）

以下の3つが**同じ版数**であることを確認する（過去に不一致が発生: `architecture.md` A-1）。

- [ ] `app.js` の `const ASSET_VERSION`
- [ ] `index.html` / `app.js` 内の `?v=` クエリ
- [ ] `sw.js` の `CACHE_NAME`（v番号）

`node scripts/sync-models.mjs` を通した更新なら3つとも揃う。sed等での手動一括置換は `ASSET_VERSION` を取りこぼしやすいので使わない。

作業順の鉄則（CLAUDE.md 鉄則6）:

- [ ] データJSONの内容生成が終わってから版数を上げる
- [ ] 新規ファイルを追加したら `sw.js` の APP_SHELL に追加した

## localStorage・キャッシュまわり（CLAUDE.md 鉄則2・7）

実端末には過去の自動保存値が必ず残っている前提で検証する。

- [ ] クリーンな localStorage で起動して表示を確認
- [ ] **旧バージョンの設定が残った状態**でも起動して確認（scratchpad の check-stale-settings.mjs 方式。焼き込み値が localStorage の古い値に勝つこと）
- [ ] SWの更新が反映される（リロード2回、または DevTools → Application → Service Workers → Update）
- [ ] `.json` の再生成がリロードで届く（ネットワーク優先の確認）
- [ ] 表示したGLBが `artarium-shell-v*-models` に保存され、19件目で最古の項目が削除される

`scripts/check-stale-settings.mjs` は失敗時に終了コード1を返す。Chromeを `--remote-debugging-port=9333` で起動し、127.0.0.1:3025で配信してから実行する。通常は現在のHTML版数をそのまま使い、特定版を確認する場合だけ `ARTARIUM_V=<版数>` を指定する。

## 3D配置の検証（CLAUDE.md 鉄則3）

数値が合っていても見た目が正しいとは限らない。**必ずスクリーンショットで目視確認**する。

- [ ] 姿勢: 全植物が直立・正面向き（rotX/rotZ=0、rotY=-1.57）
- [ ] 接地: 花モデルの不可視ジオメトリに騙されていないか（バウンディングボックスの底 ≠ 見た目の底）
- [ ] 土台との比率: 土 soilScale=2.5 基準
- [ ] 全9植物 × 6ステージを `?demo=1` のステージタブで一巡
- [ ] 再レンダリング後も空・FX・水面のキャンバスが消えない（鉄則5）

計測ツール: `?demo=1` の `window.__artariumTune`（get/set/dump）、ホームビューアの `dataset.plantNdc` / `soilTopNdcY`。

## 実機チェックリスト（ux-review.md §7 より）

- [ ] 昼の明るい空シーンでホームのコピーが読める
- [ ] iOS Safari 実機で額縁選択モーダルの確定ボタンが隠れない
- [ ] DeviceMotion 歩数計の精度と画面消灯時の挙動
- [ ] 点灯式が低速端末でフレーム落ちしない
- [ ] VoiceOver / TalkBack で額装フローが一周できる
- [ ] モーダル内でTab/Shift+Tabが循環し、閉じると元のボタンへフォーカスが戻る
- [ ] モーダル表示中に背景をスクロール・操作できない
- [ ] 横向きにしたときの破綻の程度を確認（現状 orientation 対応なし）

## ドキュメントの更新チェック

- [ ] 仕様を変えたら `specification.md` を同時に更新した
- [ ] バックログの増減を `roadmap.md` に反映した
- [ ] Markdown 更新後に `node docs/build-html.mjs` でHTMLを再生成した
