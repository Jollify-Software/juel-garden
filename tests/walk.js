// Browser test of the `walk` behaviour: camera-relative movement from real key presses,
// turning to face the way it goes, running, `enabled`, the touch joystick, ground-following
// on a height map, Havok's character controller (falls, stops at a wall) and the
// `collisions` fallback. Run after a build: npm run test:walk.
const { run } = require("./harness");

const pos = id => `document.getElementById("${id}").mesh.position.asArray().map(n => +n.toFixed(2))`;

run(`
<garden-scene>
  <garden-camera type="arc" position="0 6 -12"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="p" width="0.6" height="1.8" depth="0.4" position="0 0.9 0" walk walk-joystick="always"></garden-box>
</garden-scene>`, async ({ page, check, open }) => {
    const hold = async (keys, ms) => {
        for (const k of keys) await page.keyboard.down(k);
        await page.waitForTimeout(ms);
        for (const k of keys) await page.keyboard.up(k);
        await page.waitForTimeout(400); // ease to a stop
    };
    const get = id => page.evaluate(id => {
        const el = document.getElementById(id), m = el.mesh;
        return { p: m.position.asArray().map(n => +n.toFixed(2)), yaw: +(m.rotation.y * 180 / Math.PI).toFixed(0),
                 speed: +el.walker.speed.toFixed(2), running: el.walker.running };
    }, id);

    // The camera looks along +Z from behind the box, so "w" is +Z and "d" is +X.
    await hold(["w"], 1000);
    let a = await get("p");
    check("W walks away from the camera (+Z) at about walk-speed", a.p[2] > 1.4 && a.p[2] < 2.6 && Math.abs(a.p[0]) < 0.1, JSON.stringify(a));
    check("…facing the way it walks", Math.abs(a.yaw) < 5, `yaw ${a.yaw}`);
    await hold(["d"], 1000);
    let b = await get("p");
    check("D walks right (+X) and turns to face it", b.p[0] - a.p[0] > 1.4 && Math.abs(b.yaw - 90) < 5, JSON.stringify(b));

    await page.keyboard.down("Shift");
    await page.keyboard.down("w");
    await page.waitForTimeout(800);
    let c = await get("p");
    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
    check("Shift runs at about walk-run-speed", c.running && c.speed > 4, JSON.stringify(c));
    await page.waitForTimeout(500);
    check("speed falls to 0 when the keys are let go", (await get("p")).speed < 0.05);

    await page.evaluate(() => document.getElementById("p").walker.enabled = false);
    let before = await get("p");
    await hold(["w"], 500);
    let after = await get("p");
    check("enabled = false ignores input", JSON.stringify(before.p) == JSON.stringify(after.p), JSON.stringify(after));
    await page.evaluate(() => document.getElementById("p").walker.enabled = true);

    // The joystick: drag the knob up.
    const box = await page.locator(".garden-walk-joystick").boundingBox();
    check("walk-joystick=\"always\" shows the thumb pad", !!box);
    before = await get("p");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 5, { steps: 4 });
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForTimeout(300);
    after = await get("p");
    check("dragging the thumb pad up walks forward", after.p[2] - before.p[2] > 1, JSON.stringify([before.p, after.p]));

    // Height map: the walker stays on the ground.
    await open(`
<garden-scene>
  <garden-camera type="follow" target="#p" free-look radius="6" height-offset="3"></garden-camera>
  <garden-light></garden-light>
  <garden-height-map id="dunes" url="/examples/assets/dunes.png" width="60" height="60" subdivisions="60" minheight="0" maxheight="5"></garden-height-map>
  <garden-box id="p" width="0.6" height="1.8" depth="0.4" position="0 3 -10" walk terrain="#dunes" terrain-offset="0.9"></garden-box>
</garden-scene>`);
    await page.waitForFunction(() => document.getElementById("dunes").mesh?.getHeightAtCoordinates(0, 0) > 0);
    await hold(["w"], 1500);
    const ground = await page.evaluate(() => {
        const m = document.getElementById("p").mesh, d = document.getElementById("dunes").mesh;
        return { y: m.position.y, ground: d.getHeightAtCoordinates(m.position.x, m.position.z), z: m.position.z };
    });
    check("on terrain it walks and stays on the ground", ground.z > -8.5 && Math.abs(ground.y - ground.ground - 0.9) < 0.05, JSON.stringify(ground));
    check("free-look: the follow camera stays behind (didn't swing round)", await page.evaluate(() => {
        const s = document.querySelector("garden-scene").scene, c = s.activeCamera, m = document.getElementById("p").mesh;
        return c.position.z < m.position.z;
    }));

    // Havok: falls onto a static floor, stops at a static wall.
    await open(`
<garden-scene>
  <garden-physics></garden-physics>
  <garden-camera type="arc" position="0 6 -12"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="floor" physics="static" width="20" height="1" depth="20" position="0 -0.5 0"></garden-box>
  <garden-box id="wall" physics="static" width="6" height="3" depth="1" position="0 1.5 4"></garden-box>
  <garden-box id="p" width="0.6" height="1.8" depth="0.6" position="0 3 0" walk></garden-box>
</garden-scene>`);
    await page.waitForFunction(() => document.getElementById("p").walker?.controller);
    // Babylon's controller counts as standing anywhere within keepDistance (0.05) + keepContactTolerance
    // (0.1) of the floor and stops where it first gets there: measured 0.92-1.04 over 8 runs (centre 0.9).
    const trace = [];
    for (let t = 0; t < 15; t++) {
        await page.waitForTimeout(100);
        trace.push((await page.evaluate(new Function(`return ${pos("p")}`)))[1]);
    }
    const landed = await page.evaluate(new Function(`return ${pos("p")}`));
    const still = trace.slice(-5).every(y => Math.abs(y - landed[1]) < 0.005);
    check("character controller: falls and lands on the floor", landed[1] > 0.85 && landed[1] < 1.06 && still, JSON.stringify(landed) + " " + trace.join(" "));
    await hold(["w"], 2500);
    const blocked = await page.evaluate(new Function(`return ${pos("p")}`));
    check("character controller: walks and stops at the wall", blocked[2] > 2.5 && blocked[2] < 3.5 - 0.25, JSON.stringify(blocked));

    // No physics, `collisions`: slides along meshes with collisions.
    await open(`
<garden-scene collisions>
  <garden-camera type="arc" position="0 6 -12"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="floor" collisions width="20" height="1" depth="20" position="0 -0.5 0"></garden-box>
  <garden-box id="wall" collisions width="6" height="3" depth="1" position="0 1.5 4"></garden-box>
  <garden-box id="p" width="0.6" height="1.8" depth="0.6" position="0 2 0" walk collisions></garden-box>
</garden-scene>`);
    await page.waitForTimeout(1000);
    await hold(["w"], 2500);
    const slid = await page.evaluate(new Function(`return ${pos("p")}`));
    check("collisions: falls to the floor and stops at the wall", Math.abs(slid[1] - 0.9) < 0.15 && slid[2] > 2.5 && slid[2] < 3.5 - 0.25, JSON.stringify(slid));
});
