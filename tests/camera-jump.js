// Browser test of `<garden-camera jump>`: Space jumps a walking camera about its height and it
// lands where it stood; a low ceiling stops it short; Space in a text field types instead; a
// camera without `jump` doesn't jump; removing the attribute's camera lets go of the key. The
// `jump-button`: on the right, a real tap jumps and leaves the scene alone, hides with `visible` or
// another camera, and goes with the attribute. Run after a build: npm run test:camera-jump.
const { run } = require("./harness");

run(`
<garden-scene gravity="0 -0.4 0" collisions>
  <garden-camera id="cam" type="free" collisions jump="1" position="0 1.6 0" ellipsoid="0.4 0.8 0.4"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="40" height="40" collisions></garden-ground>
  <garden-box id="roof" width="4" height="0.2" depth="4" position="20 2.2 0" collisions></garden-box>
</garden-scene>
<input id="field" style="position:fixed;left:4px;top:4px">`, async ({ page, check, open }) => {
    const cam = () => page.evaluate(() => {
        const el = document.getElementById("cam");
        return { y: +el.camera.position.y.toFixed(3), jumping: !!el.jumper?.jumping };
    });
    // Peak height over a jump: sample every frame until it lands.
    const jumpPeak = () => page.evaluate(() => new Promise(resolve => {
        const el = document.getElementById("cam"), scene = el.camera.getScene();
        let peak = el.camera.position.y, start = peak, frames = 0, left = false;
        const o = scene.onBeforeRenderObservable.add(() => {
            peak = Math.max(peak, el.camera.position.y);
            left = left || el.jumper.jumping; // a tap takes some frames to arrive: wait for the jump, or give up after 10 s
            if ((left && !el.jumper.jumping) || ++frames > 600) {
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

    // The on-screen button.
    const button = page.locator(".garden-touch-jump");
    check("no jump-button attribute: no button", await button.count() == 0);
    await open(`
<garden-scene gravity="0 -0.4 0" collisions>
  <garden-camera id="cam" type="free" collisions jump="1" jump-button="always" position="0 1.6 0" ellipsoid="0.4 0.8 0.4"></garden-camera>
  <garden-camera id="other" type="free" position="0 9 0" controls="false"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="40" height="40" collisions></garden-ground>
</garden-scene>`);
    await page.waitForFunction(() => document.getElementById("cam").jumpButton);
    await page.waitForTimeout(1500);
    const yaw = () => page.evaluate(() => document.getElementById("cam").camera.rotation.y);
    check("jump-button=\"always\": a button, on the right", await button.isVisible() &&
        (await button.boundingBox()).x > 500, JSON.stringify(await button.boundingBox()));
    check("it has a name for a screen reader", await button.getAttribute("aria-label") == "Jump");
    const yaw0 = await yaw(), pos0 = await page.evaluate(() => document.getElementById("cam").camera.position.z);
    peak = jumpPeak();
    await button.tap();
    let c = await peak;
    check("a tap on it jumps about its height", c.rise > 0.8 && c.rise < 1.2, JSON.stringify(c));
    check("…and lands where it stood", Math.abs(c.end - c.start) < 0.05, JSON.stringify(c));
    check("…and the scene didn't take it as a walk or a look", await yaw() == yaw0 &&
        Math.abs(await page.evaluate(() => document.getElementById("cam").camera.position.z) - pos0) < 0.01);
    check("…and it didn't take the focus", await page.evaluate(() => !document.activeElement?.closest?.(".garden-touch-jump")));

    await page.evaluate(() => { document.getElementById("cam").jumpButton.visible = false; });
    check("visible = false hides it", !(await button.isVisible()));
    await page.waitForTimeout(100);
    check("…and it stays hidden over the next frames", !(await button.isVisible()));
    await page.evaluate(() => { document.getElementById("cam").jumpButton.visible = true; });
    check("visible = true brings it back", await button.isVisible());

    await page.evaluate(() => { const s = document.querySelector("garden-scene").scene; s.activeCamera = document.getElementById("other").camera; });
    await page.waitForTimeout(100);
    check("with another camera active it hides", !(await button.isVisible()));
    await page.evaluate(() => { const s = document.querySelector("garden-scene").scene; s.activeCamera = document.getElementById("cam").camera; });
    await page.waitForTimeout(100);
    check("…and comes back with its own", await button.isVisible());

    // Bare is for touch screens: this test's page is one (the harness has touch on), then told it has a mouse instead.
    const rebuilt = async value => {
        await page.evaluate(v => { document.getElementById("cam").setAttribute("jump-button", v); }, value);
        await page.waitForTimeout(300);
    };
    check("this page is a touch screen", await page.evaluate(() => navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches));
    await rebuilt("");
    check("bare jump-button: a button on a touch screen", await button.isVisible());
    await rebuilt("true");
    check("jump-button=\"true\": the same", await button.isVisible());
    await page.evaluate(() => { window.realMatchMedia = window.matchMedia; window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); });
    await rebuilt("");
    check("bare jump-button: none with a mouse", await button.count() == 0);
    await rebuilt("always");
    check("jump-button=\"always\": one with a mouse", await button.isVisible());
    await page.evaluate(() => { window.matchMedia = window.realMatchMedia; });
    await page.evaluate(() => { document.getElementById("cam").setAttribute("jump-button", "false"); });
    await page.waitForTimeout(300);
    check("jump-button=\"false\": gone", await button.count() == 0);
    await page.evaluate(() => { document.getElementById("cam").setAttribute("jump-button", "always"); });
    await page.waitForFunction(() => document.getElementById("cam").jumpButton);
    await page.evaluate(() => document.getElementById("cam").removeAttribute("jump"));
    await page.waitForFunction(() => document.getElementById("cam").camera && !document.getElementById("cam").jumper);
    check("no jump, no button", await button.count() == 0);
}, { url: "/test.html" });
