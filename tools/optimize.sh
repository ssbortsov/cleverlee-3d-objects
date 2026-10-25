#!/usr/bin/env bash
# Optimize a .glb for the dither effect: drop textures/materials extras, weld, compress (meshopt).
# Usage: tools/optimize.sh input.glb models/name.glb [--flat]
#   --flat  also drop normals (for faceted / low-poly models: 3–4× smaller, lighting is computed per face)
set -euo pipefail
IN="$1"; OUT="$2"; FLAT="${3:-}"
TMP="$(mktemp -d)"
GT="npx -y @gltf-transform/cli@4.1.1"
$GT dedup "$IN" "$TMP/a.glb"
# remove all textures (the effect ignores them) — keeps geometry only
node -e '
const {NodeIO}=require("@gltf-transform/core");const {ALL_EXTENSIONS}=require("@gltf-transform/extensions");
const {prune,weld}=require("@gltf-transform/functions");
(async()=>{const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const d=await io.read(process.argv[1]);const r=d.getRoot();
for(const t of r.listTextures())t.dispose();
for(const e of r.listExtensionsUsed())if(/materials_|texture_/i.test(e.extensionName))e.dispose();
for(const m of r.listMeshes())for(const p of m.listPrimitives()){for(const s of p.listSemantics())if(/^(TEXCOORD|COLOR|TANGENT|JOINTS|WEIGHTS)/.test(s))p.setAttribute(s,null);if(process.argv[3]==="--flat")p.setAttribute("NORMAL",null);}
await d.transform(prune(),weld());await io.write(process.argv[2],d);})();
' "$TMP/a.glb" "$TMP/b.glb" "$FLAT"
$GT meshopt "$TMP/b.glb" "$OUT" --level medium
ls -l "$IN" "$OUT"
