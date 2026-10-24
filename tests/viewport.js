// Browser test of extra cameras: a <garden-camera viewport> is drawn over the main camera
// (both in scene.activeCameras, pointers on the main one) and takes no input unless it has
// `controls`; layer-mask on cameras and meshes; a free camera's rotation in degrees; meshes in
// a <garden-camera parent> ride with it; removing the inset goes back to one camera.
// Run after a build: npm run test:viewport.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera id="main" type="free" position="0 2 -10" layer-mask="0x30000000" parent>
    <garden-box id="head" size="0.5" layer-mask="0x10000000" colour="#ff0000"></garden-box>
  </garden-camera>
  <garden-camera id="overhead" type="free" position="0 30 -10" rotation="90 0 0" viewport="0.75 0.75 0.25 0.25" layer-mask="0x10000000"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="40" height="40" layer-mask="0x10000000"></garden-ground>
  <garden-box id="roof" size="2" position="0 10 -10" layer-mask="0x20000000" colour="#0000ff"></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("overhead").camera && document.getElementById("head").mesh);
    await frames(5);
    const s = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        const main = document.getElementById("main").camera, over = document.getElementById("overhead").camera;
        const sees = (cam, id) => (cam.layerMask & document.getElementById(id).mesh.layerMask) != 0;
        return {
            active: scene.activeCameras.map(c => c == main ? "main" : c == over ? "overhead" : "?"),
            pointers: scene.cameraToUseForPointers == main,
            viewport: [over.viewport.x, over.viewport.y, over.viewport.width, over.viewport.height],
            mainInputs: Object.keys(main.inputs.attached).length > 0 && !!main.inputs.attachedToElement,
            overInputs: !!over.inputs.attachedToElement,
            down: over.getForwardRay(1).direction.asArray().map(n => +n.toFixed(2)),
            overSeesRoof: sees(over, "roof"), mainSeesRoof: sees(main, "roof"), overSeesHead: sees(over, "head"),
            headParent: document.getElementById("head").mesh.parent == main,
        };
    });
    check("a viewport camera is drawn over the main one", JSON.stringify(s.active) == '["main","overhead"]', JSON.stringify(s.active));
    check("pointer picking stays with the main camera", s.pointers);
    check("viewport is x y width height", JSON.stringify(s.viewport) == "[0.75,0.75,0.25,0.25]", JSON.stringify(s.viewport));
    check("the main camera takes input, the viewport one doesn't", s.mainInputs && !s.overInputs, JSON.stringify(s));
    check("rotation=\"90 0 0\" looks straight down", JSON.stringify(s.down) == "[0,-1,0]", JSON.stringify(s.down));
    check("layer-mask: the overhead camera doesn't see the roof, the main one does; both see the head's layer",
        !s.overSeesRoof && s.mainSeesRoof && s.overSeesHead, JSON.stringify(s));
    check("a mesh in <garden-camera parent> rides with it", s.headParent);

    await page.evaluate(() => document.getElementById("main").setAttribute("position", "5 2 -10"));
    await frames(2);
    const head = await page.evaluate(() => document.getElementById("head").mesh.getAbsolutePosition().x);
    check("...and moves with it", Math.abs(head - 5) < 0.01, String(head));

    await page.evaluate(() => document.getElementById("overhead").remove());
    await frames(3);
    const after = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        return { n: scene.activeCameras.length, main: scene.activeCamera == document.getElementById("main").camera };
    });
    check("removing the inset goes back to the one camera", after.n == 0 && after.main, JSON.stringify(after));
});
