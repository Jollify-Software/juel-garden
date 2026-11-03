# Mesh and texture decoders

Copied to `dist/decoders/` by the build (`npm run copy-decoders`) and used by
`<garden-mesh-model>` for compressed glTF, so a scene loads offline (inside a
`.jollify` package, say) instead of fetching the decoders from Babylon's CDN.
See `src/Decoders.ts`.

| File | What | Licence |
|---|---|---|
| `draco_wasm_wrapper_gltf.js`, `draco_decoder_gltf.wasm`, `draco_decoder_gltf.js` | Google's Draco decoder for glTF (`KHR_draco_mesh_compression`), WebAssembly plus its JavaScript fallback | Apache 2.0 (https://github.com/google/draco) |
| `meshopt_decoder.js` | meshoptimizer's decoder (`EXT_meshopt_compression`) | MIT (https://github.com/zeux/meshoptimizer) |

| `ktx2/babylon.ktx2Decoder.js` | Babylon's KTX2 texture decoder (the worker module; from `https://cdn.babylonjs.com/v8.56.2/`, matching `@babylonjs/core`) | Apache 2.0 (Babylon.js) |
| `ktx2/uastc_*.wasm`, `ktx2/msc_basis_transcoder.js`, `.wasm` | Its Basis Universal transcoders (UASTC to ASTC, BC7, RGBA, R8, RG8; the ETC1S transcoder), from `https://cdn.babylonjs.com/ktx2Transcoders/1/` | Apache 2.0 (Binomial LLC, Basis Universal) |
| `ktx2/zstddec.wasm` | The Zstandard decoder for supercompressed KTX2 | BSD (Facebook, zstd) |

Downloaded from https://cdn.babylonjs.com/ (the copies Babylon.js loads by
default): the mesh decoders on 2026-10-15, the KTX2 ones on 2026-10-27. To update, download
the same files again (the KTX2 decoder from the folder of the Babylon version in use).
`Tools/ktx2-encode.mjs` makes `.ktx2` textures.
