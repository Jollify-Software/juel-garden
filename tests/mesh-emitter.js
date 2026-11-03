// Browser test of <garden-particle> emitting from a mesh's surface: `part` (a named part of a
// <garden-mesh-model>, built once the model has loaded) and `surface` (the parent mesh), with
// directions or the surface's normals; and the attributes that came with it: `colour-gradients`,
// `noise-strength` (+ noise-*), `sprite-cell`/`sprite-cells`/`sprite-speed`/`sprite-random-start`,
// `local`, `rendering-group`, `blend`, `invert-y`, min/max scale and initial rotation, and
// `cycle` (on and off by the scene's clock). Also `rendering-group` on a mesh (its parts too).
// Run after a build: npm run test:mesh-emitter.
const { run } = require("./harness");
const { partsGltfUrl } = require("./fixtures/parts-gltf");

run(`
<garden-scene>
  <garden-camera type="arc" radius="8" target="1.5 0.5 0"></garden-camera>
  <garden-light></garden-light>
  <garden-mesh-model id="model" src="${partsGltfUrl()}" extension="gltf" rendering-group="1">
    <garden-particle id="embers" part="stem" event="load" url="/examples/assets/dunes.png" emitrate="200" capacity="500"
        direction1="1 0 0" direction2="1 0.2 0" blend="add" rendering-group="1" local
        colour-gradients="0 1 0.5 0 0, 0.4 #ff8000ff, 1 0.3 0 0 0, nonsense"
        noise-strength="6 6 4" noise-speed="5" noise-octaves="6" noise-persistence="2" noise-brightness="0.5" noise-size="64"
        minscalex="2" maxscalex="3" minscaley="4" maxscaley="5" mininitialrotation="-1" maxinitialrotation="1"></garden-particle>
    <garden-particle id="vapour" part="plate" event="load" url="/examples/assets/dunes.png" invert-y="false" blend="standard"
        sprite-cell="64 32" sprite-cells="0 3" sprite-speed="0" sprite-random-start emitrate="100" cycle="0.5 0.5"></garden-particle>
  </garden-mesh-model>
  <garden-box id="box" size="1" position="-3 0 0">
    <garden-particle id="skin" surface event="load" url="/examples/assets/dunes.png" emitrate="100" sprite-cell="128"></garden-particle>
  </garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    const warnings = [];
    page.on("console", m => { if (m.type() == "warning") warnings.push(m.text()); });
    await page.waitForFunction(() => ["embers", "vapour", "skin"].every(id => document.getElementById(id).particleSystem), null, { timeout: 20000 });
    await frames(30);
    let s = await page.evaluate(() => {
        const get = id => document.getElementById(id).particleSystem;
        const e = get("embers"), v = get("vapour"), k = get("skin");
        const model = document.getElementById("model");
        return {
            emitterIsStem: e.emitter === model.getPart("stem"), emitterType: e.particleEmitterType.getClassName(),
            normals: e.particleEmitterType.useMeshNormalsForDirection, d2: e.particleEmitterType.direction2.asArray(),
            alive: e.getActiveCount(), started: e.isStarted(),
            gradients: (e.getColorGradients() || []).map(g => [g.gradient, g.color1.toHexString()]),
            noise: e.noiseTexture && [e.noiseTexture instanceof BABYLON.NoiseProceduralTexture ? "NoiseProceduralTexture" : "?", e.noiseTexture.octaves, e.noiseTexture.persistence, e.noiseTexture.brightness, e.noiseTexture.animationSpeedFactor, e.noiseTexture.getSize().width],
            noiseStrength: e.noiseStrength.asArray(),
            blend: [e.blendMode, v.blendMode], add: BABYLON.ParticleSystem.BLENDMODE_ADD, standard: BABYLON.ParticleSystem.BLENDMODE_STANDARD,
            local: e.isLocal, group: e.renderingGroupId,
            scale: [e.minScaleX, e.maxScaleX, e.minScaleY, e.maxScaleY], rotation: [e.minInitialRotation, e.maxInitialRotation],
            vapourOnPlate: v.emitter === model.getPart("plate"), vapourNormals: v.particleEmitterType.useMeshNormalsForDirection,
            sheet: [v.isAnimationSheetEnabled, v.spriteCellWidth, v.spriteCellHeight, v.startSpriteCellID, v.endSpriteCellID, v.spriteCellChangeSpeed, v.spriteRandomStartCell],
            invertY: v.particleTexture.invertY,
            skinOnBox: k.emitter === document.getElementById("box").mesh, skinSheet: [k.spriteCellWidth, k.spriteCellHeight, k.endSpriteCellID],
            partGroups: ["plate", "stem"].map(n => model.getPart(n).renderingGroupId),
        };
    });
    check("part=\"stem\" emits from that part's surface (a MeshParticleEmitter on it)", s.emitterIsStem && s.emitterType == "MeshParticleEmitter", JSON.stringify(s));
    check("...with direction1/2 instead of the normals", s.normals === false && JSON.stringify(s.d2) == "[1,0.2,0]", JSON.stringify(s));
    check("...and it plays (event=load once the model loaded)", s.started && s.alive > 0, `${s.alive} alive`);
    check("colour-gradients: numbers and #rrggbbaa, a malformed entry skipped",
        JSON.stringify(s.gradients) == JSON.stringify([[0, "#FF800000"], [0.4, "#FF8000FF"], [1, "#4D000000"]]), JSON.stringify(s.gradients));
    check("noise-strength makes a noise texture shaped by noise-*", JSON.stringify(s.noise) == JSON.stringify(["NoiseProceduralTexture", 6, 2, 0.5, 5, 64]) && JSON.stringify(s.noiseStrength) == "[6,6,4]", JSON.stringify(s.noise));
    check("blend: add and standard", s.blend[0] == s.add && s.blend[1] == s.standard, JSON.stringify(s.blend));
    check("local and rendering-group", s.local && s.group == 1, JSON.stringify([s.local, s.group]));
    check("min/max scale and initial rotation", JSON.stringify(s.scale) == "[2,3,4,5]" && JSON.stringify(s.rotation) == "[-1,1]", JSON.stringify([s.scale, s.rotation]));
    check("without directions a part emits along its normals", s.vapourOnPlate && s.vapourNormals === true, JSON.stringify(s));
    check("sprite-cell, sprite-cells, sprite-speed, sprite-random-start", JSON.stringify(s.sheet) == "[true,64,32,0,3,0,true]", JSON.stringify(s.sheet));
    check("invert-y=\"false\" loads the image unflipped", s.invertY === false, String(s.invertY));
    check("surface inside a plain mesh emits from that mesh; a square sheet gets every cell", s.skinOnBox && s.skinSheet[0] == 128 && s.skinSheet[1] == 128 && s.skinSheet[2] >= 0, JSON.stringify(s.skinSheet));
    check("rendering-group on a model reaches its parts", JSON.stringify(s.partGroups) == "[1,1]", JSON.stringify(s.partGroups));
    await page.evaluate(() => {
        const p = document.createElement("garden-particle");
        p.id = "missing"; p.setAttribute("part", "no-such-part"); p.setAttribute("url", "/examples/assets/dunes.png");
        document.getElementById("model").appendChild(p);
    });
    await page.waitForFunction(() => document.getElementById("missing").hasUpdated);
    await page.evaluate(() => document.getElementById("missing").whenReady);
    let noPart = await page.evaluate(() => document.getElementById("missing").particleSystem == null);
    check("a part that isn't there warns and builds nothing", noPart && warnings.some(w => w.includes("no-such-part")), warnings.join(" | "));

    // cycle="0.5 0.5": on for half a second, off for half a second.
    let samples = await page.evaluate(() => new Promise(resolve => {
        const scene = document.querySelector("garden-scene").scene, v = document.getElementById("vapour").particleSystem;
        const out = [], start = performance.now();
        const o = scene.onAfterRenderObservable.add(() => {
            out.push([performance.now() - start, v.isStarted() && !v._stopped]);
            if (performance.now() - start > 2200) { scene.onAfterRenderObservable.remove(o); resolve(out); }
        });
    }));
    let flips = samples.filter((x, i) => i > 0 && x[1] != samples[i - 1][1]).length;
    check("cycle turns the system off and on again by turns", flips >= 3, `${flips} flips in ${samples.length} frames`);
    await page.evaluate(() => document.getElementById("vapour").stop());
    await frames(70);
    let stopped = await page.evaluate(() => { const v = document.getElementById("vapour").particleSystem; return !v.isStarted() || v._stopped; });
    check("stop() ends the cycle too", stopped);

    // A change rebuilds on the part, and the old system goes.
    await page.evaluate(() => { window.__old = document.getElementById("embers").particleSystem; document.getElementById("embers").setAttribute("emitrate", "50"); });
    await page.waitForFunction(() => { const p = document.getElementById("embers").particleSystem; return p && p != window.__old; });
    s = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene, p = document.getElementById("embers").particleSystem;
        return { rate: p.emitRate, onStem: p.emitter === document.getElementById("model").getPart("stem"), oldGone: !scene.particleSystems.includes(window.__old) };
    });
    check("a changed attribute builds it again on the part, the old one gone", s.rate == 50 && s.onStem && s.oldGone, JSON.stringify(s));
});
