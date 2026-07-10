# Artarium - 名画の庭

著作権フリーの名画をモチーフにした植物を育て、完成した植物をシャドーボックス型の額縁に飾るMVPモックです。

このWeb版は、将来的にExpo / React Nativeでスマホアプリ化する前提のモバイルファースト・プロトタイプです。PCブラウザでもスマホ幅のアプリ画面として表示されます。

## ドキュメント

今後仕様やデザイン、開発方針を変更した場合は、必要な資料も一緒に更新してください。

- [資料一覧 HTML](docs/index.html)
- [プレゼン資料 HTML](docs/presentation.html)
- [ブランドガイドライン HTML](docs/brand-identity.html)
- [開発指示書 HTML](docs/development-instructions.html)
- [仕様書 HTML](docs/specification.html)
- [要件定義書 HTML](docs/requirements.html)（2026-07-10 監査）
- [アーキテクチャ設計書 HTML](docs/architecture.html)
- [UI/UXレビュー HTML](docs/ux-review.html)（2026-07-10）
- [検証チェックリスト HTML](docs/testing.html)
- [今後の開発計画 HTML](docs/roadmap.html)
- [開発スケジュール案 HTML](docs/development-schedule.html)

役割分担:

- **現状仕様の正**は `docs/specification.md`、**バックログの正**は `docs/roadmap.md`
- `docs/requirements.md`・`docs/architecture.md`・`docs/ux-review.md` は日付つきの監査記録（原則書き換えず、解消したら「対応済み」を追記）
- AI向け作業ルールは `CLAUDE.md`（`AGENTS.md` は同内容へのシンボリックリンク）
- Markdown を更新したら `node docs/build-html.mjs` でHTMLを再生成する

## 実装内容

- ホーム画面（没入型3Dシーン）
- コレクション画面（額装作品の壁＋図鑑「名画の由来」＋拡大鑑賞）
- 設定画面
- デモ用3D調整画面
- スマホ歩数計連携を想定した歩数同期
- `10歩 = 1成長ポイント` の変換
- 歩数取得不可時の開発用テスト加算
- Stage1からStage6までの進化
- 60,000歩到達後の開花完了表示と点灯式（開花演出）
- 植物9種（各6ステージのGLB配置・配置値焼き込み済み）
- ユーザー操作による額縁選択
- 額装後のコレクション登録
- GLBモデル表示対応
- 植物GLB、土台GLB、水面GLB、額縁GLBの表示
- 水面植物の反射表現
- 植物ごとの額縁タイプ変更
- 3Dモデル未配置時の仮画像フォールバック
- 実天気連携（Open-Meteo）と時刻・季節連動の空シェーダー
- 波動シミュレーション水面（タップで波紋）
- 植物エフェクト（モチーフ別の揺れ・粒子・開花後の散り）
- 環境音（Web Audio 合成の雨・波紋・雷鳴）
- 週間振り返り（直近7日の歩数グラフ）
- 鑑賞モード（UIを消して全画面で眺める）
- 作品画像の保存（美術館プレート付きPNG）
- `data/plants.json` による植物データ管理
- `data/model-settings.json` による3D配置の焼き込み
- `localStorage` による進行状況保存
- PWA用 `manifest.webmanifest`
- PWA用アイコン `icon.svg`
- 基本ファイルをキャッシュする `sw.js`（`.json` はネットワーク優先）

## スマホアプリ化前提の方針

- 画面は `ホーム`、`コレクション`、`設定` の3タブ構成
- ナビゲーションは下部固定タブ
- UIは片手操作しやすい縦長レイアウト
- 状態管理は将来 `AsyncStorage` に移しやすいよう、植物データと進行データを分離
- 歩数連携は将来 HealthKit / Health Connect / ネイティブブリッジへ差し替える想定
- 3D表示は将来 `expo-three` や `react-three-fiber/native` へ移行する想定
- Web版はPWAとしてホーム画面追加を試せる構成

## 3Dモデル

`data/plants.json` の `stageModelPaths` に植物GLB、`soilType` に土台タイプ、`FRAME_TYPES` の `modelPath` に額縁GLBを指定します。

初期値では以下のパスを参照します。ファイルが無い場合は仮画像が表示されます。

- `models/plants/{plant-id}/stage-*/`
- `models/shared/soil/`
- `models/shared/bases/water-surface/`
- `models/frames/`

モデルを入れ替えた後は、次のコマンドで植物モデルのパス、フォールバックデータ、キャッシュバージョンをまとめて更新できます。

```bash
node scripts/sync-models.mjs
```

Three.jsは先に `vendor/three.module.js` と `vendor/GLTFLoader.js` を探し、無い場合はCDNを試します。完全オフラインでGLB表示する場合は `vendor/` にThree.jsを配置してください。

## 歩数連携

Web単体ではiOSヘルスケアやAndroidの歩数計を直接読む標準APIがないため、MVPでは以下の入力に対応しています。

- ネイティブアプリ側から `window.Artarium.receiveStepData({ todaySteps, totalSteps })` を呼ぶ
- ネイティブブリッジとして `window.ArtariumStepBridge.getTodaySteps()` を実装する
- ブラウザの `DeviceMotionEvent` による簡易歩数検知を使う
- 取得できない場合は「テスト +10歩」ボタンを使う

## 起動

```bash
python3 -m http.server 3025 --bind 127.0.0.1
```

起動後、ブラウザで以下を開きます（`v=` は `index.html` の `?v=` に合わせる。2026-07-10 時点は `20260709-99`）。

- 本番: `http://127.0.0.1:3025/?v=20260709-99`
- デモ: `http://127.0.0.1:3025/?demo=1&v=20260709-99`

モデル同期後は、コマンドの最後に表示される `Asset version` をURLの `v=` に入れて確認します。
