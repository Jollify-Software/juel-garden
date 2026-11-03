// Browser test of which meshes a light's shadows use: everything casts but grounds and
// height maps (they only receive: a terrain shading itself shows stripes of acne), a
// mesh's cast-shadows="false"/"true" or receive-shadows="false" overrides that; and a
// spot light's exponent, a light's specular colour, and cascaded shadows. Run after a build: npm run test:shadow-casters.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 14 -0.01"></garden-camera>
  <garden-light id="sun" type="directional" position="10 20 10" direction="-1 -2 -1" shadows="512"></garden-light>
  <garden-light id="far" type="directional" direction="0 -1 -1" shadows="512" cascades="3"></garden-light>
  <garden-light id="spot" type="spot" position="0 10 0" direction="0 -1 0" angle="60" exponent="16" specular="0 1 0"></garden-light>
  <garden-ground id="floor" width="30" height="30"></garden-ground>
  <garden-ground id="cast-floor" width="2" height="2" position="10 0 10" cast-shadows="true"></garden-ground>
  <garden-box id="crate" position="0 0.5 0"></garden-box>
  <garden-box id="ghost" position="3 0.5 0" cast-shadows="false"></garden-box>
  <garden-sphere id="lit" position="-3 0.5 0" receive-shadows="false"></garden-sphere>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("sun").shadowGenerator);
    await frames(5);
    const s = await page.evaluate(() => {
        const casters = document.getElementById("sun").shadowGenerator.getShadowMap().renderList.map(m => m.element?.id ?? m.parent?.element?.id);
        const receives = id => document.getElementById(id).mesh.receiveShadows;
        return { casters, floor: receives("floor"), lit: receives("lit"), crate: receives("crate"), exponent: document.getElementById("spot").light.exponent, specular: document.getElementById("spot").light.specular.asArray() };
    });
    check("a box casts", s.casters.includes("crate"), JSON.stringify(s.casters));
    check("a ground doesn't cast, but receives", !s.casters.includes("floor") && s.floor, JSON.stringify(s));
    check("cast-shadows=\"true\" makes a ground cast", s.casters.includes("cast-floor"), JSON.stringify(s.casters));
    check("cast-shadows=\"false\" stops a box casting", !s.casters.includes("ghost"), JSON.stringify(s.casters));
    check("receive-shadows=\"false\" stops a mesh receiving (others still do)", s.lit === false && s.crate === true, JSON.stringify(s));
    check("a spot light's exponent", s.exponent === 16, String(s.exponent));
    const csm = await page.evaluate(() => { const g = document.getElementById("far").shadowGenerator; return { cls: g.getClassName(), n: g.numCascades, auto: document.getElementById("far").light.autoCalcShadowZBounds }; });
    check("cascades=\"3\": a cascaded shadow generator with 3 cascades", csm.cls == "CascadedShadowGenerator" && csm.n == 3 && csm.auto, JSON.stringify(csm));
    check("a light's specular colour", s.specular.join() == "0,1,0", JSON.stringify(s.specular));

    // A shadow light watches for new meshes. A rebuild (a new shadow-map size) and a removal
    // take that watcher back, so the old generator isn't kept, and later meshes still cast.
    const before = await page.evaluate(() => document.querySelector("garden-scene").scene.onNewMeshAddedObservable.observers.length);
    for (const size of ["1024", "2048"]) {
        await page.evaluate(size => document.getElementById("sun").setAttribute("shadows", size), size);
        await frames(5);
    }
    const changed = await page.evaluate(() => ({ observers: document.querySelector("garden-scene").scene.onNewMeshAddedObservable.observers.length,
        size: document.getElementById("sun").shadowGenerator.getShadowMap().getSize().width }));
    check("a changed shadow size keeps one new-mesh watcher", changed.observers == before && changed.size == 2048, JSON.stringify({ before, ...changed }));
    await page.evaluate(() => {
        document.getElementById("sun").remove();
        const box = document.createElement("garden-box");
        box.id = "late";
        box.setAttribute("position", "-6 0.5 0");
        document.querySelector("garden-scene").append(box);
    });
    await page.waitForFunction(() => document.getElementById("late").mesh);
    await frames(5);
    const gone = await page.evaluate(() => ({ observers: document.querySelector("garden-scene").scene.onNewMeshAddedObservable.observers.length,
        late: document.getElementById("far").shadowGenerator.getShadowMap().renderList.some(m => m.element?.id == "late") }));
    check("a removed shadow light takes its watcher back; a later box still casts", gone.observers == before - 1 && gone.late, JSON.stringify({ before, ...gone }));
});
