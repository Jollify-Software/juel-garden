// Browser test of `click-play` on <garden-mesh-model> (examples/assets/hinged-box.glb, "Open" and
// "Close"): the first click opens the lid and it stays open, the next closes it, a click while one
// plays is ignored, a model without click-play doesn't move, and a tap on it doesn't walk a
// touch-move camera there. Run after a build: npm run test:click-play.
const { run } = require("./harness");

run(`<garden-scene>
    <garden-camera id="cam" type="free" touch="always" position="0 0.35 -0.9" target="0 0.12 0" near="0.01"></garden-camera>
    <garden-light type="hemispheric"></garden-light>
    <garden-ground width="20" height="20"></garden-ground>
    <garden-mesh-model id="box" src="/examples/assets/hinged-box.glb" click-play="Open, Close" loading-screen="false"></garden-mesh-model>
    <garden-mesh-model id="still" src="/examples/assets/hinged-box.glb" position="3 0 0" loading-screen="false"></garden-mesh-model>
</garden-scene>`, async ({ page, check, errors }) => {
    await page.waitForFunction(() => document.getElementById("box").animationGroups?.length == 2 && document.getElementById("still").animationGroups?.length == 2);
    await page.waitForTimeout(800);
    await page.evaluate(() => {
        const s = document.querySelector("garden-scene").scene;
        window.lidOf = id => {
            const root = document.getElementById(id).mesh;
            const lid = s.transformNodes.concat(s.meshes).find(n => n.name == "Lid" && n.isDescendantOf(root));
            return +(2 * Math.acos(Math.min(1, Math.abs(lid.rotationQuaternion.w))) * 180 / Math.PI).toFixed(1);
        };
    });
    const lid = id => page.evaluate(id => lidOf(id), id);
    const cam = () => page.evaluate(() => document.getElementById("cam").camera.position.asArray().map(n => +n.toFixed(2)));
    // The box's centre on screen.
    const at = await page.evaluate(() => {
        // Vector3 and Matrix from the objects at hand (the bundle doesn't export Babylon).
        const s = document.querySelector("garden-scene").scene, m = document.getElementById("box").mesh;
        const c = m.getHierarchyBoundingVectors(); const mid = c.min.add(c.max).scale(0.5);
        const Vector3 = mid.constructor, Matrix = s.getTransformMatrix().constructor;
        const e = s.getEngine(), v = s.activeCamera.viewport.toGlobal(e.getRenderWidth(), e.getRenderHeight());
        const p = Vector3.Project(mid, Matrix.Identity(), s.getTransformMatrix(), v);
        const r = e.getRenderingCanvas().getBoundingClientRect(), k = r.width / e.getRenderWidth();
        return { x: r.left + p.x * k, y: r.top + p.y * k };
    });
    check("it rests closed", await lid("box") < 0.5, String(await lid("box")));
    const c0 = await cam();
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(150);
    await page.mouse.click(at.x, at.y); // while Open plays: ignored
    await page.waitForTimeout(2500);
    const opened = await lid("box");
    check("a click opens the lid, and it stays open", opened > 30, String(opened));
    check("a tap on it doesn't walk the camera there", Math.hypot(...(await cam()).map((v, i) => v - c0[i])) < 0.05, JSON.stringify([c0, await cam()]));
    check("the other box (no click-play) stays shut", await lid("still") < 0.5, String(await lid("still")));
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(2500);
    check("the next click closes it", await lid("box") < 0.5, String(await lid("box")));
    check("no page errors", errors.length == 0, errors.join(" | "));
});
