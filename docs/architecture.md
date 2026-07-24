# Artarium アーキテクチャ設計書（architecture.md）

作成日: 2026-07-10
前提: [requirements.md](requirements.md) の要件ID（FR/NFR/G/M/S/C）を参照する。
位置づけ: 現状構造の記録（as-is）と、改善の方向づけ（to-be）。実装手順の正は `development-instructions.md`、運用の鉄則は `CLAUDE.md`。
更新ルール: この文書は**日付つきスナップショット（設計記録）**。構造が大きく変わったら改訂日を明記して該当章を更新する。§9 の不変条件だけは常に最新を維持する。

---

## 1. 技術スタックと設計思想

| 項目 | 採用 | 理由・特記 |
|---|---|---|
| 言語・実行形態 | バニラJS（ES Modules）、**ビルド工程なし** | `python3 -m http.server` だけで動く。トランスパイル・バンドラ・型チェックなし |
| 3D | Three.js r164（`vendor/` 同梱、CDNフォールバック） | GLTFLoader / BufferGeometryUtils 同梱で完全オフライン動作可 |
| シェーダー | 自作GLSL（空: WebGL2生API / 水面: WebGL2生API + Three.js ShaderMaterial） | ライブラリに頼らず演出を完全制御 |
| 状態管理 | 単一 `state` オブジェクト + `render()` 一括再描画 | フレームワークなし。React的な「状態→全再描画」を手書きで踏襲 |
| 永続化 | localStorage（+ リポジトリ焼き込みJSON） | 将来 AsyncStorage へ差し替え前提（NFR-5） |
| 配信 | PWA（Service Worker + `?v=` クエリの世代管理） | 静的ホスティングのみで完結 |
| 外部依存 | Open-Meteo API（天気）のみ。APIキー・アカウント不要 | 失敗しても時刻連動で動く（NFR-1） |

**設計思想**: 「サーバーもビルドもない、1フォルダで完結する美術館」。すべての外部要因（GPU機能・ネットワーク・センサー権限）に対して段階的フォールバックを持ち、**最悪でもCSSだけで体験が成立する**ことを不変条件にしている。

## 2. 全体構成

```
┌────────────────────────────────────────────────────────────┐
│ index.html（画面骨格） + styles.css（ダークギャラリートークン）│
├────────────────────────────────────────────────────────────┤
│                    app.js（統合ハブ・約4,742行）              │
│  状態管理 / ビュー描画 / 歩数→成長 / 額装フロー / 3Dシーン構築 │
│  デモ調整パネル / 鑑賞モード / SW登録                         │
├──────────┬──────────┬───────────┬──────────┬───────────────┤
│ sky-     │ water-   │ plant-    │ weather  │ ambient-      │
│ background│ surface  │ effects   │ .js      │ sound.js      │
│ (空・季節 │ (波動sim │ (揺れ・粒子│ (Open-   │ (WebAudio     │
│  ・時刻)  │  ・反射)  │  ・散り)  │  Meteo)  │  合成音)      │
├──────────┴──────────┴───────────┴──────────┴───────────────┤
│ data/plants.json・model-settings.json │ models/ (GLB×57+)   │
│ vendor/ (Three.js r164)               │ sw.js / manifest    │
└────────────────────────────────────────────────────────────┘
```

**依存方向**: app.js → 各モジュール（一方向）。モジュール間の直接依存は **water-surface → sky-background**（太陽位置・歩数進捗の同期）の1本のみ。

**疎結合の仕掛け**:
- **CustomEvent**: `artarium:lightning`（空→雷鳴音）、`artarium:ripple`（水面→波紋音）。音モジュールは他モジュールを一切importしない。
- **依存注入**: plant-effects と water-surface のThree.js部分は `THREE` を引数で受け取る。three.module.js を直接importするのは app.js の動的import（`loadThreeRuntime`）だけ。将来 expo-three へ差し替える際の変更点が1箇所に集約されている（NFR-5）。

## 3. モジュール一覧

