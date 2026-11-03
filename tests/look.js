// Browser test of the follow camera's look controls (with `free-look`): Q/E and the
// look thumb pad turn the view while the walker turns independently (it can turn right
// round without the camera following), and a script can set `orbitAngle`.
// Run after a build: npm run test:look.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="follow" target="#p" free-look look-pad="always" radius="6" height-offset="3"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="60" height="60"></garden-ground>
  <garden-box id="p" width="0.6" height="1.8" depth="0.4" position="0 0.9 0" walk walk-joystick="always"></garden-box>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 20, null, { timeout: 30000 });
    const angle = () => page.evaluate(() => document.querySelector("garden-camera").camera.orbitAngle);
    const yaw = () => page.evaluate(() => document.getElementById("p").mesh.rotation.y);
    const hold = async (key, ms) => {
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
        await page.waitForTimeout(300);
    };

    let a0 = await angle();
    await hold("e", 600);
    let a1 = await angle();
    check("E turns the view right", a1 - a0 > 0.8, `${a0.toFixed(2)} -> ${a1.toFixed(2)}`);
    await hold("q", 600);
    let a2 = await angle();
    check("Q turns it back", a1 - a2 > 0.8, `${a1.toFixed(2)} -> ${a2.toFixed(2)}`);

    // Walk towards the camera: the walker turns right round, the camera stays put.
    const y0 = await yaw();
    await hold("s", 1200);
    const y1 = await yaw();
    const turned = Math.abs(Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)));
    check("the walker turns round (S walks towards the camera)", turned > 2.8, `${(turned * 180 / Math.PI).toFixed(0)}°`);
    check("…and the camera doesn't follow", Math.abs((await angle()) - a2) < 0.01);

    // The look pad, bottom right: drag right.
    const pad = await page.locator(".garden-look-pad").boundingBox();
    check("look-pad=\"always\" shows a second thumb pad", !!pad);
    const walkPad = await page.locator(".garden-walk-joystick").boundingBox();
    check("…on the right, the walk pad on the left", pad && walkPad && pad.x > walkPad.x + 300);
    const b0 = await angle();
    await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2);
    await page.mouse.down();
    await page.mouse.move(pad.x + pad.width - 4, pad.y + pad.height / 2, { steps: 4 });
    await page.waitForTimeout(600);
    await page.mouse.up();
    check("dragging the look pad right turns the view", (await angle()) - b0 > 0.6);

    // A script sets the angle: the camera swings to the target's +Z side.
    await page.evaluate(() => document.querySelector("garden-camera").camera.orbitAngle = 0);
    await page.waitForTimeout(1500);
    const side = await page.evaluate(() => {
        const c = document.querySelector("garden-scene").scene.activeCamera, m = document.getElementById("p").mesh;
        return c.position.z - m.position.z;
    });
    check("setting orbitAngle = 0 puts the camera on the +Z side", side > 4, side.toFixed(2));

    // A change rebuilds the camera, and removal disposes it: either way its look pad, frame
    // observer and listeners go with it (they used to stay: two pads after a change).
    const hooks = () => page.evaluate(() => ({ pads: document.querySelectorAll(".garden-look-pad").length,
        frame: document.querySelector("garden-scene").scene.onBeforeRenderObservable.observers.length }));
    const before = await hooks();
    await page.evaluate(() => document.querySelector("garden-camera").setAttribute("radius", "7"));
    await page.waitForTimeout(800);
    const changed = await hooks();
    check("a change rebuilds it with one look pad and no extra frame observer", changed.pads == 1 && changed.frame == before.frame, JSON.stringify({ before, changed }));
    await page.evaluate(() => {
        const arc = document.createElement("garden-camera");
        arc.setAttribute("type", "arc");
        const follow = document.querySelector("garden-camera");
        follow.after(arc);
        follow.remove();
    });
    await page.waitForTimeout(800);
    const gone = await hooks();
    check("removed, its look pad and frame observer go", gone.pads == 0 && gone.frame < changed.frame, JSON.stringify({ changed, gone }));
});
