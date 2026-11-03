// Browser test of precompile(): the first stage compiles only the meshes asked for, the second
// the rest (with an instanced mesh's instanced shader); and the rule it documents holds: a
// light added after a mesh has rendered compiles its shader again, while one made before the
// first frame costs nothing later. Also toPBRMaterials's vertexColours option. Run after a
// build: npm run test:precompile.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 6 -12"></garden-camera>
  <garden-light></garden-light>
  <garden-ground id="g" width="20" height="20"></garden-ground>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("g").mesh, null, { timeout: 30000 });
    await frames(5);

    const made = await page.evaluate(async () => {
        const scene = document.querySelector("garden-scene").scene;
        window.scene = scene;
        // Three PBR boxes, two materials, one of them instanced; all made at once, none rendered yet.
        const mat = (name, colour) => { const m = new BABYLON.PBRMaterial(name, scene); m.albedoColor = colour; m.roughness = 0.8; return m; };
        const a = BABYLON.MeshBuilder.CreateBox("a", { size: 1 }, scene); a.position.set(-3, 0.5, 0); a.material = mat("red", new BABYLON.Color3(1, 0, 0));
        const b = BABYLON.MeshBuilder.CreateBox("b", { size: 1 }, scene); b.position.set(0, 0.5, 0); b.material = mat("green", new BABYLON.Color3(0, 1, 0));
        // A different shader from the red one (the same defines share one compiled effect).
        b.material.sheen.isEnabled = true;
        const c = BABYLON.MeshBuilder.CreateBox("c", { size: 1 }, scene); c.position.set(3, 0.5, 0); c.material = b.material;
        for (let i = 0; i < 3; i++) { const inst = c.createInstance("c" + i); inst.position.set(3, 1.5 + i, 0); }
        // Out of the camera's view, so only precompile compiles them (what is in view compiles as it renders).
        for (const m of [a, b, c, ...c.instances]) m.position.y = -50;
        const before = JuelGarden.compiledEffectCount(scene);
        const shaders = JuelGarden.precompile(scene, { first: m => m.name == "a" || m.name == "g" });
        await shaders.first;
        const afterFirst = JuelGarden.compiledEffectCount(scene);
        const aReady = a.material.isReadyForSubMesh(a, a.subMeshes[0]);
        const bReady = b.material.isReadyForSubMesh(b, b.subMeshes[0]);
        const cReady = c.material.isReadyForSubMesh(c, c.subMeshes[0], true);
        await shaders.all;
        const afterAll = JuelGarden.compiledEffectCount(scene);
        const bReadyAfter = b.material.isReadyForSubMesh(b, b.subMeshes[0]);
        const cReadyAfter = c.material.isReadyForSubMesh(c, c.subMeshes[0], true);
        return { counts: shaders.counts, before, afterFirst, afterAll, aReady, bReady, cReady, bReadyAfter, cReadyAfter, isReady: scene.isReady() };
    });
    check("the first stage compiles the meshes asked for, and not the rest", made.counts.first == 2 && made.aReady && !made.bReady && !made.cReady && made.afterFirst > made.before, JSON.stringify(made));
    // (Asking isReadyForSubMesh above already started their compiles, so the count doesn't grow here.)
    check("the second compiles the rest, with the instanced shader (instances aren't counted)", made.counts.rest == 2 && made.afterAll >= made.afterFirst && made.bReadyAfter && made.cReadyAfter && made.isReady, JSON.stringify(made));

    // The rule: a light added after a render recompiles; a mesh made after the lights exist
    // compiles once and stays compiled.
    const rule = await page.evaluate(async () => {
        const a = scene.getMeshByName("a");
        const n0 = JuelGarden.compiledEffectCount(scene);
        await new Promise(r => setTimeout(r, 200));
        const steady = JuelGarden.compiledEffectCount(scene) == n0;
        new BABYLON.PointLight("late", new BABYLON.Vector3(0, 4, 0), scene);
        await a.material.forceCompilationAsync(a);
        const n1 = JuelGarden.compiledEffectCount(scene);
        return { steady, recompiled: n1 > n0 };
    });
    check("shaders stay compiled when nothing changes", rule.steady, JSON.stringify(rule));
    check("a light added after a render compiles the shader again (the rule the doc states)", rule.recompiled, JSON.stringify(rule));

    // toPBRMaterials: vertexColours false drops the VERTEXCOLOR variant.
    const colours = await page.evaluate(async () => {
        const d = BABYLON.MeshBuilder.CreateBox("d", { size: 1 }, scene);
        d.position.set(0, 2.5, 0);
        const colour = new Float32Array(d.getTotalVertices() * 4).fill(1);
        d.setVerticesData(BABYLON.VertexBuffer.ColorKind, colour);
        d.material = new BABYLON.PBRMaterial("white", scene);
        const n0 = JuelGarden.compiledEffectCount(scene);
        JuelGarden.toPBRMaterials([d], scene, { vertexColours: false });
        await d.material.forceCompilationAsync(d);
        const key = Object.keys(scene.getEngine()._compiledEffects).find(k => k.includes("MATERIALPLUGIN") && !/VERTEXCOLOR/.test(k) && k.includes("ALBEDODIRECTUV 0"));
        return { used: d.useVertexColors, compiled: JuelGarden.compiledEffectCount(scene) > n0, noColourVariant: !!key };
    });
    check("toPBRMaterials vertexColours:false switches a mesh's vertex colours off", colours.used === false && colours.compiled && colours.noColourVariant, JSON.stringify(colours));
});
