// Browser test of walking a `type="free"` camera without keys (CameraTouchMove; `touch="always"`
// so the mouse stands in for a finger): the stick shows faded, then fades out when idle; a push
// up on the left walks forward; a tap on the floor glides there at the same eye height; a tap on
// a wall or on something far off doesn't; a tap on a link's mesh leaves it to the link; `touch="false"`
// builds none. Run after a build: npm run test:touch-move.
const { run } = require("./harness");

run(`
<garden-scene gravity="0 -0.4 0" collisions>
  <garden-camera id="cam" type="free" touch="always" collisions position="0 1.6 0" ellipsoid="0.4 0.8 0.4"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="200" height="200" collisions></garden-ground>
  <garden-box id="wall" width="6" height="3" depth="0.3" position="3 1.5 30" collisions></garden-box>
</garden-scene>`, async ({ page, check, errors, open }) => {
    await page.waitForFunction(() => document.getElementById("cam").touchMove);
    await page.waitForTimeout(1200); // settle on the ground
    const pos = () => page.evaluate(() => document.getElementById("cam").camera.position.asArray().map(n => +n.toFixed(2)));
    const opacity = () => page.evaluate(() => getComputedStyle(document.querySelector(".garden-touch-walk")).opacity);

    check("the stick shows (faded) when the scene opens", +(await opacity()) > 0.3, await opacity());
    await page.waitForTimeout(4900);
    check("…and fades out when nobody touches it", +(await opacity()) < 0.05, await opacity());

    // Push up from the lower left: walks forward (+z, the way the camera faces).
    const p0 = await pos();
    await page.mouse.move(150, 560);
    await page.mouse.down();
    check("a touch there brings it back", +(await opacity()) > 0.9, await opacity());
    await page.mouse.move(150, 500, { steps: 4 });
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const p1 = await pos();
    check("pushing the stick up walks forward", p1[2] - p0[2] > 1, JSON.stringify([p0, p1]));
    check("…at the same height", Math.abs(p1[1] - p0[1]) < 0.1, JSON.stringify([p0, p1]));

    // Tap the floor ahead (lower middle of the screen): glide there.
    const yaw0 = await page.evaluate(() => document.getElementById("cam").camera.rotation.y);
    await page.mouse.click(700, 520);
    await page.waitForTimeout(2600);
    const p2 = await pos();
    check("a tap on the floor glides there", p2[2] - p1[2] > 1.5, JSON.stringify([p1, p2]));
    check("…keeping the eye height", Math.abs(p2[1] - p1[1]) < 0.1, JSON.stringify([p1, p2]));
    const yaw1 = await page.evaluate(() => document.getElementById("cam").camera.rotation.y);
    check("…and facing the same way", Math.abs(yaw1 - yaw0) < 0.01, `${yaw0} ${yaw1}`);

    // A tap in the stick's half of the screen walks too (the zone passes taps on).
    await page.mouse.click(300, 600);
    await page.waitForTimeout(2600);
    const p3 = await pos();
    check("a tap on the floor in the stick's half walks there", Math.hypot(p3[0] - p2[0], p3[2] - p2[2]) > 0.5, JSON.stringify([p2, p3]));

    // The sky: no move.
    await page.mouse.click(700, 120); // sky
    await page.waitForTimeout(800);
    const p4 = await pos();
    check("a tap on the sky doesn't move", Math.hypot(p4[0] - p3[0], p4[2] - p3[2]) < 0.05, JSON.stringify([p3, p4]));

    await page.evaluate(() => document.getElementById("cam").setAttribute("touch", "false"));
    await page.waitForFunction(() => document.getElementById("cam").camera && !document.getElementById("cam").touchMove);
    check("touch=\"false\": no stick", await page.locator(".garden-touch-walk").count() == 0);
    // The default, touch="true", on a touch screen: only a finger uses the stick. A mouse goes through to the scene.
    await open(`<garden-scene>
  <garden-camera id="cam" type="free" position="0 1.6 -8" target="0 1 0"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="40" height="40"></garden-ground>
</garden-scene>`);
    await page.waitForFunction(() => document.getElementById("cam").touchMove);
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type == "touchEnd" ? [] : [{ x, y }] });
    const padOn = () => page.evaluate(() => document.getElementById("cam").touchMove.pad.active);
    const under = (x, y) => page.evaluate(([x, y]) => document.elementFromPoint(x, y).tagName, [x, y]);
    await page.evaluate(() => { window.__downs = []; document.querySelector("garden-scene").canvas.addEventListener("pointerdown", e => __downs.push(e.pointerType)); });

    await touch("touchStart", 150, 500);
    await page.waitForTimeout(100);
    check("a visitor's first touch on the left takes the stick", await padOn());
    await touch("touchEnd");
    await page.waitForTimeout(100);

    await page.mouse.move(150, 480);
    await page.mouse.move(150, 500);
    await page.waitForTimeout(100);
    check("a mouse there is over the scene, not the stick's zone", (await under(150, 500)) == "CANVAS", await under(150, 500));
    await page.mouse.down();
    await page.waitForTimeout(100);
    const mouseStick = await padOn();
    check("a mouse press there doesn't take the stick", !mouseStick);
    await page.mouse.up();
    check("...it reaches the scene", (await page.evaluate(() => __downs)).includes("mouse"), JSON.stringify(await page.evaluate(() => __downs)));

    await touch("touchStart", 150, 500);
    await page.waitForTimeout(100);
    await touch("touchEnd");
    await page.waitForTimeout(100);
    await touch("touchStart", 150, 500);
    await page.waitForTimeout(100);
    check("a finger gets the stick back after a mouse", await padOn());
    await touch("touchEnd");

    check("no page errors", errors.length == 0, errors.join(" | "));
});
