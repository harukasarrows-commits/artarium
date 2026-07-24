---
paths:
  - "app.js"
  - "data/model-settings.json"
  - "data/plants.json"
  - "models/**"
  - "scripts/autotune.mjs"
  - "scripts/check-stale-settings.mjs"
---

# 3D配置と焼き込みの鉄則（1〜3, 7）

鉄則は全7項目の一連セット。4〜6は `.claude/rules/sw-cache.md` にある。

- **新植物の追加時（2026-07-09 ユーザー指示）**: 初期配置は `scripts/autotune.mjs`（直立 rotX/rotZ=0・正面 rotY=-1.57・センタリング・成長カーブB＝目標高さNDC {0.12,0.22,0.36,0.56,0.85,1.25}/幅上限1.9・土 2.5→2.7→2.95→3.2）で自動生成して焼き込む。**その後の微調整はユーザーが手動で行う**ので、自動調整で上書きし直さない。
- **3D配置調整の正（2026-07-09）**: 全植物×全ステージの配置値は `data/model-settings.json`（リポジトリ焼き込み）。起動時に localStorage の設定へマージされる。ただし**デモパネルで明示的に動かした値は「調整オーバーライド」（`artarium-tuned-overrides`）として別枠保存され、起動時に焼き込みの上へ重なる**（2026-07-23。「保存が再読み込みで巻き戻る」対策。初期値ボタンで消える）。調整をやり直すときは `?demo=1` の `window.__artariumTune`（get/set/dump）と、ホームビューアの `dataset.plantNdc`（植物のNDC位置計測。土の天面 `soilTopNdcY` も入る）を使う。全植物とも直立・正面向き（plantRotX=0 / plantRotZ=0 / plantRotY=-1.57。旧値 -0.72 は「斜め横向き」でユーザー指摘により変更）。**例外: Stage1（種）のみ種ごとに個別の plantRotZ で植え穴・水面に自然に横たえる（2026-07-23 ユーザー決定）— 直立に「修正」し直さないこと**。土は soilScale=2.5（旧 3.12 は「大きすぎ」でユーザー指摘により変更）。焼き込みキーは plantScale / plantY / plantRotX / plantRotY / plantRotZ ＋ 土植物のみ soilScale ＋ 水面植物のみ waterOpacity（全ステージ0.5）と reflectionOpacity（全ステージ0.2。いずれも2026-07-23 追加）。
- **配置焼き込みの鉄則（2026-07-09 の回帰から）**:
  1. `model-settings.json` には**意図して調整したキーだけ**を入れる（現在: plantScale / plantY / plantRotX / plantRotZ）。`applyBakedModelSettings` はキー単位マージであり、全キー上書きに戻してはいけない — 触っていないパラメータ（土・反射・水面）まで固定化して意図しない見た目変更を生んだ前科がある。
  2. 検証は**クリーンな localStorage だけでなく、旧バージョンの設定が残った状態でも行う**（`scripts/check-stale-settings.mjs` 方式）。実端末には過去の自動保存値が必ず残っている。
  3. 評価基準は「画面に収まる」だけでなく**「姿勢（直立）・接地・土台との比率」**まで見る。花モデルは下方に不可視ジオメトリが伸びていることがあり、バウンディングボックスの底 ≠ 見た目の底。数値合わせのあと必ずスクリーンショットで目視確認する。
  7. **検証は `scripts/check-stale-settings.mjs`（旧設定残存＋焼き込み優先の確認）を実値比較で必ずPASSさせてから報告する**。スクリーンショットが良く見えても、キャッシュ・localStorage経路が壊れていると実端末では反映されない。
