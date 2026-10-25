// Browser test of the `overlap` behaviour (garden-overlap / garden-overlap-end by world
// boxes, by the meshes' own boxes with overlap-precise, and with a point), a
// <garden-action> on those events setting a colour, <garden-material>'s wireframe,
// back-faces, lighting="false" and ambient-colour, the scene's ambient-colour, and
// <garden-light shadow-filter>. Run after a build: npm run test:overlap.
const { run } = require("./harness");

run(`
<garden-scene ambient-colour="#333333">
  <garden-camera type="arc" alpha="1" beta="0.8" radius="40" target="0 0 0"></garden-camera>
  <garden-light id="sun" type="directional" direction="1 -1 0" position="-2 2 0" shadows="128" shadow-filter="blur-exponential"></garden-light>
  <garden-plane id="tilted" size="20" position="0 0 0" rotation="-45 0 0">
    <garden-material emissive-colour="#33ff33" back-faces wireframe lighting="false" ambient-colour="#ffffff"></garden-material>
  </garden-plane>
  <garden-sphere id="loose" diameter="2" position="2 5 0" emissive-colour="#ffffff" overlap="#tilted">
    <garden-action trigger="garden-overlap" type="set" property="material.emissiveColor" value="#ff0000"></garden-action>
    <garden-action trigger="garden-overlap-end" type="set" property="material.emissiveColor" value="#ffffff"></garden-action>
  </garden-sphere>
  <garden-sphere id="precise" diameter="2" position="-2 5 0" overlap="#tilted" overlap-precise></garden-sphere>
  <garden-sphere id="pointy" diameter="2" position="-30 5 0" overlap-point="-30 0 0"></garden-sphere>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("pointy").mesh && document.getElementById("tilted").mesh?.material?.wireframe);
    await page.evaluate(() => {
        window.__events = [];
        for (const id of ["loose", "precise", "pointy"])
            document.getElementById(id).addEventListener("garden-overlap", e => __events.push(id + " " + (e.detail.target.id ?? "point")));
    });
    await frames(5);
    const state = () => page.evaluate(() => ({
        loose: document.getElementById("loose").overlapping.size,
        precise: document.getElementById("precise").overlapping.size,
        pointy: document.getElementById("pointy").overlapping.size,
        colour: document.getElementById("loose").mesh.material.emissiveColor.toHexString(),
        events: __events.slice(),
    }));
    // At y = 5 the tipped plane's world box (half-height 7.07) holds both spheres, but the
    // plane itself is 3.5 m away: only the loose check counts it.
    let a = await state();
    check("overlap: world boxes touch -> the element's overlapping has the plane", a.loose == 1, JSON.stringify(a));
    check("<garden-action trigger=\"garden-overlap\"> set the colour", a.colour == "#FF0000", JSON.stringify(a));
    check("overlap-precise: the plane's own box doesn't touch", a.precise == 0, JSON.stringify(a));
    check("overlap-point: the point isn't inside yet", a.pointy == 0, JSON.stringify(a));

    await page.evaluate(() => {
        for (const id of ["loose", "precise", "pointy"]) {
            const el = document.getElementById(id);
            el.mesh.position.y = id == "loose" ? 9 : 0.5;
        }
    });
    await frames(3);
    let b = await state();
    check("moved out: garden-overlap-end, and the action set the colour back", b.loose == 0 && b.colour == "#FFFFFF", JSON.stringify(b));
    check("moved through the plane: overlap-precise fires", b.precise == 1 && b.events.includes("precise tilted"), JSON.stringify(b));
    check("moved round the point: overlap-point fires (target: the point)", b.pointy == 1 && b.events.includes("pointy point"), JSON.stringify(b));

    const m = await page.evaluate(() => {
        const sceneEl = document.querySelector("garden-scene"), mat = document.getElementById("tilted").mesh.material;
        const gen = document.getElementById("sun").shadowGenerator;
        return { wire: mat.wireframe, culling: mat.backFaceCulling, unlit: mat.disableLighting, ambient: mat.ambientColor.toHexString(),
            sceneAmbient: sceneEl.scene.ambientColor.toHexString(), blurEsm: gen.useBlurExponentialShadowMap, pcf: gen.usePercentageCloserFiltering };
    });
    check("garden-material: wireframe, back-faces, lighting=\"false\", ambient-colour",
        m.wire && !m.culling && m.unlit && m.ambient == "#FFFFFF", JSON.stringify(m));
    check("scene ambient-colour", m.sceneAmbient == "#333333", JSON.stringify(m));
    check("shadow-filter=\"blur-exponential\"", m.blurEsm && !m.pcf, JSON.stringify(m));

    await page.evaluate(() => {
        document.getElementById("sun").setAttribute("shadow-filter", "pcf");
        document.querySelector("garden-scene").setAttribute("ambient-colour", "#101010");
    });
    await frames(3);
    const live = await page.evaluate(() => {
        const gen = document.getElementById("sun").shadowGenerator;
        return { pcf: gen.usePercentageCloserFiltering, blurEsm: gen.useBlurExponentialShadowMap,
            ambient: document.querySelector("garden-scene").scene.ambientColor.toHexString() };
    });
    check("shadow-filter and ambient-colour change live", live.pcf && !live.blurEsm && live.ambient == "#101010", JSON.stringify(live));
});
