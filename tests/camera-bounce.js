// Browser test of <garden-camera type="arc" bounce>: zoomed out to its radius-upper (here it
// starts beyond it), it springs back inside the limit, as Babylon's BouncingBehavior; without
// bounce it stays at the limit; changing the attribute later rebuilds it with or without.
// Run after a build: npm run test:camera-bounce.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera id="cam" type="arc" alpha="4.712" beta="0.39" radius="50" target="0 0 0"
      radius-lower="6" radius-upper="20" bounce></garden-camera>
  <garden-light type="hemi"></garden-light>
  <garden-box size="3"></garden-box>
</garden-scene>`, async ({ page, check }) => {
    const radius = () => page.evaluate(() => {
        const c = document.getElementById("cam").camera;
        return { radius: +c.radius.toFixed(2), bouncing: c.useBouncingBehavior };
    });
    await page.waitForTimeout(1500);
    let r = await radius();
    check("bounce: from beyond radius-upper it springs back inside (to 18)", r.bouncing && r.radius > 17.5 && r.radius < 19.5, JSON.stringify(r));

    await page.evaluate(() => { const el = document.getElementById("cam"); el.removeAttribute("bounce"); el.setAttribute("radius", "60"); });
    await page.waitForTimeout(1500);
    r = await radius();
    check("without bounce it stays at the limit", !r.bouncing && r.radius == 20, JSON.stringify(r));
});
