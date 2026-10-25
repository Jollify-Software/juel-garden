// Browser test of upscaling for phones: <garden-pipeline fsr> (AMD's FSR 1: the scene drawn
// smaller into the EASU upscale, then the RCAS sharpen, first in the camera's chain, ahead of the
// pipeline's own effects), its presets and live changes, and <garden-scene scaling> (Babylon's
// hardware scaling level). Run after a build: npm run test:fsr.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-sky colour="#000000"></garden-sky>
  <garden-camera id="main" type="arc" alpha="-1.5708" beta="1.5708" radius="6"></garden-camera>
  <garden-plane size="5"><garden-material colour="#000000" spec-colour="#000000" emissive-colour="#ffffff"></garden-material></garden-plane>
  <garden-pipeline id="finish" fsr="performance" fxaa></garden-pipeline>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("finish").pipeline, null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector("garden-scene").scene.isReady());
    await frames(10);
    const read = () => page.evaluate(() => {
        const el = document.getElementById("finish"), camera = document.getElementById("main").camera;
        const engine = camera.getEngine(), chain = camera._postProcesses.filter(Boolean);
        return { fsr: el.fsr.length, names: chain.map(pp => pp.name), first: chain[0] == el.fsr[0],
                 upscale: el.fsr[0] ? [el.fsr[0].width, el.fsr[0].height] : null, samples: el.fsr[0]?.samples,
                 canvas: [engine.getRenderWidth(), engine.getRenderHeight()], scaling: engine.getHardwareScalingLevel(),
                 ready: el.fsr.every(pp => pp.isReady()) };
    });
    const pixel = (fx, fy) => page.evaluate(([fx, fy]) => new Promise(resolve => {
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        scene.onAfterRenderObservable.addOnce(() => {
            const gl = engine._gl, out = new Uint8Array(4);
            gl.readPixels(Math.floor(engine.getRenderWidth() * fx), Math.floor(engine.getRenderHeight() * (1 - fy)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
            resolve(Array.from(out));
        });
    }), [fx, fy]);

    let r = await read();
    check("fsr: the upscale and the sharpen, first in the camera's chain (before FXAA)",
        r.fsr == 2 && r.first && r.names[0] == "fsr1Upscale" && r.names[1] == "fsr1Sharpen" && r.names.length >= 3, JSON.stringify(r.names));
    check("fsr=\"performance\": the scene is drawn at half size", Math.abs(r.upscale[0] - r.canvas[0] / 2) <= 1 && Math.abs(r.upscale[1] - r.canvas[1] / 2) <= 1, JSON.stringify(r));
    check("anti-aliasing samples on the small picture (default 4); the shaders compile", r.samples == 4 && r.ready, JSON.stringify(r));
    let p = await pixel(0.5, 0.5), edge = await pixel(0.02, 0.5);
    check("it draws: the white plane in the middle, black round it", p[0] > 240 && p[1] > 240 && edge[0] < 15, JSON.stringify({ p, edge }));

    await page.evaluate(() => document.getElementById("finish").setAttribute("fsr", "1.5"));
    await page.waitForFunction(() => { const el = document.getElementById("finish"); return el.fsr.length == 2 && Math.abs(el.fsr[0].width - el.fsr[0].getEngine().getRenderWidth() / 1.5) <= 1; });
    await frames(3);
    r = await read();
    check("a new scale rebuilds it, still first", r.first && r.names[0] == "fsr1Upscale", JSON.stringify(r));

    await page.evaluate(() => { window.__up = document.getElementById("finish").fsr[0]; document.getElementById("finish").setAttribute("fsr-sharpness", "1"); });
    await frames(2);
    r = await read();
    check("fsr-sharpness changes in place", r.fsr == 2 && r.first && await page.evaluate(() => document.getElementById("finish").fsr[0] == window.__up), JSON.stringify(r));

    await page.evaluate(() => document.getElementById("finish").removeAttribute("fsr"));
    await page.waitForFunction(() => document.getElementById("finish").fsr.length == 0);
    await frames(3);
    r = await read();
    p = await pixel(0.5, 0.5);
    check("fsr removed: full size, the pipeline's FXAA still on", r.names.length >= 1 && !r.names.includes("fsr1Upscale") && p[0] > 240, JSON.stringify({ names: r.names, p }));

    await page.evaluate(() => document.querySelector("garden-scene").setAttribute("scaling", "2"));
    await frames(3);
    r = await read();
    check("<garden-scene scaling=\"2\">: drawn at half the canvas's size", r.scaling == 2 && r.canvas[0] == 500, JSON.stringify(r));
    await page.evaluate(() => document.querySelector("garden-scene").removeAttribute("scaling"));
    await frames(3);
    r = await read();
    check("...and back to full size", r.scaling == 1 && r.canvas[0] == 1000, JSON.stringify(r));
});
