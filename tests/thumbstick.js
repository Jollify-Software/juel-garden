// Browser test of <garden-thumbstick>: a floating stick on the left walks the player (and the
// built-in walk pad stays away), a fixed stick on the right turns the follow camera, the
// events fire, and `disabled` hides it. Run after a build: npm run test:thumbstick.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="follow" target="#p" free-look radius="6" height-offset="3"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="60" height="60"></garden-ground>
  <garden-box id="p" width="0.6" height="1.8" depth="0.4" position="0 0.9 0" walk walk-joystick="always"></garden-box>
  <garden-thumbstick id="move" side="left" controls="#p" show="always"></garden-thumbstick>
  <garden-thumbstick id="look" side="right" controls="camera" show="always" mode="fixed" colour="#ffcc66"></garden-thumbstick>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 20, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const counts = await page.evaluate(() => ({
        sticks: document.querySelectorAll(".garden-thumbstick").length,
        walkPad: document.querySelectorAll(".garden-walk-joystick").length,
        lookPad: document.querySelectorAll(".garden-look-pad").length,
    }));
    check("two thumbsticks are drawn", counts.sticks == 2, JSON.stringify(counts));
    check("…and the built-in pads stay away", counts.walkPad == 0 && counts.lookPad == 0, JSON.stringify(counts));

    let starts = 0;
    await page.exposeFunction("onStickStart", () => starts++);
    await page.evaluate(() => document.addEventListener("garden-thumbstick-start", () => window.onStickStart()));
    const pos = () => page.evaluate(() => document.getElementById("p").mesh.position.asArray().map(n => +n.toFixed(2)));

    // Floating: touch anywhere on the left half; the ring comes to the thumb.
    const before = await pos();
    await page.mouse.move(260, 520);
    await page.mouse.down();
    await page.mouse.move(260, 470, { steps: 4 });
    const ring = await page.locator('.garden-thumbstick[data-side="left"]').boundingBox();
    check("a floating stick jumps to where you touch", Math.abs(ring.x + ring.width / 2 - 260) < 3 && Math.abs(ring.y + ring.height / 2 - 520) < 3, JSON.stringify(ring));
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await pos();
    check("pushing it up walks forward", after[2] - before[2] > 0.8, JSON.stringify([before, after]));
    const home = await page.locator('.garden-thumbstick[data-side="left"]').boundingBox();
    check("…and let go, it goes back to its corner", home.x < 40 && home.y > 500, JSON.stringify(home));
    check("garden-thumbstick-start fired", starts >= 1, String(starts));

    // Fixed, on the right: drag right turns the view.
    const a0 = await page.evaluate(() => document.querySelector("garden-camera").camera.orbitAngle);
    const look = await page.locator('.garden-thumbstick[data-side="right"]').boundingBox();
    await page.mouse.move(look.x + look.width / 2, look.y + look.height / 2);
    await page.mouse.down();
    await page.mouse.move(look.x + look.width - 4, look.y + look.height / 2, { steps: 4 });
    await page.waitForTimeout(600);
    await page.mouse.up();
    const a1 = await page.evaluate(() => document.querySelector("garden-camera").camera.orbitAngle);
    check("the camera stick turns the view", a1 - a0 > 0.5, `${a0.toFixed(2)} -> ${a1.toFixed(2)}`);

    // disabled: hidden, and no input.
    await page.evaluate(() => (document.getElementById("move").disabled = true));
    await page.waitForTimeout(200);
    const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('.garden-thumbstick[data-side="left"]')).display);
    check("disabled hides it", hidden == "none", hidden);
    const b0 = await pos();
    await page.mouse.move(260, 520);
    await page.mouse.down();
    await page.mouse.move(260, 470, { steps: 4 });
    await page.waitForTimeout(600);
    await page.mouse.up();
    const b1 = await pos();
    check("…and gives no input", Math.abs(b1[2] - b0[2]) < 0.05, JSON.stringify([b0, b1]));
});
