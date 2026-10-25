// Browser test of <garden-post-process>: a fragment shader over the main camera's picture, its
// uniforms from `uniform-<name>` (live) and setUniform(), screenSize filled in, `ratio`, `disabled`
// (out of the chain and back in its place), a HUD camera left alone, and removal. Pixels are read
// back. Run after a build: npm run test:post-process.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-sky colour="#000000"></garden-sky>
  <garden-camera id="main" type="free" position="0 0 -10" target="0 0 0"></garden-camera>
  <garden-camera id="hud" type="free" position="0 0 -50" viewport="0 0 1 1" ortho layer-mask="0x20000000"></garden-camera>
  <garden-light type="hemi" position="0 1 0"></garden-light>
  <garden-box size="2"><garden-material colour="#000000" spec-colour="#000000" emissive-colour="#ffffff"></garden-material></garden-box>
  <garden-post-process id="tint" ratio="0.5" uniform-tint="1 0 0">
    <script type="x-shader/x-fragment">
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform vec3 tint;
      uniform vec2 screenSize;
      void main() { gl_FragColor = vec4(texture2D(textureSampler, vUV).rgb * tint, 1.0); }
    </script>
  </garden-post-process>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("tint").postProcesses.length == 1, null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector("garden-scene").scene.isReady());
    await frames(10);
    const pixel = (fx, fy) => page.evaluate(([fx, fy]) => new Promise(resolve => {
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        scene.onAfterRenderObservable.addOnce(() => {
            const gl = engine._gl, out = new Uint8Array(4);
            gl.readPixels(Math.floor(engine.getRenderWidth() * fx), Math.floor(engine.getRenderHeight() * (1 - fy)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
            resolve(Array.from(out));
        });
    }), [fx, fy]);
    const near = (p, rgb) => rgb.every((c, i) => Math.abs(p[i] - c) < 12);

    const info = await page.evaluate(() => {
        const el = document.getElementById("tint"), pp = el.postProcesses[0];
        const main = document.getElementById("main").camera, hud = document.getElementById("hud").camera;
        const engine = pp.getEngine();
        return { onMain: pp.getCamera() == main, hudChain: hud._postProcesses.filter(Boolean).length,
                 size: [pp.width, pp.height], canvas: [engine.getRenderWidth(), engine.getRenderHeight()],
                 uniforms: el.uniforms.map(u => u.name).sort() };
    });
    check("on the main camera by default, not the HUD", info.onMain && info.hudChain == 0, JSON.stringify(info));
    check("ratio=\"0.5\": half the canvas's size", Math.abs(info.size[0] - info.canvas[0] / 2) <= 1 && Math.abs(info.size[1] - info.canvas[1] / 2) <= 1, JSON.stringify(info));
    check("its uniforms are read from the source", JSON.stringify(info.uniforms) == '["screenSize","textureSampler","tint"]', JSON.stringify(info.uniforms));

    let p = await pixel(0.5, 0.5);
    check("it draws: the white box tinted red", near(p, [255, 0, 0]), JSON.stringify(p));

    await page.evaluate(() => { window.__pp = document.getElementById("tint").postProcesses[0]; document.getElementById("tint").setAttribute("uniform-tint", "#00ff00"); });
    await frames(3);
    p = await pixel(0.5, 0.5);
    const same = await page.evaluate(() => document.getElementById("tint").postProcesses[0] == window.__pp);
    check("a uniform- attribute changes at once (a #hex colour), without a rebuild", same && near(p, [0, 255, 0]), JSON.stringify(p));

    await page.evaluate(() => document.getElementById("tint").setUniform("tint", [0, 0, 1]));
    await frames(3);
    p = await pixel(0.5, 0.5);
    check("setUniform() from a game", near(p, [0, 0, 255]), JSON.stringify(p));

    await page.evaluate(() => document.getElementById("tint").setAttribute("disabled", ""));
    await frames(3);
    p = await pixel(0.5, 0.5);
    const off = await page.evaluate(() => document.getElementById("main").camera._postProcesses.filter(Boolean).length);
    check("disabled takes it out of the chain (white again)", off == 0 && near(p, [255, 255, 255]), JSON.stringify({ off, p }));
    await page.evaluate(() => document.getElementById("tint").removeAttribute("disabled"));
    await frames(3);
    p = await pixel(0.5, 0.5);
    check("...and back without it, the same post-process", near(p, [0, 0, 255]) && await page.evaluate(() => document.getElementById("tint").postProcesses[0] == window.__pp), JSON.stringify(p));

    await page.evaluate(() => document.getElementById("tint").remove());
    await frames(3);
    p = await pixel(0.5, 0.5);
    const left = await page.evaluate(() => document.getElementById("main").camera._postProcesses.filter(Boolean).length);
    check("removed, it's gone", left == 0 && near(p, [255, 255, 255]), JSON.stringify({ left, p }));
});
