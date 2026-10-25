// Browser test of blended and added animations on <garden-mesh-model>: weights="..." plays
// several at once (live, fading over `blend`, `sync` keeping them in step), play="..." changed
// later cross-fades instead of reloading, a .babylon file's skeleton ranges are animations
// (frames as keyed matrices, interpolated), and <garden-clip> cuts one by frame and retargets
// one from another file. Uses RobotExpressive, Mannequin and tests/fixtures/ranges.babylon.
// Run after a build: npm run test:animation-blending.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 3 -8"></garden-camera>
  <garden-light></garden-light>
  <garden-mesh-model id="robot" src="/examples/assets/characters/RobotExpressive.glb" height="1.8" loading-screen="false"
      weights="Idle 1, Walking 0, Running 0" blend="0">
    <garden-clip id="nod" name="Nod" group="Idle" from="0" to="10"></garden-clip>
  </garden-mesh-model>
  <garden-mesh-model id="rig" src="/tests/fixtures/ranges.babylon" play="up" position="3 0 0" loading-screen="false">
    <garden-clip name="slide" from="60" to="90"></garden-clip>
  </garden-mesh-model>
  <garden-mesh-model id="man" src="/examples/assets/characters/Mannequin.glb" position="-3 0 0" loading-screen="false" play="moved">
    <garden-clip id="moved" name="moved" src="/examples/assets/characters/Mannequin.glb"></garden-clip>
  </garden-mesh-model>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => ["robot", "rig", "man"].every(id => document.getElementById(id).clipsBuilt), null, { timeout: 30000 });
    const state = (id = "robot") => page.evaluate(id => {
        const m = document.getElementById(id).mixer;
        const w = {};
        for (const name of m.names) { const g = m.group(name); w[name] = g.isPlaying ? +g.weight.toFixed(2) : "stopped"; }
        return { current: m.current, w };
    }, id);

    let s = await state();
    check("weights=\"...\" plays all three at once, idle at full weight", s.w.Idle == 1 && s.w.Walking == 0 && s.w.Running == 0, JSON.stringify(s));
    check("an animation not named stays stopped", s.w.Wave == "stopped");

    // Live: a new weights attribute fades over `blend`.
    await page.evaluate(() => { robot.setAttribute("blend", "0.8"); robot.setAttribute("sync", "Walking"); robot.setAttribute("weights", "Idle 0, Walking 0.5, Running 0.5"); });
    await page.waitForTimeout(350);
    s = await state();
    check("changed weights fade (mid-way)", s.w.Idle > 0.1 && s.w.Idle < 0.9 && s.w.Walking > 0.05 && s.w.Walking < 0.5, JSON.stringify(s));
    await page.waitForTimeout(800);
    s = await state();
    check("after the blend: walk and run half each, idle kept running at 0", s.w.Walking == 0.5 && s.w.Running == 0.5 && s.w.Idle == 0, JSON.stringify(s));
    const sync = await page.evaluate(() => {
        const m = robot.mixer, walk = m.group("Walking").animatables[0], run = m.group("Running").animatables[0];
        const p = a => (a.masterFrame - a.fromFrame) / (a.toFrame - a.fromFrame);
        return { root: run.syncRoot == walk, walkFree: !walk.syncRoot, walk: +p(walk).toFixed(2), run: +p(run).toFixed(2) };
    });
    check("sync: run follows walk's place in its cycle", sync.root && sync.walkFree, JSON.stringify(sync));
    await frames(3);
    const phase = await page.evaluate(() => {
        const m = robot.mixer, walk = m.group("Walking"), run = m.group("Running");
        const p = g => { const r = g.animatables[0].getAnimations()[0]; return (r.currentFrame - g.from) / (g.to - g.from); };
        return { walk: +p(walk).toFixed(2), run: +p(run).toFixed(2) };
    });
    check("in step: both are the same way through their (different) cycles", Math.abs(phase.walk - phase.run) < 0.05, JSON.stringify(phase));

    // Live play: removing weights and setting play cross-fades to one animation.
    await page.evaluate(() => { robot.removeAttribute("weights"); robot.setAttribute("blend", "0.3"); robot.setAttribute("play", "Wave"); });
    await page.waitForTimeout(700);
    s = await state();
    check("play=\"...\" set later cross-fades to it, the mix stops", s.current == "Wave" && s.w.Wave == 1 && s.w.Walking == "stopped" && s.w.Idle == "stopped", JSON.stringify(s));
    check("changing play doesn't reload the model", await page.evaluate(() => robot.animationGroups.length > 5 && !!robot.mixer.group("Nod")));

    // From code: setWeights with no blend.
    await page.evaluate(() => robot.setWeights({ Idle: 0.25, Running: 0.75 }, { blend: 0 }));
    s = await state();
    check("setWeights() from code", s.w.Idle == 0.25 && s.w.Running == 0.75 && s.w.Wave == "stopped", JSON.stringify(s));

    // <garden-clip> cut by frame from a named group.
    const nod = await page.evaluate(() => { const g = robot.mixer.group("Nod"); return { from: g.from, to: g.to }; });
    check("<garden-clip group from to> cuts frames 0-10 of Idle", nod.from == 0 && nod.to == 10, JSON.stringify(nod));
    await page.evaluate(() => document.getElementById("nod").setAttribute("to", "20"));
    await page.waitForFunction(() => robot.mixer.group("Nod")?.to == 20, null, { timeout: 5000 }).catch(() => {});
    check("a clip changed later is built again", await page.evaluate(() => robot.mixer.group("Nod")?.to == 20));
    await page.evaluate(() => document.getElementById("nod").remove());
    await frames(2);
    check("a clip removed leaves the model", await page.evaluate(() => !robot.mixer.group("Nod") && !robot.animationGroups.some(g => g.name == "Nod")));

    // .babylon skeleton ranges, and a clip of its single take.
    const rig = await page.evaluate(() => {
        const m = rig.mixer;
        return { names: m.names, up: [m.group("up").from, m.group("up").to], current: m.current, slide: [m.group("slide").from, m.group("slide").to] };
    });
    check("a .babylon file's skeleton ranges are named animations", rig.names.includes("up") && rig.names.includes("down") && rig.up.join() == "0,30" && rig.current == "up", JSON.stringify(rig));
    check("<garden-clip from to> cuts the skeleton's take", rig.slide.join() == "60,90", JSON.stringify(rig));
    const ys = await page.evaluate(async () => {
        const bone = rig.skeleton.bones[0], scene = rig.getScene(), out = [];
        for (let i = 0; i < 6; i++) {
            await new Promise(r => scene.onAfterRenderObservable.addOnce(r));
            out.push(+bone.getLocalMatrix().m[13].toFixed(3));
        }
        return out;
    });
    check("the range plays, matrices interpolated between keys (0 to 1 over 30 frames)",
        ys.some(y => y > 0.01 && y < 0.99) && new Set(ys).size > 2, ys.join(","));
    await page.evaluate(() => rig.setAttribute("play", "slide"));
    await page.waitForTimeout(1500);
    const x = await page.evaluate(() => rig.skeleton.bones[0].getLocalMatrix().m[12]);
    check("the cut clip plays its frames (the bone slides in x)", x > 0.05, x.toFixed(3));

    // Retargeted from another file (here the same rig, loaded again beside the scene).
    const man = await page.evaluate(() => {
        const g = man.mixer.group("moved");
        const targets = g?.targetedAnimations.map(t => t.target) ?? [];
        const own = new Set(man.mesh.getDescendants(false));
        return { playing: g?.isPlaying, current: man.mixer.current, count: targets.length,
            onModel: targets.length > 0 && targets.every(t => own.has(t) || t.getClassName?.() == "Bone"),
            // Meshes of no element's: what the clip's file would leave behind.
            leftovers: man.getScene().meshes.filter(m => { for (let n = m; n; n = n.parent) if (n.element) return false; return !/^Background/.test(m.name); }).map(m => m.name) };
    });
    check("<garden-clip src> retargets another file's animation onto the model and plays it",
        man.playing && man.current == "moved" && man.count > 10 && man.onModel, JSON.stringify(man));
    check("the clip's file leaves nothing in the scene", man.leftovers.length == 0, JSON.stringify(man.leftovers));
});
