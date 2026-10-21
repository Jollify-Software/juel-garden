// Browser test of <garden-waypoint> flying to a stop that moves (an orbiting platform, as
// Parterre makes for a Jollify VR presentation's `data-orbit`): the fly follows the stop, so
// you land on it and then ride its orbit. Control: the same fly without following (the
// end fixed where the stop was when it began, as before) lands well off it.
// Run after a build: node tests/waypoint-orbit.js.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera position="0 1.6 -8">
    <garden-waypoint waypoints="#a #o" offset="0 1.6 0" speed="2" dwell="0"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-ground width="80" height="80"></garden-ground>
  <garden-cylinder id="a" height="0.2" diameter="1.5" position="0 0.1 -8"></garden-cylinder>
  <garden-box id="hub" position="0 1 0" width="2" height="2" depth="2">
    <garden-cylinder id="o" height="0.2" diameter="1.5" position="10 0.1 0" orbit orbit-angle="0.01"></garden-cylinder>
  </garden-box>
</garden-scene>`, async ({ page, check, errors }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 20, null, { timeout: 30000 });
    // The camera's distance from o across the ground (x, z).
    const miss = () => page.evaluate(() => {
        const c = document.querySelector("garden-camera").camera.globalPosition;
        const p = document.getElementById("o").getPosition();
        return Math.round(Math.hypot(c.x - p.x, c.z - p.z) * 100) / 100;
    });
    const arrived = () => page.waitForFunction(() => !document.querySelector("garden-scene").scene.getAnimatableByTarget(document.querySelector("garden-camera").camera), null, { timeout: 10000 });

    // Control: the old fly, its end fixed at o's position when it began.
    await page.evaluate(() => { const w = document.querySelector("garden-waypoint"); w.moveToPosition(document.getElementById("o").getPosition()); });
    await page.waitForTimeout(200);
    await arrived();
    const fixed = await miss();
    check("control: a fly with a fixed end misses the orbiting stop", fixed > 2, String(fixed));
    await page.evaluate(() => document.querySelector("garden-waypoint").setPosition(document.getElementById("a").getPosition()));

    await page.evaluate(() => document.querySelector("garden-waypoint").go(1));
    await page.waitForTimeout(200);
    await arrived();
    const landed = await miss();
    check("go() to the orbiting stop lands on it (within its 0.75 m radius)", landed < 0.75, String(landed));
    await page.waitForTimeout(1500);
    const later = await miss();
    check("…and rides its orbit (still on it 1.5 s later)", later < 0.75, String(later));
    check("no page errors", errors.length === 0, errors.join(" | "));
});
