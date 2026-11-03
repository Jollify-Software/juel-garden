// Browser test of `<garden-camera jump>`: Space jumps a walking camera about its height and it
// lands where it stood; a low ceiling stops it short; Space in a text field types instead; a
// camera without `jump` doesn't jump; removing the attribute's camera lets go of the key.
// Run after a build: npm run test:camera-jump.
const { run } = require("./harness");

run(`
<garden-scene gravity="0 -0.4 0" collisions>
  <garden-camera id="cam" type="free" collisions jump="1" position="0 1.6 0" ellipsoid="0.4 0.8 0.4"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="40" height="40" collisions></garden-ground>
  <garden-box id="roof" width="4" height="0.2" depth="4" position="20 2.2 0" collisions></garden-box>
</garden-scene>
<input id="field" style="position:fixed;left:4px;top:4px">`, async ({ page, check }) => {
    const cam = () => page.evaluate(() => {
        const el = document.getElementById("cam");
        return { y: +el.camera.position.y.toFixed(3), jumping: !!el.jumper?.jumping };
    });
    // Peak height over a jump: sample every frame until it lands.
    const jumpPeak = () => page.evaluate(() => new Promise(resolve => {
        const el = document.getElementById("cam"), scene = el.camera.getScene();
        let peak = el.camera.position.y, start = peak, frames = 0;
        const o = scene.onBeforeRenderObservable.add(() => {
            peak = Math.max(peak, el.camera.position.y);
            if (++frames > 10 && !el.jumper.jumping) {
                scene.onBeforeRenderObservable.remove(o);
                resolve({ rise: +(peak - start).toFixed(2), end: +el.camera.position.y.toFixed(2), start: +start.toFixed(2) });
            }
        });
    }));

    await page.waitForFunction(() => document.getElementById("cam").jumper);
    await page.waitForTimeout(1500); // settle on the ground
    let rest = await cam();
    check("the camera settles standing on the ground", !rest.jumping, JSON.stringify(rest));

    await page.locator("canvas").click({ position: { x: 500, y: 600 } });
    let peak = jumpPeak();
    await page.keyboard.press("Space");
    let a = await peak;
    check("Space jumps about jump=\"1\" metre", a.rise > 0.8 && a.rise < 1.2, JSON.stringify(a));
    check("…and lands where it stood", Math.abs(a.end - a.start) < 0.05, JSON.stringify(a));

    // Under the low roof (its underside 2.1 m up, half a metre over the eyes): the head stops it short.
    await page.evaluate(y => { document.getElementById("cam").camera.position.set(20, y, 0); }, rest.y);
    await page.waitForTimeout(800);
    peak = jumpPeak();
    await page.keyboard.press("Space");
    let b = await peak;
    check("a ceiling stops the jump short", b.rise > 0.05 && b.rise < 0.8, JSON.stringify(b));
    check("…and it comes back down to the floor", Math.abs(b.end - b.start) < 0.05, JSON.stringify(b));
    await page.evaluate(y => { document.getElementById("cam").camera.position.set(0, y, 0); }, rest.y);
    await page.waitForTimeout(800);

    await page.locator("#field").click();
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    check("Space in a text field types and doesn't jump", !(await cam()).jumping && await page.inputValue("#field") == " ");

    await page.evaluate(() => document.getElementById("cam").removeAttribute("jump"));
    await page.waitForFunction(() => document.getElementById("cam").camera && !document.getElementById("cam").jumper);
    await page.waitForTimeout(800);
    await page.locator("canvas").click({ position: { x: 500, y: 600 } });
    let before = await cam();
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    let after = await cam();
    check("without jump, Space does nothing", Math.abs(after.y - before.y) < 0.02, JSON.stringify([before, after]));
}, { url: "/test.html" });
