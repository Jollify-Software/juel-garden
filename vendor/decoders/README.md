# Mesh decoders

Copied to `dist/decoders/` by the build (`npm run copy-decoders`) and used by
`<garden-mesh-model>` for compressed glTF, so a scene loads offline (inside a
`.jollify` package, say) instead of fetching the decoders from Babylon's CDN.
See `src/Decoders.ts`.

| File | What | Licence |
|---|---|---|
| `draco_wasm_wrapper_gltf.js`, `draco_decoder_gltf.wasm`, `draco_decoder_gltf.js` | Google's Draco decoder for glTF (`KHR_draco_mesh_compression`), WebAssembly plus its JavaScript fallback | Apache 2.0 (https://github.com/google/draco) |
| `meshopt_decoder.js` | meshoptimizer's decoder (`EXT_meshopt_compression`) | MIT (https://github.com/zeux/meshoptimizer) |

Downloaded from https://cdn.babylonjs.com/ (the copies Babylon.js loads by
default) on 2026-10-15. To update, download the same four files again.
