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
</garden-scene>`, async ({ page, check }) => {
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
});
