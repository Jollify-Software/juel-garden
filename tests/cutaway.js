// Browser test of the follow camera's cutaway: `camera.show(what)` swings round to look past
// the target at something (ignoring the look controls meanwhile), `unshow()` swings back to
// exactly where it was, `unshow({ keepAngle: true })` keeps the new angle, and a function
// can be shown (something that moves). Run after a build: npm run test:cutaway.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="follow" target="#p" free-look radius="6" height-offset="3"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="80" height="80"></garden-ground>
  <garden-box id="p" width="0.6" height="1.8" depth="0.4" position="0 0.9 0"></garden-box>
  <garden-box id="thing" position="12 0.5 9"></garden-box>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 20, null, { timeout: 30000 });
    const cam = () => page.evaluate(() => {
        const c = document.querySelector("garden-camera").camera;
        return { angle: c.orbitAngle, radius: c.radius, height: c.heightOffset, showing: c.showing, x: c.position.x, z: c.position.z };
    });
    const turned = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

    const before = await cam();
    const was = await page.evaluate(() => document.querySelector("garden-camera").camera.show(document.getElementById("thing").mesh));
    check("show() returns where the camera was", Math.abs(was.angle - before.angle) < 1e-6 && was.radius == before.radius, JSON.stringify(was));
    await page.keyboard.down("e");
    await page.waitForTimeout(2500);
    await page.keyboard.up("e");
    let during = await cam();
    // From behind the target, looking towards (12, 9), 0.4 rad to the side.
    const want = Math.atan2(0 - 12, 0 - 9) + 0.4;
    check("it swings round to look past the target at it (the look keys ignored)", turned(during.angle, want) < 0.1, `${during.angle.toFixed(2)} vs ${want.toFixed(2)}`);
    check("…pulled back to fit them both", during.radius > 10 && during.radius <= 15, during.radius.toFixed(2));
    check("…and says it's showing", during.showing === true);

    await page.evaluate(() => document.querySelector("garden-camera").camera.unshow());
    const after = await cam();
    check("unshow() swings back to exactly where it was", turned(after.angle, before.angle) < 1e-3 && Math.abs(after.radius - before.radius) < 1e-3 && Math.abs(after.height - before.height) < 1e-3 && !after.showing, JSON.stringify({ before, after }));
    await page.waitForTimeout(800);
    const settled = await cam();
    check("…and follows the target again", Math.hypot(settled.x - 0, settled.z - 0) < 7.5, `${settled.x.toFixed(1)}, ${settled.z.toFixed(1)}`);

    // Something that moves, shown by a function; come back but keep the angle.
    await page.evaluate(() => {
        const c = document.querySelector("garden-camera").camera;
        const t0 = performance.now();
        c.show(() => new BABYLON.Vector3(-10, 0, 10 + (performance.now() - t0) / 1000));
    });
    await page.waitForTimeout(2500);
    const moving = await cam();
    check("a moving thing can be shown", turned(moving.angle, Math.atan2(10, -12) + 0.4) < 0.25, moving.angle.toFixed(2));
    await page.evaluate(() => document.querySelector("garden-camera").camera.unshow({ keepAngle: true }));
    const kept = await cam();
    check("unshow({ keepAngle }) keeps the angle and restores the distance", turned(kept.angle, moving.angle) < 0.15 && Math.abs(kept.radius - before.radius) < 1e-3, JSON.stringify(kept));
});
