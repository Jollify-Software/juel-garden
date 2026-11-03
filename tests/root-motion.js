// Browser test of root motion on <garden-mesh-model>: with `root-motion`, a clip's travel moves
// the model's node while the pose plays in place, so a planted foot stays put on the ground;
// without it the model stays where it is and the foot slides back under it. Also: the measured
// stride (`rootMotionOf`), a turned model walking its own way, the attribute taken off live, a
// clip whose root carries the travel (RobotExpressive's "Standing") played in place, and
// `anim-walk-speed="auto"`. Uses Mannequin and RobotExpressive. Run after a build:
// npm run test:root-motion.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 3 -8"></garden-camera>
  <garden-light></garden-light>
  <garden-mesh-model id="on" src="/examples/assets/characters/Mannequin.glb" height="1.8" loading-screen="false"
      root-motion play="Walk_Loop" blend="0"></garden-mesh-model>
  <garden-mesh-model id="off" src="/examples/assets/characters/Mannequin.glb" height="1.8" position="3 0 0" loading-screen="false"
      play="Walk_Loop" blend="0"></garden-mesh-model>
  <garden-mesh-model id="turned" src="/examples/assets/characters/Mannequin.glb" height="1.8" position="-3 0 0" rotation="0 90 0"
      loading-screen="false" root-motion play="Walk_Loop" blend="0"></garden-mesh-model>
  <garden-mesh-model id="robot" src="/examples/assets/characters/RobotExpressive.glb" height="1.8" position="6 0 0" loading-screen="false"
      root-motion play="Idle" blend="0"></garden-mesh-model>
  <garden-mesh-model id="auto" src="/examples/assets/characters/Mannequin.glb" height="1.8" position="-6 0 0" loading-screen="false"
      anim-idle="Idle_Loop" anim-walk="Walk_Loop" anim-walk-speed="auto"></garden-mesh-model>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => ["on", "off", "turned", "robot", "auto"].every(id => document.getElementById(id).clipsBuilt), null, { timeout: 30000 });

    const clip = await page.evaluate(() => {
        const c = on.rootMotionOf("walk_loop");
        return { source: c.source, distance: c.cycleDistance, duration: c.duration, speed: c.speed,
            direction: c.direction.asArray(), contacts: c.contactNodes.length, inPlace: c.inPlace == c.group };
    });
    check("rootMotionOf: the walk's travel deduced from its feet", clip.source == "contact" && clip.contacts >= 2 && clip.inPlace, JSON.stringify(clip));
    check("a stride of a plausible length, straight ahead", clip.distance > 0.6 && clip.distance < 2.5 && Math.abs(clip.direction[2]) > 0.99,
        `${clip.distance.toFixed(3)} in ${clip.duration.toFixed(2)} s`);
    check("rootMotionOf: no such animation is null", await page.evaluate(() => on.rootMotionOf("nothing") === null));

    // Follows the models for a while: where each node is, where its hips are in its own space,
    // and how far the lowest foot moves on the ground (in the world) while it stays the lowest.
    const watch = () => page.evaluate(() => new Promise(resolve => {
        const scene = document.querySelector("garden-scene").scene;
        const ids = ["on", "off", "turned"];
        const feet = {}, hips = {}, start = {}, data = {};
        for (const id of ids) {
            const m = document.getElementById(id), c = m.rootMotionOf("Walk_Loop");
            feet[id] = c.contactNodes;
            hips[id] = c.rootNode;
            start[id] = m.mesh.position.clone();
            data[id] = { slide: 0, planted: 0, hips: 0, last: null };
        }
        const t0 = performance.now();
        let frame = 0;
        const o = scene.onAfterRenderObservable.add(() => {
            frame++;
            for (const id of ids) {
                const m = document.getElementById(id), d = data[id];
                let lowest = null;
                for (const f of feet[id]) if (!lowest || f.absolutePosition.y < lowest.absolutePosition.y) lowest = f;
                const p = lowest.absolutePosition;
                if (d.last && d.last.node == lowest) { d.slide += Math.hypot(p.x - d.last.x, p.z - d.last.z); d.planted++; }
                d.last = { node: lowest, x: p.x, z: p.z };
                const local = BABYLON.Vector3.TransformCoordinates(hips[id].absolutePosition, m.mesh.getWorldMatrix().clone().invert());
                d.hips = Math.max(d.hips, Math.hypot(local.x, local.z));
            }
            if (frame < 150) return;
            scene.onAfterRenderObservable.remove(o);
            const out = { seconds: (performance.now() - t0) / 1000 };
            for (const id of ids) {
                const p = document.getElementById(id).mesh.position;
                out[id] = { dx: p.x - start[id].x, dz: p.z - start[id].z, slide: data[id].slide / Math.max(1, data[id].planted), hips: data[id].hips };
            }
            resolve(out);
        });
    }));
    const w = await watch();
    const moved = Math.hypot(w.on.dx, w.on.dz), expected = clip.speed * w.seconds;
    check("root-motion: the node walks at about the clip's measured speed", Math.abs(moved - expected) < 0.25 * expected,
        `moved ${moved.toFixed(2)}, expected about ${expected.toFixed(2)} in ${w.seconds.toFixed(2)} s`);
    check("root-motion: straight ahead (the model's +z)", Math.abs(w.on.dx) < 0.05 * moved && w.on.dz > 0, JSON.stringify(w.on));
    check("root-motion: the hips stay over the node (the pose plays in place)", w.on.hips < 0.3, w.on.hips.toFixed(3));
    check("without root-motion the model stays where it is", Math.hypot(w.off.dx, w.off.dz) < 1e-6, JSON.stringify(w.off));
    check("the planted foot slides far less with root motion than without", w.on.slide < 0.35 * w.off.slide,
        `per frame: on ${(w.on.slide * 1000).toFixed(1)} mm, off ${(w.off.slide * 1000).toFixed(1)} mm`);
    const turnedMoved = Math.hypot(w.turned.dx, w.turned.dz);
    check("a model turned 90 degrees walks its own way (+x)", w.turned.dx > 0.9 * turnedMoved && turnedMoved > 0.5 * moved, JSON.stringify(w.turned));

    // Off, live: the model stops where it is, the walk carries on.
    const before = await page.evaluate(() => { on.removeAttribute("root-motion"); return on.mesh.position.z; });
    await frames(30);
    const after = await page.evaluate(() => ({ z: on.mesh.position.z, playing: on.mixer.group("Walk_Loop").isPlaying, current: on.mixer.current }));
    check("root-motion taken off: the model stops, still walking on the spot", Math.abs(after.z - before) < 0.02 && after.playing && after.current == "Walk_Loop", JSON.stringify(after));
    await page.evaluate(() => on.setAttribute("root-motion", ""));
    const z1 = await page.evaluate(() => on.mesh.position.z);
    await frames(30);
    const z2 = await page.evaluate(() => on.mesh.position.z);
    check("put back: it walks on from there", z2 - z1 > 0.2, `${z1.toFixed(2)} -> ${z2.toFixed(2)}`);

    // A clip whose root carries the travel: measured from the root, played in place, the node moved instead.
    const standing = await page.evaluate(async () => {
        const c = robot.rootMotionOf("Standing");
        const group = robot.mixer.group("Standing");
        const hips = c.rootNode;
        const local = () => BABYLON.Vector3.TransformCoordinates(hips.absolutePosition, robot.mesh.getWorldMatrix().clone().invert());
        const start = robot.mesh.position.clone();
        // The hips in the model's space while it plays (from its first frame: Idle's pose is elsewhere).
        let low = Infinity, high = -Infinity;
        const scene = robot.mesh.getScene();
        const o = scene.onAfterRenderObservable.add(() => {
            if (!group.isPlaying) return;
            const z = local().z;
            low = Math.min(low, z);
            high = Math.max(high, z);
        });
        await robot.playOnce("Standing", { blend: 0 });
        scene.onAfterRenderObservable.remove(o);
        const end = robot.mesh.position;
        return { source: c.source, distance: c.cycleDistance, swapped: group == c.inPlace && c.inPlace != c.group,
            moved: Math.hypot(end.x - start.x, end.z - start.z), hips: high - low };
    });
    check("a root clip: measured from the root's own travel", standing.source == "root" && standing.distance > 0.1, JSON.stringify(standing));
    check("a root clip: the mixer plays its in-place copy", standing.swapped);
    check("a root clip: the node moves by the root's travel", Math.abs(standing.moved - standing.distance) < 0.25 * standing.distance, JSON.stringify(standing));
    check("a root clip: the hips don't travel in the model's space", standing.hips < 0.25 * standing.distance, JSON.stringify(standing));

    // anim-walk-speed="auto": moved at the clip's own speed, the walk plays at speed 1.
    const auto = await page.evaluate(() => new Promise(resolve => {
        const scene = document.querySelector("garden-scene").scene;
        const speed = window.auto.rootMotionOf("Walk_Loop").speed;
        let t = 0;
        const o = scene.onBeforeRenderObservable.add(() => {
            const dt = Math.min(scene.getEngine().getDeltaTime(), 50) / 1000;
            window.auto.mesh.position.z += speed * dt;
            if ((t += dt) < 1.5) return;
            scene.onBeforeRenderObservable.remove(o);
            const g = window.auto.mixer.group("Walk_Loop");
            resolve({ speed, current: window.auto.mixer.current, ratio: g.speedRatio });
        });
    }));
    check("anim-walk-speed=\"auto\": moved at the clip's speed, the walk plays at about 1", auto.current == "Walk_Loop" && Math.abs(auto.ratio - 1) < 0.2, JSON.stringify(auto));
});
