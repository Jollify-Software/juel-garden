// Browser test of <garden-environment>: Babylon's default environment gives PBR models their
// lighting map and a backdrop (ground and sky, each optional, with a main colour); removing it
// takes them away; with a light's shadows, its ground receives and nothing of it casts
// (and `shadow-blur` on the light). Run after a build: npm run test:environment.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 2 -6"></garden-camera>
  <garden-light></garden-light>
  <garden-environment id="env" colour="#808080" ground-size="12" ground-y="0.5"></garden-environment>
</garden-scene>`, async ({ page, check, frames, open }) => {
    await page.waitForFunction(() => document.getElementById("env").helper);
    await frames(5);
    const s = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene, h = document.getElementById("env").helper;
        return { env: !!scene.environmentTexture, ground: !!h.ground, sky: !!h.skybox, y: h.ground?.position.y,
            size: h.ground?.getBoundingInfo().boundingBox.extendSize.x * 2 };
    });
    check("a lighting map for PBR materials", s.env, JSON.stringify(s));
    check("a ground and a sky, the ground ground-size wide and raised by ground-y", s.ground && s.sky && Math.abs(s.size - 12) < 0.01 && s.y == 0.5, JSON.stringify(s));

    await page.evaluate(() => document.getElementById("env").setAttribute("sky", "false"));
    await frames(3);
    const noSky = await page.evaluate(() => { const h = document.getElementById("env").helper; return { sky: !!h.skybox, ground: !!h.ground, meshes: document.querySelector("garden-scene").scene.meshes.map(m => m.name) }; });
    check("sky=\"false\" leaves the sky out (rebuilt, not doubled)", !noSky.sky && noSky.ground && noSky.meshes.join() == "BackgroundHelper,BackgroundPlane", JSON.stringify(noSky));

    await page.evaluate(() => document.getElementById("env").remove());
    await frames(3);
    const gone = await page.evaluate(() => ({ env: !!document.querySelector("garden-scene").scene.environmentTexture, meshes: document.querySelector("garden-scene").scene.meshes.length }));
    check("removing it takes it all away", !gone.env && gone.meshes == 0, JSON.stringify(gone));

    // With a light's shadows: the backdrop receives on its ground only, and casts nothing (a sky
    // casting would stretch the shadow map over the whole backdrop); shadow-blur softens them.
    await open(`
<garden-scene>
  <garden-camera type="arc" position="0 2 -6"></garden-camera>
  <garden-light id="sun" type="directional" direction="0 -0.5 -1" position="0 5 5" shadows="1024" shadow-blur="16"></garden-light>
  <garden-environment id="env" ground-shadow></garden-environment>
  <garden-box position="0 0.5 0"></garden-box>
</garden-scene>`);
    await frames(5);
    const sh = await page.evaluate(() => {
        const g = document.getElementById("sun").shadowGenerator, h = document.getElementById("env").helper;
        return { casters: g.getShadowMap().renderList.map(m => m.name), ground: h.ground.receiveShadows, sky: h.skybox.receiveShadows,
            blur: g.useBlurExponentialShadowMap, kernel: g.blurKernel, pcf: g.usePercentageCloserFiltering };
    });
    check("the backdrop doesn't cast; the box does", sh.casters.length == 1 && !sh.casters.some(n => /^Background/.test(n)), JSON.stringify(sh));
    check("its ground receives shadows, its sky doesn't", sh.ground && !sh.sky, JSON.stringify(sh));
    check("shadow-blur: a blurred exponential shadow map with that kernel", sh.blur && sh.kernel == 16 && !sh.pcf, JSON.stringify(sh));
});