| ファイル | 行数 | 役割 | 主要export | 特記 |
|---|---:|---|---|---|
| app.js | 4,742 | 統合ハブ（下記 §4） | なし（エントリポイント） | **肥大化が最大の技術的負債**（§8） |
| core/progress.js | 51 | 成長段階・歩数換算・履歴整理の純粋ロジック | getStage, applyStepsToProgress, trimStepHistory ほか | 2026-07-21に最初の分割として追加。`node:test` で検証 |
| storage/progress-store.js | 33 | 進行データの読込・保存・スキーマ移行 | loadProgressState, saveProgressState, migrateProgressState | 旧形式・壊れたJSON・将来版を自動テスト |
| ui/modal-controller.js | 87 | モーダル共通のフォーカス・背景操作制御 | createModalController | Tab循環、フォーカス復帰、背景inert、スクロール停止 |
| views/settings-view.js | 51 | 設定画面の描画とイベント結線 | renderSettingsView, bindSettingsView | 実処理をコールバック注入し、DOM表示を単体テスト |
| views/collection-view.js | 142 | コレクション一覧・空状態・図鑑・一覧操作 | renderCollectionView, renderCodexView, bindCollectionView | 3D生成はapp.jsに残し、マークアップ関数を注入 |
| views/home-status-view.js | 88 | ホーム進捗ライン・完成プレート・関連操作 | renderHomeProgressView, renderCompletionPlaqueView, bindHomeStatusView | 成長計算と額装遷移はapp.jsに残す |
| sky-background.js | 960 | 空＋湖のGLSL背景。時刻8点補間×季節×天気。FXレイヤー（花火・蛍・流れ星） | mountSkyBackground, setSkyWeather, getSkySunState, setSkyStepProgress ほか | 低解像度雲・フレーム間引き・非表示停止の省電力設計（NFR-2） |
| water-surface.js | 575 | 波動方程式シミュレーション水面（独立canvas版とThree.jsメッシュ版の2系統） | mountWaterSurface, observeWaterSurfaces, createThreeWater, setAmbientRain, rainBurst | RG16F ping-pong FBO。光の道は空の太陽位置と同期 |
| plant-effects.js | 1,157 | モチーフ別演出（揺れ・粒子・開花後の散り・雨の露）。頂点シェーダー注入 | createPlantEffects, setPlantWind, setPlantRain, calmPlantEffects, shedPetalsNow | 花びら色はGLBテクスチャの実画素から採取 |
| weather.js | 105 | Open-Meteo→表現パラメータ変換。30分キャッシュ | initWeatherSync, WEATHER_PRESETS | 位置情報拒否時は東京固定 |
| ambient-sound.js | 290 | WebAudio合成音（雨・波紋・雷鳴・風・渡り鳥） | setSoundEnabled, setRainSoundLevel, playRipplePlop ほか | 音声ファイル不使用。オフ時はAudioContext自体を作らない |
| sw.js | 102 | アプリシェル＋容量制御付きGLBランタイムキャッシュ | — | `.json` はネットワーク優先（鉄則6）、GLBは最大18件 |
| scripts/sync-models.mjs | — | GLB差し替え＋fallback同期＋版数一括更新 | — | 運用の要（§7） |
| scripts/check-runtime-performance.mjs | 114 | 初回転送量・GLB要求数・JS例外・メモリの計測 | — | 初回6MB以下・GLB 6件以下を回帰条件にする |
| docs/build-html.mjs | — | Markdown→HTML資料ビルダー | — | 自前パーサ |

## 4. app.js の内部構造（as-is）

単一ファイルだが、内部は概ね以下の順に区画化されている（行番号は 2026-07-10 時点）:

| 区画 | 行範囲(目安) | 内容 |
|---|---|---|
| 定数・植物データ | 1〜635 | import、成長定数（`STEPS_PER_POINT` 等）、`CODEX_NOTES`、額縁定義、`fallbackPlants`（plants.json の複製）、`state` 定義 |
| 起動・読込 | 637〜930 | `init()`、plants.json / model-settings.json fetch、localStorage読み書き、モデル設定の正規化・レガシー移行 |
| 進行・成長ロジック | 931〜1005 | `loadProgress` / `saveProgress`、`getStage`、`isPlantComplete` |
| イベント結線 | 1007〜1487 | `bindEvents()`（約330行の一枚岩）、デモパネル操作、マルチタブ同期 |
| ビュー描画 | 1489〜1911 | `render()` と renderXxx 群（ホーム・種選択・完成プレート・育成） |
| 歩数・成長適用 | 1913〜2007 | ブリッジ同期、`addGrowthFromSteps`、完成マーク |
| 演出 | 2009〜2180 | 点灯式（`playBloomCelebration`）、鑑賞モード、傾き視差 |
| センサー・日付 | 2182〜2350 | DeviceMotion歩数計、日付リセット、週間振り返り、図鑑、設定 |
| 額装・コレクション | 2352〜2760 | デモパネル描画、額縁選択、拡大鑑賞、ギャラリー描画 |
| 3Dシーン構築 | 2761〜3915 | `loadThreeRuntime`、`createGalleryScene` / `createPlantScene`、額縁組み立て、反射・水面・真珠質マテリアル、アニメーションループ、GLB読込、フォールバック |

**描画モデル**: `render()` が全ビューの renderXxx を呼び、`is-active` の切替とinnerHTML再構築で更新する。3Dシーンだけは `container.__artariumScene` とトークン（`isCurrentModelRender`）で管理し、再描画時に持続canvas（空・FX・水面）を除いて破棄・再構築する（CLAUDE.md 鉄則5の背景）。

