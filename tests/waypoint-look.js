// Browser test of <garden-waypoint> stops with `look-at`: flying to one turns the camera to face
// its target (an element, or an "x y z" point) by the time it lands; a stop without one still
// aims at the origin. Run after a build: npm run test:waypoint-look.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="free" position="0 1.6 -6">
    <garden-waypoint offset="0 1.6 0" speed="4" dwell="0" waypoints="#a #b #c"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-box id="a" position="5 0.1 0" size="1"></garden-box>
  <garden-box id="b" position="10 0.1 0" size="1" look-at="#sign"></garden-box>
  <garden-box id="sign" position="10 1.7 -5" size="0.5"></garden-box>
  <garden-box id="c" position="-10 0.1 0" size="1" look-at="-20 1.7 0"></garden-box>
</garden-scene>`, async ({ page, check, open }) => {
    // The camera's forward direction, after flying to stop i.
    const flyTo = async i => {
        await page.evaluate(i => document.querySelector("garden-waypoint").go(i), i);
        await page.waitForTimeout(1500);
        return page.evaluate(() => {
            const c = document.querySelector("garden-camera").camera;
            const f = c.getDirection(new (c.position.constructor)(0, 0, 1));
            return { x: +f.x.toFixed(3), y: +f.y.toFixed(3), z: +f.z.toFixed(3), px: +c.position.x.toFixed(2) };
        });
    };
    let f = await flyTo(1);
    check("look-at=#sign: at b, facing -z towards the sign", f.px == 10 && f.z < -0.99 && Math.abs(f.x) < 0.01, JSON.stringify(f));
    f = await flyTo(2);
    check('look-at="-20 1.7 0": at c, facing -x', f.px == -10 && f.x < -0.99, JSON.stringify(f));
    f = await flyTo(0);
    check("no look-at: aims at the origin as it sets off (from c: +x)", f.px == 5 && f.x > 0.9, JSON.stringify(f));

    // Placed on the first stop at start: its look-at too (a child built after it, as a Parterre
    // platform's panel), not the origin, which for a stop at the origin was straight down.
    const start = async html => {
        await open(html);
        await page.waitForFunction(() => Array.isArray(document.querySelector("garden-waypoint")?.waypoints), null, { timeout: 30000 });
        await page.waitForTimeout(500);
        return page.evaluate(() => {
            const c = document.querySelector("garden-camera").camera;
            const f = c.getDirection(new (c.position.constructor)(0, 0, 1));
            return { x: +f.x.toFixed(3), y: +f.y.toFixed(3), z: +f.z.toFixed(3) };
        });
    };
    f = await start(`
<garden-scene>
  <garden-camera type="free" position="0 1.6 0">
    <garden-waypoint offset="0 1.6 0" dwell="0" waypoints="#p #q"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-cylinder id="p" position="0 0.1 0" diameter="2" height="0.2" look-at="#p-panel">
    <garden-plane id="p-panel" position="2.2 1.15 0" width="1.8" height="1.2"></garden-plane>
  </garden-cylinder>
  <garden-cylinder id="q" position="10 0.1 0" diameter="2" height="0.2"></garden-cylinder>
</garden-scene>`);
    check("first stop at the origin with look-at=#panel: starts facing its panel (+x, a little down)", f.x > 0.95 && f.y < 0 && f.y > -0.3, JSON.stringify(f));
    f = await start(`
<garden-scene>
  <garden-camera type="free" position="0 1.6 0">
    <garden-waypoint offset="0 1.6 0" dwell="0" waypoints="#p #q"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-cylinder id="p" position="0 0.1 0" diameter="2" height="0.2"></garden-cylinder>
  <garden-cylinder id="q" position="10 0.1 0" diameter="2" height="0.2"></garden-cylinder>
</garden-scene>`);
    check("first stop at the origin, no look-at: starts looking level, not straight down", Math.abs(f.y) < 0.01, JSON.stringify(f));
});
