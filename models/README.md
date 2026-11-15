# Artarium 3D Model Folders

## Shared

- `shared/soil/soil_pile_v01.glb`

## Plants

Put each plant model in the matching stage folder as `plant.glb`.

Example:

```text
plants/sunflower-bloom/stage-01-seed/plant.glb
plants/sunflower-bloom/stage-02-sprout/plant.glb
plants/sunflower-bloom/stage-03-leaves/plant.glb
plants/sunflower-bloom/stage-04-bud/plant.glb
plants/sunflower-bloom/stage-05-pre-bloom/plant.glb
plants/sunflower-bloom/stage-06-bloom/plant.glb
```

You can also place a reference image in each stage folder:

```text
reference.png
```

## Frames

Frames do not use GLB models. All 7 frame types are generated procedurally in code (`FRAME_TYPES` / `buildShadowBoxFrame` in `app.js`, decision 2026-07-14). Do not place frame GLB files under `frames/` — they are not loaded.
