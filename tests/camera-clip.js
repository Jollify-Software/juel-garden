// Browser test of `near` and `far` on <garden-camera>: the clip planes (minZ/maxZ) for any
// camera type, set when the camera is built and changed in place afterwards. An arc camera
// 1 m from a 0.6 m box draws all of it with near="0.01"; the control, without `near`, keeps
// Babylon's 1 m near plane and clips the box's front half away. Run after a build.
const { run } = require("./harness");

const scene = camera => `<garden-scene>
    ${camera}
    <garden-light type="hemispheric"></garden-light>
    <garden-box id="box" width="0.6" height="0.6" depth="0.6" colour="#ff0000"></garden-box>
</garden-scene>`;

run(scene(`<garden-camera id="cam" type="arc" alpha="0.6" beta="1.1" radius="1" target="0 0 0" near="0.01"></garden-camera>`),
async ({ page, check, frames, open }) => {
    // The box's pixels on the canvas: red under the hemispheric light (the background is Babylon's blue-grey).
    const boxPixels = () => page.evaluate(async () => {
        const s = document.querySelector("garden-scene").scene, engine = s.getEngine();
        await s.whenReadyAsync();
        s.render();
        const w = engine.getRenderWidth(), h = engine.getRenderHeight(), px = await engine.readPixels(0, 0, w, h);
        let n = 0;
        for (let i = 0; i < px.length; i += 4)
            if (px[i] > 120 && px[i + 1] < 80 && px[i + 2] < 80) n++; // the box (the clear colour is 51, 51, 76)
        return n;
    });
    const clip = () => page.evaluate(() => { const c = document.getElementById("cam").camera; return { minZ: c.minZ, maxZ: c.maxZ }; });

    await frames(10);
    let planes = await clip();
    check("near sets the camera's minZ", planes.minZ == 0.01 && planes.maxZ == 10000, JSON.stringify(planes));
    const whole = await boxPixels();

    // A change applies in place: the same camera, the same view.
    const live = await page.evaluate(async () => {
        const el = document.getElementById("cam"), camera = el.camera;
        el.camera.alpha = 1.2;
        el.setAttribute("near", "0.05");
        await new Promise(r => setTimeout(r, 50));
        const changed = { same: el.camera === camera, minZ: el.camera.minZ, alpha: el.camera.alpha };
        el.setAttribute("far", "0.5");
        await new Promise(r => setTimeout(r, 50));
        return { ...changed, maxZ: el.camera.maxZ };
    });
    check("a near change applies to the same camera, keeping its view", live.same && live.minZ == 0.05 && live.alpha == 1.2, JSON.stringify(live));
    check("far sets maxZ", live.maxZ == 0.5, JSON.stringify(live));
    await frames(2);
    const beyond = await boxPixels();
    check("a far plane nearer than the box draws none of it", beyond == 0, `${beyond} box pixels`);
    const removed = await page.evaluate(async () => {
        const el = document.getElementById("cam");
        el.removeAttribute("near"); el.removeAttribute("far");
        await new Promise(r => setTimeout(r, 50));
        return { minZ: el.camera.minZ, maxZ: el.camera.maxZ };
    });
    check("removing near and far puts Babylon's defaults back", removed.minZ == 1 && removed.maxZ == 10000, JSON.stringify(removed));

    // Any camera type: a free camera takes them too.
    await open(scene(`<garden-camera id="cam" type="free" position="0 0 -1" near="0.02" far="50"></garden-camera>`));
    planes = await clip();
    check("a free camera takes near and far", planes.minZ == 0.02 && planes.maxZ == 50, JSON.stringify(planes));

    // Control: no near, the default 1 m plane clips the box's front half.
    await open(scene(`<garden-camera id="cam" type="arc" alpha="0.6" beta="1.1" radius="1" target="0 0 0"></garden-camera>`));
    await frames(10);
    planes = await clip();
    check("control: without near, minZ stays Babylon's 1", planes.minZ == 1 && planes.maxZ == 10000, JSON.stringify(planes));
    const clipped = await boxPixels();
    check("the box is drawn whole with near, and clipped without", whole > 1.5 * clipped && whole > 1000, `with near ${whole}, without ${clipped} box pixels`);
});
