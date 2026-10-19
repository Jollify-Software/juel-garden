import { DracoCompression } from "@babylonjs/core/Meshes/Compression/dracoCompression";
import { MeshoptCompression } from "@babylonjs/core/Meshes/Compression/meshoptCompression";

// Captured while the bundle's own <script> runs -- the only moment
// document.currentScript points at juel-garden.js (as in Physics.ts).
const scriptSrc = (document.currentScript as HTMLScriptElement)?.src;

/**
 * Points Babylon's Draco and meshopt decoders (for compressed glTF) at the
 * copies the build puts in `decoders/` next to `juel-garden.js`, instead of
 * Babylon's CDN, so compressed models load offline. A page can still set
 * `BABYLON.DracoCompression.Configuration` / `MeshoptCompression.Configuration`
 * itself after loading juel-garden.js.
 */
export function useLocalDecoders(base = scriptSrc ? new URL("decoders/", scriptSrc).href : "decoders/") {
    DracoCompression.Configuration = {
        decoder: {
            wasmUrl: base + "draco_wasm_wrapper_gltf.js",
            wasmBinaryUrl: base + "draco_decoder_gltf.wasm",
            fallbackUrl: base + "draco_decoder_gltf.js",
        },
    };
    MeshoptCompression.Configuration = {
        decoder: { url: base + "meshopt_decoder.js" },
    };
}

useLocalDecoders();
