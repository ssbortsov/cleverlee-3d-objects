# Cleverlee — 3D objects

Static site on GitHub Pages (branch `main`, root). No build step for the site itself.
Gallery `index.html` reads `models.json` and loads `models/*.glb` through `lib/dither-3d.min.js`.

## Adding a model (the usual task)

The user drops a source file (often in `source/`, which is git-ignored) and asks to add it.

1. Only `.glb` is supported. For `.gltf`, `.fbx`, `.obj`: convert to `.glb` first
   (`npx @gltf-transform/cli copy in.gltf out.glb`; for fbx/obj ask the user to export glb from Blender).
2. Optimize: `tools/optimize.sh source/<file>.glb models/<slug>.glb`.
   Use `--flat` when the model is faceted/low-poly or very heavy — it drops normals (3–4× smaller).
   Target: under ~150 KB per model. If still large, simplify:
   `npx @gltf-transform/cli simplify models/<slug>.glb models/<slug>.glb --ratio 0.5 --error 0.001`
   then re-run meshopt. Draco is not allowed (the module ships only the meshopt decoder).
3. Add an entry to `models.json`:
   `{ "id": "<slug>", "name": "<human name>", "file": "models/<slug>.glb",
      "modelRotation": [x, y, z], "tilt": [0.2, 0, 0], "fit": 2.2, "credit": "", "creditUrl": "" }`
   Rotations are radians. Most Sketchfab/Blender exports need `[0,0,0]`; if the model lies on its side,
   try ±1.5708 on X. Long horizontal objects look best with `fit` ~2.6, round ones ~1.5.
   Fill `credit` from the glb's `asset.extras` (author, license, source) when present — CC BY needs credit.
4. Check it renders: `npx serve .` and open the gallery (or run a Playwright screenshot).
5. Commit with a short message (`Add <name> model`) and push. Pages updates in ~1 minute.

## Changing the effect

Source: `lib/dither-3d.src.js` (Three.js 0.169, ESM). Rebuild after edits: `npm i && npm run build`,
commit both `.src.js` and `.min.js`. Default effect values used by the gallery: pixel 4, offset 0.18, range 0.87.
Palette: Y F5E900, R F4387A, P 8C03E8, K 1D1D1B, W FFFFFF. Sprite is 55×2 (two strings in DEFAULTS.sprite).

## Language

The user writes in Russian; reply in Russian, keep commit messages in English.
