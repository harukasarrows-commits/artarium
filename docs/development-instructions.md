# Artarium 開発指示書

最終更新: 2026-06-29

## 更新ルール

今後、仕様変更・UI変更・モデル追加・フォルダ構成変更・成長条件変更があった場合は、この指示書の該当箇所を更新する。
実装の正確な仕様は `docs/specification.md`、外部説明用の要約は `docs/presentation.md` に反映する。

## 開発の基本方針

Artarium はスマホアプリ化を前提にしたWebプロトタイプ。

現在は静的ファイルで構成する。

- `index.html`
- `styles.css`
- `app.js`
- `data/plants.json`
- `models/`
- `vendor/`
- `sw.js`

画面はPCブラウザでもスマホ画面の比率を維持する。
本番確認用とデモ調整用を分ける。

- 本番: `http://127.0.0.1:3025/?v=YYYYMMDD-NN`
- デモ: `http://127.0.0.1:3025/?demo=1&v=YYYYMMDD-NN`

## サーバー起動

```bash
cd /Users/harukasugasawa/Claude(親フォルダ)/ARROWS-アプリ開発/artarium
python3 -m http.server 3025 --bind 127.0.0.1
```

## キャッシュ更新

`app.js`、`styles.css`、`data/plants.json`、`sw.js`、`index.html` を更新した場合は、必要に応じてバージョンを上げる。

更新箇所:

- `app.js` の `ASSET_VERSION`
- `index.html` の `?v=...`
- `sw.js` の `CACHE_NAME`
- `sw.js` 内のキャッシュ対象URL

例:

- `20260626-02` から `20260629-01`
- `artarium-shell-v97` から `artarium-shell-v98`

## 実装時の注意

既存の保存済み設定を壊さない。
植物ごとの3D調整値は個別に管理する。
新しい植物に設定を追加する場合、既存植物の設定を上書きしない。

`localStorage` の主なキー:

- `artarium-mvp-state`
- `artarium-user-name`
- `artarium-demo-model-settings-v2`
- `artarium-production-model-settings`
- `artarium-demo-soil-assignments`
- `artarium-production-soil-assignments`
- `artarium-production-sync`

## 画面実装ルール

ホーム:

- 植物を最も目立たせる
- 今日の歩数、成長ポイント、ステージなどの数値はホーム上では主張させない
- 余計な説明を出しすぎない
- デモモード時のみ右側に3D調整パネルを出す

コレクション:

- 開花済み、かつ額装済みの作品だけ表示する
- 作家名に実在アーティスト名を出さない
- タイトルはアプリ内作品名として扱う
- 説明文は短く分かりやすくする

設定:

- 歩数連携、開発用歩数加算、リセットなどを置く
- 本番では3D調整項目を出さない

額縁選択:

- 60,000歩到達時は開花完了状態にする
- 額縁選択は自動表示しない
- ユーザーが「額装を選ぶ」を押した後に表示する
- 背景選択は現在行わない
- 額縁候補は実際の開花植物が入ったプレビューで見せる
- 額縁確定後にコレクションへ収蔵する

## 3Dモデル運用

モデル形式は GLB。

植物は6段階に分ける。

```text
models/plants/{plant-id}/stage-01-seed/
models/plants/{plant-id}/stage-02-sprout/
models/plants/{plant-id}/stage-03-leaves/
models/plants/{plant-id}/stage-04-bud/
models/plants/{plant-id}/stage-05-pre-bloom/
models/plants/{plant-id}/stage-06-bloom/
```

フォルダ名は具体的な実在作家名や作品名に寄せすぎず、アプリ内で扱いやすい汎用名にする。

例:

- `sunflower-bloom`
- `water-lily-bloom`
- `aquatic-bloom`
- `renaissance-smile-bloom`

## 土台モデル

土台はユーザーが選ぶのではなく、植物ごとに紐づける。

現在の土台タイプ:

- `gallery-loam`: 土の丘
- `water-surface`: 水面

指定箇所:

- `data/plants.json` の `soilType`
- `app.js` の `fallbackPlants`

水面植物の場合:

```json
"environmentType": "water",
"soilType": "water-surface"
```

土の植物の場合:

```json
"soilType": "gallery-loam"
```

## 水面と反射

水面モデル:

```text
models/shared/bases/water-surface/water+dish+3d+model+1k.glb
```

反射は植物モデルの反転コピーを水面上に薄く表示する方式。
デモ版では「反射を自動調整」ボタンを使える。

水面タイプのデフォルト設定は `water-lily-bloom` の設定を基準にする。

## 額縁モデル

現在は額縁GLBが未配置の場合、CSSのフォールバック額縁を表示する。

将来GLBを配置する場所:

```text
models/frames/walnut-shadow-box/frame.glb
models/frames/museum-black/frame.glb
models/frames/floating-maple/frame.glb
```

額縁タイプ定義は `app.js` の `FRAME_TYPES`。

## 植物追加手順

1. `models/plants/{plant-id}/` を作成する
2. `stage-01-seed` から `stage-06-bloom` までのフォルダを作る
3. 各ステージに GLB を置く
4. `data/plants.json` に植物データを追加する
5. `soilType` を指定する
6. `node scripts/sync-models.mjs` を実行する
7. デモ版で位置、サイズ、角度、土台、水面、反射を調整する
8. 「保存」し、「本番へ反映」を押す
9. 本番URLで確認する

既存植物のモデルだけを入れ替える場合は、各ステージフォルダにGLBを入れて `node scripts/sync-models.mjs` を実行する。
このコマンドは次をまとめて行う。

- `data/plants.json` の `stageModelPaths` を更新する
- `app.js` の `fallbackPlants` を `data/plants.json` と同期する
- `index.html`、`app.js`、`sw.js` のキャッシュバージョンを上げる

同期後は、コマンドに表示される `Asset version` をURLの `v=` に入れて確認する。

## 植物データ作成ルール

作家名には実在人物名を出さない。
現在は `Artarium Archive` を使う。

`copy.collectionTitle` は作品名として分かりやすくする。

例:

```json
"collectionTitle": "ひまわりの記憶",
"collectionLabel": "明るい黄色と筆あとをイメージした植物作品"
```

## 変更時に更新する資料

画面や体験の説明が変わる:

- `docs/presentation.md`
- `docs/specification.md`

実装手順やフォルダ構成が変わる:

- `docs/development-instructions.md`
- `models/README.md`

植物データや成長条件が変わる:

- `docs/specification.md`
- `data/plants.json`
- `app.js`

デザイン方針が変わる:

- `docs/presentation.md`
- `docs/specification.md`
- `styles.css`

## 動作確認

最低限の確認:

```bash
node --check app.js
node --check sw.js
node -e "JSON.parse(require('fs').readFileSync('data/plants.json','utf8')); console.log('plants json ok')"
```

ブラウザ確認:

- 本番URLを開く
- デモURLを開く
- 植物モデルが表示される
- 土台が正しく紐づく
- 水面植物は水面と反射が表示される
- 60,000歩到達後に開花完了状態が出る
- 「額装を選ぶ」操作後に額縁選択が出る
- 額縁確定後にコレクションに表示される