種選択一覧のStage1 GLBは `IntersectionObserver` で画面付近だけ遅延読込する。2026-07-22の390×844計測では、初回転送量を11.48MBから4.61MB、GLB要求を9件から5件へ削減した。

## 5. データフロー

### 5.1 歩数 → 成長 → 保存 → 表示（コアループ）

```
[歩数ソース]                       [変換]                [永続化]
 ネイティブブリッジ ─┐
 DeviceMotion歩数計 ─┼→ applyStepSnapshot / addStepsToSelectedPlant
 テスト加算        ─┘        │
                    addGrowthFromSteps(FR-1.1: 10歩=1pt, 端数繰越)
                              │
              points更新 → getStage() でステージ判定
                              │ ステージ上昇?
                              ├─ Yes → pendingBloomCelebration 予約
                              │         (次回描画完了時に点灯式 FR-5.5)
                              ├─ 6000pt到達 → newlyCompletedPlantId
                              │         (完成プレート → 額装フロー FR-3.5)
                              └→ saveProgress() → localStorage "artarium-mvp-state"
                                       │
                              render() → ホーム3Dシーン(該当stageのGLB) ＋
                                        setSkyStepProgress(湖の光の道 FR-1.5)
```

### 5.2 天気 → シーン一括反映（ファンアウト）

```
weather.js (Open-Meteo, 30分毎) → applyWeatherToScene(weather)
   ├→ setSkyWeather()      … 空の雲・雨・雷
   ├→ setAmbientRain()     … 全水面の雨滴
   ├→ setRainSoundLevel()  … 雨音量
   ├→ setPlantWind() / setPlantRain() … 植物の揺れ・葉の露
   └→ maybeShowWeatherGreeting() … 当日1回の挨拶
```

### 5.3 設定値の優先順位（3D配置）

```
data/model-settings.json（焼き込み・正）
   │ 起動時 fetch → applyBakedModelSettings（キー単位マージ・鉄則1）
   ▼
localStorage（demo系 / production系）→ 正規化・レガシー移行
   ▼
getSceneModelSettings(stage, plantId) → シーン構築へ
```
デモパネルの調整は localStorage 側に保存され、「本番へ反映」で production 系キーへコピー＋`storage` イベントで他タブへ通知される。

## 6. 3Dシーン構築（2系統）

| | createPlantScene（ホーム育成） | createGalleryScene（額装・コレクション） |
|---|---|---|
| 内容 | 植物GLB＋土/水面＋植物エフェクト | 額縁（GLBまたは `buildShadowBoxFrame` で生成）＋開花植物＋反射 |
| 使用箇所 | ホーム、種プレビュー | コレクション壁、額縁選択プレビュー、拡大鑑賞 |
| 共通処理 | `normalizeModel`（寸法正規化）、`createTunedModelGroup`（焼き込み値適用）、水面なら `createWaterEnvironmentGroup`（shader水面＋Y反転クローン反射） | 同左 |

**フォールバック連鎖（NFR-1）**: vendor Three.js → CDN → 失敗なら `renderModelFallback` / `restoreGalleryFallback`（CSS額装）。GLB個別の読込失敗も `safeLoadGltf` で握って継続。

**ライティング**: `getSunLighting` が sky-background の太陽状態（`getSkySunState`）から光源色・方向を作り、空と3Dシーンの光を一致させる。

## 7. アセット・バージョン管理と配信

```
node scripts/sync-models.mjs
  ├ models/ の最新GLBを検出 → data/plants.json の stageModelPaths 更新
  ├ app.js の fallbackPlants を plants.json と同期（二重管理の自動解消）
  ├ ASSET_VERSION を YYYYMMDD-NN でインクリメント
  └ index.html / app.js / sw.js の全 ?v= と CACHE_NAME を一括更新
```

- **キャッシュ戦略（sw.js）**: navigate・`.json`・document/style/script/worker は**ネットワーク優先**（成功時キャッシュ更新、失敗時キャッシュ）。画像・GLBは**キャッシュ優先**。`.json` をキャッシュ優先へ戻すのは禁止（CLAUDE.md 鉄則6の再発防止策）。
- **運用順序**: 「内容の生成が終わってから版数を上げる」（鉄則6）。新規ファイルは sw.js の APP_SHELL への追加を忘れない（鉄則4）。

## 8. 課題と改善提案

### 8.1 今すぐ直すべきもの

