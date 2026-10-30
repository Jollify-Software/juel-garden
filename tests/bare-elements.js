// Browser test: `<garden-lathe>` and `<garden-replicate>` written with no attributes build
// nothing (and warn) instead of throwing, as other elements do; the same elements with their
// attributes still build. Run after a build.
const { run } = require("./harness");

run(`<garden-scene>
    <garden-camera type="arc" position="0 2 -6"></garden-camera>
    <garden-light type="hemi"></garden-light>
    <garden-lathe id="bare-lathe"></garden-lathe>
    <garden-replicate id="bare-replicate"></garden-replicate>
    <garden-lathe id="lathe" shape="0 0 0, 1 0 0, 1 1 0, 0.5 2 0" tessellation="16"></garden-lathe>
    <garden-box id="rock" size="0.5" position="5 0 0"></garden-box>
    <garden-replicate id="replicate" instances="rock" positions="0: 6 0 0, 0: 7 0 0"></garden-replicate>
</garden-scene>`, async ({ page, check, frames }) => {
    await frames(20);
    const s = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        return {
            bareLathe: !!document.getElementById("bare-lathe").mesh,
            lathe: document.getElementById("lathe").mesh?.getTotalVertices() ?? 0,
            instances: scene.meshes.filter(m => /^mesh-instance-/.test(m.name)).length,
        };
    });
    check("a bare <garden-lathe> builds no mesh", !s.bareLathe, JSON.stringify(s));
    check("a <garden-lathe> with a shape still builds", s.lathe > 0, JSON.stringify(s));
    check("a <garden-replicate> with instances and positions still makes its instances", s.instances == 2, JSON.stringify(s));
});
