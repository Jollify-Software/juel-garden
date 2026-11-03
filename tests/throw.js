// Browser test of grab-and-throw: a grabbed physics body is carried (animated, steered
// by velocity) and let go flies on at the speed it was dragged (grab-throw scales it);
// <garden-launcher> throws a copy of its <template> along the pointer's ray on a tap
// (speed, offset, max, garden-launch, fire(), clear()); <garden-webxr physics-controllers>
// is harmless where there's no WebXR. Run after a build: npm run test:throw.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics gravity="0 -9.81 0"></garden-physics>
  <garden-camera type="free" position="0 2 -8" target="0 1 0"></garden-camera>
  <garden-light></garden-light>
  <garden-webxr physics-controllers="0.1" physics-headset></garden-webxr>
  <garden-ground id="floor" width="60" height="60" physics="static"></garden-ground>
  <garden-box id="crate" size="1" position="0 0.5 0" physics mass="1" grab></garden-box>
  <garden-box id="dead" size="1" position="-3 0.5 0" physics mass="1" grab grab-throw="0"></garden-box>
  <garden-launcher id="gun" speed="30" offset="0.5" max="2">
    <template><garden-sphere class="shot" diameter="0.2" physics mass="0.1"></garden-sphere></template>
  </garden-launcher>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("crate").physicsAggregate && document.getElementById("dead").physicsAggregate);
    await frames(20);

    const screen = (x, y, z) => page.evaluate(([x, y, z]) => {
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        const p = BABYLON.Vector3.Project(new BABYLON.Vector3(x, y, z), BABYLON.Matrix.Identity(), scene.getTransformMatrix(),
            scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
        const r = engine.getRenderingCanvas().getBoundingClientRect(), k = r.width / engine.getRenderWidth();
        return { x: r.left + p.x * k, y: r.top + p.y * k };
    }, [x, y, z]);

    const drag = async (id, at) => {
        await page.evaluate(id => {
            window.__release = null;
            document.getElementById(id).addEventListener("garden-release", e => __release = e.detail.velocity.asArray(), { once: true });
        }, id);
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await frames(2);
        const held = await page.evaluate(id => {
            const b = document.getElementById(id).physicsAggregate.body;
            return { motion: b.getMotionType(), grabbing: document.getElementById(id).grabbing };
        }, id);
        for (let i = 1; i <= 8; i++) { await page.mouse.move(at.x + i * 15, at.y - i * 6); await frames(1); }
        await page.mouse.up();
        await frames(1);
        const after = await page.evaluate(id => {
            const el = document.getElementById(id), b = el.physicsAggregate.body;
            return { motion: b.getMotionType(), prestep: b.disablePreStep, v: b.getLinearVelocity().asArray(), release: __release };
        }, id);
        return { held, after };
    };

    // Motion types: 0 static, 1 animated, 2 dynamic.
    const c = await drag("crate", await screen(0, 0.5, 0));
    check("held: carried as an animated body", c.held.motion == 1 && c.held.grabbing, JSON.stringify(c.held));
    check("let go: dynamic again, the simulation's", c.after.motion == 2 && c.after.prestep === true, JSON.stringify(c.after));
    // Dragged right (-x seen from -z... the camera looks along +z, so screen right is +x) and up.
    check("let go: it flies on the way it was dragged (garden-release says how fast)",
        c.after.release && c.after.release[0] > 0.5 && c.after.v[0] > 0.5, JSON.stringify(c.after));
    const d = await drag("dead", await screen(-3, 0.5, 0));
    check("grab-throw=\"0\" drops it dead", d.after.release && Math.hypot(...d.after.release) == 0 && d.after.motion == 2, JSON.stringify(d.after));

    // The launcher: a tap throws a copy along the pointer's ray.
    await page.evaluate(() => { window.__launched = []; document.addEventListener("garden-launch", e => __launched.push(e.detail.element)); });
    const sky = await screen(0, 6, 10);
    await page.mouse.click(sky.x, sky.y);
    await frames(10);
    const shot = await page.evaluate(() => {
        const s = document.querySelectorAll(".shot");
        const el = s[0], v = el?.physicsAggregate?.body.getLinearVelocity();
        const cam = document.querySelector("garden-scene").scene.activeCamera.position;
        const p = el?.mesh?.position;
        return { count: s.length, events: __launched.length, speed: v && +v.length().toFixed(1), vy: v && v.y,
            fromCamera: p && +BABYLON.Vector3.Distance(cam, p).toFixed(1), parent: el?.parentElement?.localName, z: p && p.z };
    });
    check("a tap throws a copy of the template (garden-launch)", shot.count == 1 && shot.events == 1 && shot.parent == "garden-scene", JSON.stringify(shot));
    check("at speed, up and along the pointer's ray", shot.speed > 25 && shot.vy > 0 && shot.z > -8, JSON.stringify(shot));
    const more = await page.evaluate(() => {
        const gun = document.getElementById("gun");
        gun.fire(new BABYLON.Vector3(0, 1, -5), new BABYLON.Vector3(0, 0, 1));
        gun.fire(new BABYLON.Vector3(1, 1, -5), new BABYLON.Vector3(0, 0, 1));
        const kept = document.querySelectorAll(".shot").length;
        gun.clear();
        return { kept, launched: gun.launched.length, after: document.querySelectorAll(".shot").length };
    });
    check("max keeps the newest; clear() removes them", more.kept == 2 && more.launched == 0 && more.after == 0, JSON.stringify(more));

    const xr = await page.evaluate(() => ({ controllers: document.querySelector("garden-webxr").physicsControllers ?? null }));
    check("physics-controllers without WebXR: nothing, quietly", xr.controllers == null, JSON.stringify(xr));
});
