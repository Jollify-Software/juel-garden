// Browser test of <garden-glow> (Babylon's GlowLayer: intensity, texture-size, blur), a
// <garden-material glow-input> node material drawn into it with its own material and its glow
// input 1 only while the glow draws, <garden-material part> dressing one named part of a model,
// <garden-animation> on a material's `inputs.<name>` with `easing`, and on a model part's morph
// target (`part` + `morph` by name or index). Run after a build: npm run test:glow.
const { run } = require("./harness");
const { partsGltfUrl } = require("./fixtures/parts-gltf");

run(`
<garden-scene>
  <garden-camera type="arc" radius="6" target="1.5 0.5 0"></garden-camera>
  <garden-light></garden-light>
  <garden-glow id="glow" intensity="1.25" texture-size="256" blur="16"></garden-glow>
</garden-scene>`, async ({ page, check, frames }) => {
    const warnings = [];
    page.on("console", m => { if (m.type() == "warning") warnings.push(m.text()); });
    await page.waitForFunction(() => document.getElementById("glow").layer);
    let g = await page.evaluate(() => {
        const l = document.getElementById("glow").layer;
        return { intensity: l.intensity, size: l._options.mainTextureFixedSize, blur: l.blurKernelSize,
                 found: customElements.get("garden-glow").layerOf(document.querySelector("garden-scene").scene) === l };
    });
    check("garden-glow makes the scene's glow layer from its attributes", g.intensity == 1.25 && g.size == 256 && g.blur == 16 && g.found, JSON.stringify(g));

    // A node material made here: a texture times a tint, scaled by glowMask + strength.
    await page.evaluate(url => {
        const scene = document.querySelector("garden-scene").scene, B = BABYLON;
        const nm = new B.NodeMaterial("made-here", scene);
        const position = new B.InputBlock("position"); position.setAsAttribute("position");
        const world = new B.InputBlock("world"); world.setAsSystemValue(B.NodeMaterialSystemValues.World);
        const viewProjection = new B.InputBlock("viewProjection"); viewProjection.setAsSystemValue(B.NodeMaterialSystemValues.ViewProjection);
        const toWorld = new B.TransformBlock("toWorld"); toWorld.complementZ = 0; toWorld.complementW = 1;
        position.output.connectTo(toWorld.vector); world.output.connectTo(toWorld.transform);
        const toClip = new B.TransformBlock("toClip");
        toWorld.output.connectTo(toClip.vector); viewProjection.output.connectTo(toClip.transform);
        const vertexOut = new B.VertexOutputBlock("vertexOut"); toClip.output.connectTo(vertexOut.vector);
        const tint = new B.InputBlock("tint"); tint.value = new B.Color4(1, 0.5, 0.2, 1);
        const glowMask = new B.InputBlock("glowMask"); glowMask.value = 0;
        const strength = new B.InputBlock("strength"); strength.value = 0;
        const sum = new B.AddBlock("sum"); glowMask.output.connectTo(sum.left); strength.output.connectTo(sum.right);
        const scale = new B.ScaleBlock("scale"); tint.output.connectTo(scale.input); sum.output.connectTo(scale.factor);
        const fragmentOut = new B.FragmentOutputBlock("fragmentOut"); scale.output.connectTo(fragmentOut.rgba);
        nm.addOutputNode(vertexOut); nm.addOutputNode(fragmentOut);
        nm.build();
        const json = URL.createObjectURL(new Blob([JSON.stringify(nm.serialize())], { type: "application/json" }));
        nm.dispose();
        const holder = document.createElement("div");
        holder.innerHTML = `
          <garden-mesh-model id="model" src="${url}" extension="gltf">
            <garden-material id="mat" part="plate" glow-input="glowMask" node="${json}"></garden-material>
            <garden-animation id="ramp" target="mat" property="inputs.strength" event="load" type="float" speed="60" from="0" to="120" easing="sine-out"
                keyframes="0 0, 120 1"></garden-animation>
            <garden-animation id="byName" part="plate" morph="lift" property="influence" event="load" type="float" speed="60" from="0" to="30"
                keyframes="0 0, 30 1"></garden-animation>
            <garden-animation id="byIndex" part="plate" morph="0" property="influence" type="float" speed="60" from="0" to="1"
                keyframes="0 0.25, 1 0.25"></garden-animation>
            <garden-animation id="badEasing" part="stem" property="position.x" type="float" easing="wobbly" keyframes="0 0, 1 0"></garden-animation>
            <garden-animation id="noMorph" part="stem" morph="lift" property="influence" type="float" keyframes="0 0, 1 1"></garden-animation>
          </garden-mesh-model>`;
        document.querySelector("garden-scene").appendChild(holder.firstElementChild);
    }, partsGltfUrl());
    await page.waitForFunction(() => document.getElementById("model").getPart("plate")?.material?.getClassName?.() == "NodeMaterial", null, { timeout: 20000 });
    await frames(20);

    let s = await page.evaluate(() => {
        const model = document.getElementById("model"), mat = document.getElementById("mat");
        const plate = model.getPart("plate"), stem = model.getPart("stem");
        const layer = document.getElementById("glow").layer;
        const block = mat.material.getBlockByName("glowMask");
        return { plateNode: plate.material === mat.material, stemNode: stem.material === mat.material,
                 ownGlow: layer._useMeshMaterial(plate), stemOwn: layer._useMeshMaterial(stem), maskOutside: block.value };
    });
    check("part=\"plate\" dresses only that part", s.plateNode && !s.stemNode, JSON.stringify(s));
    check("glow-input: the part glows with its own material", s.ownGlow && !s.stemOwn, JSON.stringify(s));
    check("...and the glow input is 0 outside the glow pass", s.maskOutside === 0, JSON.stringify(s));
    let during = await page.evaluate(() => new Promise(resolve => {
        const layer = document.getElementById("glow").layer, block = document.getElementById("mat").material.getBlockByName("glowMask");
        const seen = [];
        const o = layer.onBeforeRenderMeshToEffect.add(() => seen.push(block.value));
        setTimeout(() => { layer.onBeforeRenderMeshToEffect.remove(o); resolve(seen); }, 300);
    }));
    check("...and 1 while the glow layer draws it", during.length > 0 && during.every(v => v === 1), JSON.stringify(during.slice(0, 5)));

    // inputs.strength: an eased ramp from 0 to 1 over 2 s.
    let ramp = await page.evaluate(async () => {
        const mat = document.getElementById("mat"), scene = document.querySelector("garden-scene").scene;
        const anims = scene.getAllAnimatablesByTarget(mat.animationTarget).flatMap(a => a.getAnimations().map(r => r.animation));
        const easing = anims[0]?.getEasingFunction();
        const first = mat.animationTarget.inputs.strength;
        await new Promise(r => setTimeout(r, 2500));
        return { easing: easing instanceof BABYLON.SineEase ? "SineEase" : String(easing), mode: easing?.getEasingMode(), out: BABYLON.EasingFunction.EASINGMODE_EASEOUT,
                 first, last: mat.material.getBlockByName("strength").value, sameAsProxy: mat.animationTarget.inputs.STRENGTH };
    });
    check("inputs.strength animates the input block's value", ramp.first > 0 && ramp.first < 1 && ramp.last == 1, JSON.stringify(ramp));
    check("...by any case", ramp.sameAsProxy == 1, JSON.stringify(ramp));
    check("easing=\"sine-out\" is a SineEase easing out", /Sine/.test(ramp.easing) && ramp.mode == ramp.out, JSON.stringify(ramp));

    let m = await page.evaluate(async () => {
        const plate = document.getElementById("model").getPart("plate");
        const byName = plate.morphTargetManager.getTargetByName("lift").influence;
        document.getElementById("byIndex").play(document.getElementById("model"));
        await new Promise(r => setTimeout(r, 300));
        const none = document.getElementById("noMorph").play(document.getElementById("model"));
        document.getElementById("badEasing").play(document.getElementById("model"));
        return { byName, byIndex: plate.morphTargetManager.getTarget(0).influence, none: none == null };
    });
    check("part + morph=\"lift\" animates that morph target", m.byName == 1, JSON.stringify(m));
    check("morph=\"0\" picks it by index", m.byIndex == 0.25, JSON.stringify(m));
    check("a part without that morph target warns and plays nothing", m.none && warnings.some(w => w.includes('morph="lift"')), warnings.join(" | "));
    check("an unknown easing warns", warnings.some(w => w.includes("wobbly")), warnings.join(" | "));

    // Removing the glow element takes its layer away.
    await page.evaluate(() => document.getElementById("glow").remove());
    await frames(5);
    let gone = await page.evaluate(() => customElements.get("garden-glow").layerOf(document.querySelector("garden-scene").scene) == null
        && !document.querySelector("garden-scene").scene.effectLayers.length);
    check("removing garden-glow disposes its layer", gone);
});
