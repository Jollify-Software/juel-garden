// Browser test of how a visitor finds out how to move. Keys work with no click first in a page that's only a scene.
// `hint`: the words show, name the keys and Space, take no clicks, hide with `visible` or another camera, and go after
// a walk. Run after a build: npm run test:camera-hint.
const { run } = require("./harness");

run(`
<garden-scene gravity="0 -0.4 0" collisions>
  <garden-camera id="cam" type="free" collisions jump hint position="0 1.6 0" ellipsoid="0.4 0.8 0.4"></garden-camera>
  <garden-camera id="other" type="free" position="0 5 0" controls="false"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="40" height="40" collisions></garden-ground>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("cam").moveHint);
    await page.waitForTimeout(1200);
    const z = () => page.evaluate(() => document.getElementById("cam").camera.position.z);
    const opacity = () => page.locator(".garden-camera-hint").evaluate(e => e.style.opacity);
    const setActive = id => page.evaluate(id => { document.querySelector("garden-scene").scene.activeCamera = document.getElementById(id).camera; }, id);

    check("the canvas has the keys with no click", await page.evaluate(() => document.activeElement === document.querySelector("garden-scene").canvas));
    const words = await page.locator(".garden-camera-hint").textContent();
    // The harness is a touch screen. Keys for a mouse and keyboard are checked in the app's walk.
    check("the words suit a touch screen", /Tap the floor/.test(words), words);
    await setActive("cam");
    await page.waitForTimeout(200);
    check("they show", await opacity() == "1");
    check("they take no clicks", await page.locator(".garden-camera-hint").evaluate(e => getComputedStyle(e).pointerEvents) == "none");

    await page.evaluate(() => { document.getElementById("cam").moveHint.visible = false; });
    await page.waitForTimeout(100);
    check("a page can hide them", await opacity() == "0");
    await page.evaluate(() => { document.getElementById("cam").moveHint.visible = true; });
    await setActive("other");
    await page.waitForTimeout(200);
    check("another camera hides them", await opacity() == "0");
    await setActive("cam");
    await page.waitForTimeout(200);
    check("back on this camera they show", await opacity() == "1");

    const before = await z();
    await page.keyboard.down("w");
    await page.waitForTimeout(1500);
    await page.keyboard.up("w");
    await page.waitForTimeout(300);
    const after = await z();
    check("W walks, with no click first", after - before > 1, `${before} -> ${after}`);
    check("after a walk the words go", await opacity() == "0");
});
