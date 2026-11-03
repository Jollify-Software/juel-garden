// Browser test of KTX2 (Basis Universal) textures: a .ktx2 made by Tools/ktx2-encode.mjs loads
// through Babylon's KTX2 decoder from the vendored copies in dist/decoders/ktx2/ (nothing
// fetched from Babylon's CDN), as a <garden-texture src> and from code, in both encodings
// (ETC1S and UASTC); it ends up as a compressed GPU format, and the pixels read right.
// Run after a build: npm run test:ktx2.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 0 -3" target="0 0 0"></garden-camera>
  <garden-light></garden-light>
  <garden-plane id="p" width="2" height="2">
    <garden-material><garden-texture src="/tests/fixtures/gradient.ktx2"></garden-texture></garden-material>
  </garden-plane>
</garden-scene>`, async ({ page, check, frames }) => {
    const cdn = [];
    await page.route("https://cdn.babylonjs.com/**", route => { cdn.push(route.request().url()); route.abort(); });
    await page.waitForFunction(() => document.getElementById("p").mesh, null, { timeout: 30000 });
    const loaded = await page.evaluate(async () => {
        const scene = document.querySelector("garden-scene").scene;
        window.scene = scene;
        const mesh = document.getElementById("p").mesh;
        const t0 = performance.now();
        let tex;
        while (performance.now() - t0 < 15000) {
            tex = mesh.material?.diffuseTexture;
            if (tex?.isReady()) break;
            await new Promise(r => setTimeout(r, 100));
        }
        const internal = tex?._texture;
        // A transcoded texture's `format` is the GL compressed-format enum (BC7 0x8E8C, ASTC 0x93B0..,
        // ETC2 0x9274..); Babylon's own formats (RGBA 5...) are small numbers.
        return { ready: !!tex?.isReady(), size: tex?.getSize(), format: internal?.format, compressed: (internal?.format ?? 0) > 0x8000, ms: Math.round(performance.now() - t0), url: tex?.url };
    });
    check("a <garden-texture src=\"x.ktx2\"> loads and is ready", loaded.ready && loaded.size?.width == 64, JSON.stringify(loaded));
    check("it is a GPU-compressed format, not decoded to RGBA", loaded.compressed, JSON.stringify(loaded));

    // What it looks like: the gradient's red grows left to right, green top to bottom.
    await frames(5);
    const pixels = await page.evaluate(async () => {
        const mesh = scene.getMeshByName("p") || document.getElementById("p").mesh;
        mesh.material.disableLighting = true;
        mesh.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
        await new Promise(r => setTimeout(r, 300));
        const engine = scene.getEngine(), w = engine.getRenderWidth(), h = engine.getRenderHeight();
        const pix = await new Promise(r => scene.onAfterRenderObservable.addOnce(() => r(engine.readPixels(0, 0, w, h))));
        const at = (fx, fy) => { const i = (Math.floor(h * fy) * w + Math.floor(w * fx)) * 4; return [pix[i], pix[i + 1], pix[i + 2]]; };
        return { left: at(0.35, 0.5), right: at(0.65, 0.5) };
    });
    check("the pixels read right (red grows across the plane)", pixels.right[0] > pixels.left[0] + 40 && Math.abs(pixels.right[2] - 128) < 40, JSON.stringify(pixels));

    // From code, the UASTC file.
    const uastc = await page.evaluate(async () => {
        const tex = new BABYLON.Texture("/tests/fixtures/gradient-uastc.ktx2", scene);
        const t0 = performance.now();
        while (!tex.isReady() && performance.now() - t0 < 15000) await new Promise(r => setTimeout(r, 100));
        return { ready: tex.isReady(), format: tex._texture?.format, compressed: (tex._texture?.format ?? 0) > 0x8000, size: tex.getSize() };
    });
    check("a UASTC .ktx2 loads from code too", uastc.ready && uastc.compressed && uastc.size.width == 64, JSON.stringify(uastc));
    check("nothing was fetched from Babylon's CDN", cdn.length == 0, cdn.join(" "));
});
