import { DracoCompression } from "@babylonjs/core/Meshes/Compression/dracoCompression";
import { MeshoptCompression } from "@babylonjs/core/Meshes/Compression/meshoptCompression";
import { KhronosTextureContainer2 } from "@babylonjs/core/Misc/khronosTextureContainer2";

// Captured while the bundle's own <script> runs -- the only moment
// document.currentScript points at juel-garden.js (as in Physics.ts).
const scriptSrc = (document.currentScript as HTMLScriptElement)?.src;

/**
 * Points Babylon's Draco and meshopt decoders (for compressed glTF) and its KTX2 texture
 * decoder (GPU-compressed textures: `.ktx2` files and glTF's `KHR_texture_basisu`, made by
 * `Tools/ktx2-encode.mjs`) at the copies the build puts in `decoders/` next to
 * `juel-garden.js`, instead of Babylon's CDN, so compressed models and textures load
 * offline. A page can still set `BABYLON.DracoCompression.Configuration`,
 * `MeshoptCompression.Configuration` or `KhronosTextureContainer2.URLConfig` itself after
 * loading juel-garden.js.
 *
 * Loaded as an ES module (a game bundling the library) there is no script to find the
 * folder from: then it is `decoders/` beside the page, juel-garden's `dist/decoders/` copied there.
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
    // The KTX2 decoder runs in a worker made from a blob, where a relative URL means nothing: absolute.
    let ktx2 = new URL(base + "ktx2/", document.baseURI).href;
    KhronosTextureContainer2.URLConfig = {
        jsDecoderModule: ktx2 + "babylon.ktx2Decoder.js",
        wasmUASTCToASTC: ktx2 + "uastc_astc.wasm",
        wasmUASTCToBC7: ktx2 + "uastc_bc7.wasm",
        wasmUASTCToRGBA_UNORM: ktx2 + "uastc_rgba8_unorm_v2.wasm",
        wasmUASTCToRGBA_SRGB: ktx2 + "uastc_rgba8_srgb_v2.wasm",
        wasmUASTCToR8_UNORM: ktx2 + "uastc_r8_unorm.wasm",
        wasmUASTCToRG8_UNORM: ktx2 + "uastc_rg8_unorm.wasm",
        jsMSCTranscoder: ktx2 + "msc_basis_transcoder.js",
        wasmMSCTranscoder: ktx2 + "msc_basis_transcoder.wasm",
        wasmZSTDDecoder: ktx2 + "zstddec.wasm",
    };
}

useLocalDecoders();
