// Browser test of <garden-scene performance>: Babylon's scene performance priority, from markup
// and live. Run after a build: npm run test:performance-priority.
const { run } = require("./harness");

run(`
<garden-scene performance="aggressive">
  <garden-sky colour="#203040"></garden-sky>
  <garden-camera type="arc" radius="10"></garden-camera>
  <garden-light type="hemi" position="0 1 0"></garden-light>
  <garden-sphere id="ball" diameter="2"></garden-sphere>
</garden-scene>`, async ({ page, check, frames }) => {
    const el = () => document.querySelector("garden-scene");
    await page.waitForFunction(() => document.querySelector("garden-scene").scene && document.getElementById("ball").mesh);
    await frames(5);
    const state = () => page.evaluate(() => {
        const s = document.querySelector("garden-scene").scene;
        return { priority: s.performancePriority, skipClip: s.skipFrustumClipping, skipMove: s.skipPointerMovePicking, autoClear: s.autoClear };
    });
    let s = await state();
    check("performance=\"aggressive\": priority 2, no frustum clipping, no pointer-move picking",
        s.priority == 2 && s.skipClip && s.skipMove && !s.autoClear, JSON.stringify(s));
    const drawn = await page.evaluate(() => document.querySelector("garden-scene").scene.getActiveMeshes().data.some(m => m.id && m == document.getElementById("ball").mesh));
    check("...the sphere is still drawn", drawn);

    await page.evaluate(() => document.querySelector("garden-scene").setAttribute("performance", "intermediate"));
    await frames(2);
    s = await state();
    check("live: intermediate is priority 1, frustum clipping back on", s.priority == 1 && !s.skipClip && s.skipMove, JSON.stringify(s));

    await page.evaluate(() => document.querySelector("garden-scene").removeAttribute("performance"));
    await frames(2);
    s = await state();
    check("taken off: Babylon's default (backward compatible) again", s.priority == 0 && !s.skipMove && s.autoClear, JSON.stringify(s));
});
