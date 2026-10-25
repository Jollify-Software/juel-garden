// Browser test of a HUD drawn by a second camera: <garden-camera ortho viewport="0 0 1 1"
// layer-mask> over the main camera, seeing only the meshes on its layer, in canvas pixels (bare
// `ortho`) or in units (`ortho="350"`, kept on resize). Run after a build: npm run test:hud.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-sky colour="#000000"></garden-sky>
  <garden-camera id="main" type="free" position="0 0 -10" target="0 0 0"></garden-camera>
  <garden-camera id="hud" type="free" position="0 0 -50" viewport="0 0 1 1" ortho layer-mask="0x20000000"></garden-camera>
  <garden-light type="hemi" position="0 1 0"></garden-light>
  <!-- In the world: a red box, which the HUD doesn't see. -->
  <garden-box size="2"><garden-material colour="#000000" spec-colour="#000000" emissive-colour="#ff0000"></garden-material></garden-box>
  <!-- On the HUD: a green bar 100 px wide and 10 px tall, 200 px left of the centre. -->
  <garden-box id="bar" width="100" height="10" depth="1" position="-200 0 0" layer-mask="0x20000000"><garden-material colour="#000000" spec-colour="#000000" emissive-colour="#00ff00"></garden-material></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("hud").camera && document.getElementById("bar").mesh);
    await page.waitForFunction(() => document.querySelector("garden-scene").scene.isReady());
    await frames(10);
    // The canvas pixel at (px, py) from the top-left, read straight after a frame.
    const pixel = (px, py) => page.evaluate(([px, py]) => new Promise(resolve => {
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        scene.onAfterRenderObservable.addOnce(() => {
            const gl = engine._gl, out = new Uint8Array(4);
            gl.readPixels(Math.floor(px), Math.floor(engine.getRenderHeight() - py), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
            resolve(Array.from(out));
        });
    }), [px, py]);
    const s = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene, hud = document.getElementById("hud").camera;
        return { ortho: hud.mode == BABYLON.Camera.ORTHOGRAPHIC_CAMERA, active: scene.activeCameras.length,
                 pointers: scene.cameraToUseForPointers == document.getElementById("main").camera };
    });
    check("ortho: an orthographic camera, drawn over the main one; pointers stay with the main one", s.ortho && s.active == 2 && s.pointers, JSON.stringify(s));
    // The canvas is 1000 x 700: its centre is (500, 350).
    let world = await pixel(500, 350), bar = await pixel(300, 350), barEnd = await pixel(253, 350), outside = await pixel(245, 350), above = await pixel(300, 343);
    check("the main camera's world shows through (red in the middle)", world[0] > 240 && world[1] < 15, JSON.stringify(world));
    check("bare ortho is in canvas pixels: the 100 px bar spans x 250..350 and is 10 px tall",
        bar[1] > 240 && barEnd[1] > 240 && outside[1] < 15 && above[1] < 15, JSON.stringify({ bar, barEnd, outside, above }));

    await page.evaluate(() => document.getElementById("hud").setAttribute("ortho", "350"));
    await page.waitForFunction(() => document.getElementById("hud").camera?.orthoTop == 350);
    await frames(5);
    const units = await page.evaluate(() => { const c = document.getElementById("hud").camera; return [c.orthoLeft, c.orthoRight, c.orthoTop, c.orthoBottom]; });
    check("ortho=\"350\": 350 units above and below, as many across as the canvas's shape (1000 x 700)",
        JSON.stringify(units.map(Math.round)) == "[-500,500,350,-350]", JSON.stringify(units));
    await page.setViewportSize({ width: 1400, height: 700 });
    await frames(5);
    const wide = await page.evaluate(() => { const c = document.getElementById("hud").camera; return [c.orthoLeft, c.orthoRight]; });
    check("...kept on resize", Math.round(wide[1]) == 700, JSON.stringify(wide));
    world = await pixel(700, 350);
    check("the HUD camera clears no colour: the world still shows", world[0] > 240, JSON.stringify(world));
});
