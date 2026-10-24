// Browser test of the `grab` behaviour: a six-DoF drag (and, with grab="scale", a
// two-pointer pinch), grab-box's bounding-box gizmo, and garden-grab/garden-release as
// a pointer drags the box across the screen. Run after a build: npm run test:grab.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="free" position="0 2 -6" target="0 1 0"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="crate" position="0 1 0" grab="scale" grab-box="#ff8800"></garden-box>
  <garden-box id="plain" position="3 1 0"></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("crate").mesh);
    await frames(10);
    const b = await page.evaluate(() => {
        const names = id => document.getElementById(id).mesh.behaviors.map(x => x.name);
        const box = document.getElementById("crate").grabBox;
        return { crate: names("crate"), plain: names("plain"), box: box?.attachedMesh?.element?.id, colour: box?._coloredMaterial?.emissiveColor?.toHexString() };
    });
    check("grab adds a six-DoF drag, grab=\"scale\" a pinch", b.crate.includes("SixDofDrag") && b.crate.includes("MultiPointerScale"), JSON.stringify(b.crate));
    check("without grab, nothing", b.plain.length == 0, JSON.stringify(b.plain));
    check("grab-box puts a bounding box (in its colour) on it", b.box == "crate" && b.colour == "#FF8800", JSON.stringify(b));

    // Press on the box's middle, move right, let go.
    const at = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        const p = BABYLON.Vector3.Project(new BABYLON.Vector3(0, 1, 0), BABYLON.Matrix.Identity(), scene.getTransformMatrix(),
            scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
        const r = scene.getEngine().getRenderingCanvas().getBoundingClientRect();
        const k = r.width / engine.getRenderWidth();
        window.__events = [];
        const el = document.getElementById("crate");
        el.addEventListener("garden-grab", () => __events.push("grab"));
        el.addEventListener("garden-release", () => __events.push("release"));
        return [r.left + p.x * k, r.top + p.y * k];
    });
    await page.mouse.move(at[0], at[1]);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(at[0] + i * 12, at[1]); await frames(2); }
    const held = await page.evaluate(() => document.getElementById("crate").grabbing);
    await page.mouse.up();
    await frames(30);
    const end = await page.evaluate(() => ({ x: +document.getElementById("crate").mesh.position.x.toFixed(2), events: __events }));
    check("dragging moves it right", end.x > 0.3, String(end.x));
    check("garden-grab, then garden-release; grabbing while held", held === true && end.events.join() == "grab,release", JSON.stringify({ held, ...end }));
});
