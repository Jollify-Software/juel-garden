// Browser test of <garden-particle texture-mask> (Babylon's textureMask: tints the particle
// image per channel), a custom system directly in the scene playing with event="load", and a
// changed attribute rebuilding the system without leaving the old one behind.
// Run after a build: npm run test:particle-mask.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" radius="10"></garden-camera>
  <garden-light></garden-light>
  <garden-particle id="sparks" url="/examples/assets/dunes.png" emitter="0 0 0" texture-mask="0.1 0.8 0.8 1" event="load" emitrate="50"></garden-particle>
  <garden-particle id="waiting" url="/examples/assets/dunes.png" emitter="2 0 0"></garden-particle>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("sparks").particleSystem);
    await frames(30);
    let s = await page.evaluate(() => {
        const ps = document.getElementById("sparks").particleSystem, scene = document.querySelector("garden-scene").scene;
        return { mask: ps.textureMask.asArray().map(n => +n.toFixed(2)), started: ps.isStarted(), alive: ps.getActiveCount(),
                 waiting: document.getElementById("waiting").particleSystem.isStarted(), systems: scene.particleSystems.length };
    });
    check("texture-mask is the system's textureMask", JSON.stringify(s.mask) == "[0.1,0.8,0.8,1]", JSON.stringify(s.mask));
    check("directly in the scene, event=\"load\" plays it", s.started && s.alive > 0, JSON.stringify(s));
    check("...and without event it waits", !s.waiting, JSON.stringify(s));

    await page.evaluate(() => { window.__old = document.getElementById("sparks").particleSystem; document.getElementById("sparks").setAttribute("texture-mask", "1 0 0 1"); });
    await page.waitForFunction(() => document.getElementById("sparks").particleSystem && document.getElementById("sparks").particleSystem != window.__old);
    await frames(10);
    s = await page.evaluate(() => {
        const ps = document.getElementById("sparks").particleSystem, scene = document.querySelector("garden-scene").scene;
        return { mask: ps.textureMask.asArray(), started: ps.isStarted(), systems: scene.particleSystems.length, oldGone: !scene.particleSystems.includes(window.__old) };
    });
    check("a changed texture-mask builds the system again, playing, and the old one goes",
        JSON.stringify(s.mask) == "[1,0,0,1]" && s.started && s.systems == 2 && s.oldGone, JSON.stringify(s));
});