| # | 課題 | 提案 |
|---|---|---|
| A-1 | **バージョン定数の drift**: `app.js:60` の `ASSET_VERSION = "20260709-91"` に対し、実際の `?v=` は `20260709-99`。plants.json / model-settings.json のfetchと「本番で確認」ボタンが古い版数キーを使っている。sw.js の `.json` ネットワーク優先が実害を吸収しているが、**版数管理が2系統に割れている状態**。sedによる一括更新が `?v=` 文字列しか書き換えなかったことが原因（鉄則4と同根） | 即時: `ASSET_VERSION` を現行版へ手動同期。恒久: `?v=` の一括更新時に `ASSET_VERSION` も対象に含める（sync-models.mjs 経由の更新に一本化するのが最善） → **対応済み（2026-07-10）**: `ASSET_VERSION` を `20260709-99` に同期。恒久策（sync-models.mjs への一本化）は運用ルールとして testing.md に記載 |
| A-2 | **到達不能コード**: grow-view（G-1）と install-notice 描画（G-2）が本番導線から切れたまま残存 | 要件判断（M-1）とセットで、廃止なら削除、採用なら導線実装 |
| A-3 | **`bindEvents()` の一枚岩**（約330行）: 全画面のイベントが1関数に集中し、機能追加のたびに肥大化 | §8.2 の分割と同時に、ビュー単位のbind関数へ分離 |

### 8.2 段階的に進めるもの（スマホアプリ化 = S-4 への布石）

**app.js の分割**。3,915行の単一ファイルは、RN移行時に「何がUI依存で何がロジックか」の切り分けコストがそのまま移植コストになる。ビルド工程を増やさずES Modulesのまま、§4の既存区画に沿って切り出す:

```
app.js（エントリ・結線のみに縮小）
├ core/state.js        … state定義・saveProgress/loadProgress・localStorage抽象
├ core/growth.js       … 歩数→pt変換・ステージ判定（純関数群。最初に切り出す価値が最大）
├ core/steps.js        … ブリッジ・DeviceMotion・日付リセット
├ views/…              … renderHome/renderGallery/renderSettings ほか
├ scene/…              … createPlantScene/createGalleryScene・マテリアル群
└ demo/tuning-panel.js … ?demo=1 専用（本番バンドルから概念的に隔離）
```

移行手順の推奨: ①純関数（growth・日付・フォーマッタ）→ ②storage層（localStorage を `storage.get/set` 抽象に包む = AsyncStorage差し替え口）→ ③ビュー → ④3Dシーン、の順で依存の少ない側から。各段階で `sync-models.mjs` の `fallbackPlants` 置換と `?v=` 更新の対象パスを追随させること（スクリプトが app.js 単一ファイル前提になっている点に注意）。

| # | 課題 | 提案 |
|---|---|---|
| A-4 | **自動テスト不足** → **一部対応（2026-07-21）**: `core/progress.js` と `tests/progress.test.mjs` を追加し、端数繰越・ステージ境界・完成上限・21日履歴を検証。日付跨ぎ・保存移行・画面遷移は引き続き追加が必要 | 次はstorage層の分離と同時に、保存移行・日付リセットを `node:test` へ追加する |
| A-5 | **localStorage 直書きの散在** → **進行データは対応（2026-07-22）**: `storage/progress-store.js` へ読込・保存・migrationを分離し、`__schemaVersion: 1` を自動付与。モデル調整設定は鉄則を守るため現状維持 | ネイティブ移行時は同じ関数境界のstorage引数をAsyncStorageアダプターへ差し替える |
| A-6 | **fallbackPlants の二重管理**: plants.json とapp.js内配列の重複。sync-models.mjs が同期するが、手編集すると乖離しうる | 当面は「plants.json を手で編集したら必ず sync-models.mjs を通す」を運用ルール化。分割後は fetch失敗時のみ動的importする別ファイルへ |

### 8.3 将来（アプリ化以降）

- **クラウド保存（C-3）**: 保存データが「進行パラメータのみ・画像なし」という現設計はそのままサーバー同期に向く。`artarium-mvp-state` のスキーマに `schemaVersion` を今のうちに入れておくと移行が楽。
- **3D層の移植**: plant-effects / water-surface のDIパターンは維持。sky-background（WebGL2生API）はRNで動かないため、expo-gl 用の書き直しかネイティブスカイの再設計が必要 — 移植コストが最も高いのはここ。
- **通知（C-2）**: Web Push を挟まず、アプリ化時にネイティブ通知で実装する方が「控えめな美術館の文体」の制御がしやすい。

## 9. 不変条件（変更してはいけないもの）

1. `.json` のSWネットワーク優先（鉄則6）
2. 持続キャンバス除外セレクタ `canvas:not(.sky-canvas):not(.sky-fx-canvas):not(.water-surface-canvas)`（鉄則5）
3. `applyBakedModelSettings` のキー単位マージ（鉄則1）
4. モジュールへのTHREE依存注入（直接importをapp.jsに集約）
5. すべての外部要因へのフォールバック連鎖（NFR-1）— 新機能も「失敗したら静かに退化する」を守る
