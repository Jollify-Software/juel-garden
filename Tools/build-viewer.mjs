// Builds the viewer bundle: juel-garden.viewer.ts -> dist/juel-garden-viewer.js (`npm run
// build:viewer`), a global <script> bundle like `npm run build`'s, with the same esbuild options.
//
// Two packages are left out (replaced by stubs) because nothing in a viewer page can reach them,
// though modules the viewer does need import them (Tools/bundle-report.mjs shows the chains):
// - Babylon's WebGPU shaders (ShadersWGSL, ~420 KB): materials import them dynamically for a
//   WebGPU engine, and <garden-scene> only ever makes a WebGL Engine (src/Components/Scene.ts).
// - html2canvas (~200 KB): GardenMesh imports HtmlTexture for `texture="html"`, which the
//   viewer's own children never use. The stub throws if something calls it, saying which
//   bundle to load instead.
// And the glTF loader comes without the extensions a viewer has no use for: `import
// "@babylonjs/loaders/glTF"` (in MeshModel.ts) is redirected to the same loader with every glTF 2.0
// extension except KHR_interactivity, KHR_node_hoverability/selectability (Babylon's flow graph,
// ~165 KB) and MSFT_audio_emitter (~95 KB of audio), and without the glTF 1.0 loader (~30 KB).
// A model that uses one of those still loads; the extension's behaviour is skipped (it is not
// "required" in any model a viewer shows).
// The decoders (vendor/decoders) are copied beside it by `npm run copy-decoders`.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const LEFT_OUT = ["KHR_interactivity", "KHR_node_hoverability", "KHR_node_selectability", "MSFT_audio_emitter"];
const extensionsDir = resolve(root, "node_modules/@babylonjs/loaders/glTF/2.0/Extensions");
const gltfForViewer = [
    `export * from "@babylonjs/loaders/glTF/glTFFileLoader.js";`,
    `import "@babylonjs/loaders/glTF/2.0/glTFLoader.js";`, // registers itself as the glTF 2.0 loader
    ...[...readFileSync(resolve(extensionsDir, "index.js"), "utf8").matchAll(/export \* from "\.\/(\w+)\.js"/g)]
        .map(m => m[1]).filter(name => !LEFT_OUT.includes(name))
        .map(name => `import "@babylonjs/loaders/glTF/2.0/Extensions/${name}.js";`),
].join("\n");

const stubs = {
    name: "viewer-stubs",
    setup(b) {
        b.onResolve({ filter: /\/ShadersWGSL\// }, a => ({ path: a.path, namespace: "viewer-stub-empty" }));
        b.onResolve({ filter: /^html2canvas$/ }, a => ({ path: a.path, namespace: "viewer-stub-html2canvas" }));
        b.onResolve({ filter: /^@babylonjs\/loaders\/glTF$/ }, a => ({ path: a.path, namespace: "viewer-gltf" }));
        b.onLoad({ filter: /.*/, namespace: "viewer-gltf" }, () => ({ contents: gltfForViewer, loader: "js", resolveDir: root }));
        b.onLoad({ filter: /.*/, namespace: "viewer-stub-empty" }, () => ({ contents: "export {};", loader: "js" }));
        b.onLoad({ filter: /.*/, namespace: "viewer-stub-html2canvas" }, () => ({ loader: "js",
            contents: `export default function () { throw new Error('texture="html" is not in juel-garden-viewer.js: load juel-garden.js'); }` }));
    },
};

const result = await build({
    absWorkingDir: root, entryPoints: ["juel-garden.viewer.ts"], outfile: "dist/juel-garden-viewer.js",
    bundle: true, minify: true, format: "iife", globalName: "JuelGarden", platform: "browser",
    target: "es2020", logLevel: "warning", plugins: [stubs], write: true, metafile: true,
});
if (process.env.VIEWER_METAFILE) (await import("node:fs")).writeFileSync(process.env.VIEWER_METAFILE, JSON.stringify(result.metafile));
const out = Object.entries(result.metafile.outputs).find(([p]) => p.endsWith(".js"));
const js = readFileSync(resolve(root, out[0]));
console.log(`dist/juel-garden-viewer.js: ${(js.length / 1024).toFixed(0)} KB, ${(gzipSync(js).length / 1024).toFixed(0)} KB gzipped`);
