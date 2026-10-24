// Browser test of <garden-pipeline>: Babylon's DefaultRenderingPipeline on the scene's
// cameras, each effect off unless its attribute is there, and attribute changes
// applied in place. Run after a build: npm run test:pipeline.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-pipeline id="finish" samples="4" bloom="0.3" bloom-threshold="0.5" vignette="2" tone-mapping="aces" depth-of-field="8"></garden-pipeline>
  <garden-camera type="arc" radius="8"></garden-camera>
  <garden-light></garden-light>
  <garden-sphere><garden-material emissive-colour="#ffffff"></garden-material></garden-sphere>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("finish").pipeline);
    await frames(10);
    const read = () => page.evaluate(() => {
        const p = document.getElementById("finish").pipeline;
        return { cams: p.cameras.length, samples: p.samples, bloom: p.bloomEnabled && p.bloomWeight, threshold: p.bloomThreshold,
                 vignette: p.imageProcessing.vignetteEnabled && p.imageProcessing.vignetteWeight, aces: p.imageProcessing.toneMappingType,
                 dof: p.depthOfFieldEnabled && p.depthOfField.focusDistance, grain: p.grainEnabled, fxaa: p.fxaaEnabled };
    });
    let r = await read();
    check("on the scene's camera, declared after it", r.cams == 1, JSON.stringify(r));
    check("samples, bloom (weight, threshold), vignette, ACES, depth of field (in mm)",
        r.samples == 4 && r.bloom == 0.3 && r.threshold == 0.5 && r.vignette == 2 && r.aces == 1 && r.dof == 8000, JSON.stringify(r));
    check("effects not asked for stay off", !r.grain && !r.fxaa, JSON.stringify(r));
    await page.evaluate(() => { const el = document.getElementById("finish"); el.setAttribute("grain", "40"); el.removeAttribute("bloom"); });
    await frames(5);
    r = await read();
    check("changes apply in place (grain on, bloom off)", r.grain && r.bloom === false, JSON.stringify(r));
});
