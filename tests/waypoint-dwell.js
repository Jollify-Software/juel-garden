// Browser test of look-and-hold on <garden-waypoint> (Jollify VR presentations, ClassVR
// headsets without controllers): looking at any stop in view fills the reticle and, after
// `dwell` ms, flies there; looking at the sky does nothing (the control); the next stop in
// order has a ring round it; next()/previous() fly along the order and fire
// waypoint-changed. Run after a build: node tests/waypoint-dwell.js.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera position="0 1.6 -8">
    <garden-waypoint waypoints="#a #b #c" offset="0 1.6 0" speed="4" dwell="600"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-ground width="80" height="80"></garden-ground>
  <garden-cylinder id="a" height="0.2" diameter="1.5" position="0 0.1 -8"></garden-cylinder>
  <garden-cylinder id="b" height="0.2" diameter="1.5" position="8 0.1 4"></garden-cylinder>
  <garden-cylinder id="c" height="0.2" diameter="1.5" position="-8 0.1 4"></garden-cylinder>
</garden-scene>`, async ({ page, check, errors }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 20, null, { timeout: 30000 });
    const state = () => page.evaluate(() => {
        const w = document.querySelector("garden-waypoint"), s = document.querySelector("garden-scene").scene;
        const ring = s.getMeshByName("waypoint-next");
        return { index: w.index, progress: w.dwellProgress, ring: ring && ring.isEnabled() ? [ring.position.x, ring.position.z].map(Math.round) : null };
    });
    const lookAt = (id, up = 0) => page.evaluate(([id, up]) => {
        const cam = document.querySelector("garden-scene").scene.activeCamera;
        const p = document.getElementById(id).mesh.getAbsolutePosition().clone();
        p.y += up;
        cam.setTarget(p);
    }, [id, up]);
    const events = [];
    await page.exposeFunction("onWaypoint", i => events.push(i));
    await page.evaluate(() => document.querySelector("garden-waypoint").addEventListener("waypoint-changed", e => window.onWaypoint(e.detail.index)));

    let s = await state();
    check("starts at the first stop", s.index === 0, JSON.stringify(s));
    check("the next stop (b) has the ring", JSON.stringify(s.ring) === JSON.stringify([8, 4]), JSON.stringify(s.ring));

    // Control: looking at the sky above a stop for longer than `dwell` does nothing.
    await lookAt("c", 40);
    await page.waitForTimeout(1200);
    s = await state();
    check("control: looking at the sky doesn't move you", s.index === 0 && s.progress === 0, JSON.stringify(s));

    // Look at c (not the next one: any stop in view): the reticle fills, then you fly there.
    await lookAt("c");
    await page.waitForTimeout(250);
    const mid = await state();
    check("looking at a stop fills the reticle part way", mid.progress > 0.1 && mid.progress < 1 && mid.index === 0, JSON.stringify(mid));
    await page.waitForFunction(() => document.querySelector("garden-waypoint").index === 2, null, { timeout: 4000 }).catch(() => {});
    s = await state();
    check("…and after `dwell` you go there (c)", s.index === 2, JSON.stringify(s));
    check("the ring moves to the next stop (after the last, the first: a)", JSON.stringify(s.ring) === JSON.stringify([0, -8]), JSON.stringify(s.ring));
    await page.waitForTimeout(2000);
    const camAt = await page.evaluate(() => { const c = document.querySelector("garden-scene").scene.activeCamera.position; return [c.x, c.z].map(Math.round); });
    check("the camera flew to c", JSON.stringify(camAt) === JSON.stringify([-8, 4]), JSON.stringify(camAt));

    // Look straight at nothing (the sky) so the dwell doesn't fire again, then step.
    await page.evaluate(() => document.querySelector("garden-waypoint").dwell = 0);
    await page.evaluate(() => document.querySelector("garden-waypoint").previous());
    check("previous() goes back along the order (b)", (await state()).index === 1);
    await page.evaluate(() => document.querySelector("garden-waypoint").next());
    check("next() goes on (c)", (await state()).index === 2);
    check("waypoint-changed fired for each move", JSON.stringify(events) === JSON.stringify([2, 1, 2]), JSON.stringify(events));
    // Contrast (ClassVR: white platforms): the white ring and disc each have a dark edge behind
    // them, on the camera, so the reticle reads on a white surface as well as on the sky.
    const edges = await page.evaluate(() => {
        const s = document.querySelector("garden-scene").scene;
        return ["waypoint-reticle-outline", "waypoint-reticle-edge"].map(n => {
            const m = s.getMeshByName(n), c = m?.material?.emissiveColor;
            let p = m; while (p && p !== s.activeCamera) p = p.parent;
            return m ? { onCamera: p === s.activeCamera, dark: c.r + c.g + c.b < 0.6, pickable: m.isPickable } : null;
        });
    });
    check("the reticle's ring and disc have dark edges on the camera", edges.every(e => e && e.onCamera && e.dark && !e.pickable), JSON.stringify(edges));
    if (process.env.SHOT) {
        await page.evaluate(() => { const w = document.querySelector("garden-waypoint"); w.dwell = 600; });
        await lookAt("a");
        await page.waitForTimeout(300);
        await page.screenshot({ path: process.env.SHOT });
    }
    check("no page errors", errors.length === 0, errors.join(" | "));
});
