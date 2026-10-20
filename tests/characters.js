// Browser test of the character pieces, on Quaternius's CC0 mannequin (an Unreal-style rig):
// PoseLayer (turn, scale and rest bones over an animation, fading), waveLayer, BoneSeat (one
// model's bone kept on another's while it moves), HeldProp (upright, following the hand),
// Huddle (followers shelter behind someone from a danger, then follow again) and
// materials="standard". Run after a build: npm run test:characters.
const { run } = require("./harness");

const M = "/examples/assets/characters/Mannequin.glb";
run(`
<garden-scene>
  <garden-camera type="arc" position="0 3 -8"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="60" height="60"></garden-ground>
  <garden-mesh-model id="a" src="${M}" height="1.8" play="Idle_Loop" materials="standard" loading-screen="false"></garden-mesh-model>
  <garden-mesh-model id="b" src="${M}" height="1.2" position="3 0 0" play="Sitting_Idle_Loop" loading-screen="false"></garden-mesh-model>
  <garden-box id="leader" position="-10 0.5 0"></garden-box>
  <garden-box class="kid" position="-12 0.3 -2" width="0.4" height="0.6" depth="0.4" follow="#leader" follow-distance="2"></garden-box>
  <garden-box class="kid" position="-12 0.3 0" width="0.4" height="0.6" depth="0.4" follow="#leader" follow-distance="2"></garden-box>
  <garden-box class="kid" position="-12 0.3 2" width="0.4" height="0.6" depth="0.4" follow="#leader" follow-distance="2"></garden-box>
  <garden-box id="wolf" position="-2 0.4 0" width="0.8" height="0.8" depth="0.4"></garden-box>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("a").skeleton && document.getElementById("b").skeleton, null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const frames = (n) => page.evaluate((n) => new Promise(r => { let i = 0; const f = () => ++i >= n ? r() : requestAnimationFrame(f); f(); }), n);

    // materials="standard"
    const mats = await page.evaluate(() => {
        const a = document.getElementById("a"), b = document.getElementById("b");
        const kinds = (el) => [...new Set(el.mesh.getChildMeshes().filter(m => m.material).map(m => m.material.getClassName()))];
        return { a: kinds(a), b: kinds(b) };
    });
    check("materials=\"standard\" swaps the glTF's PBR materials", mats.a.length == 1 && mats.a[0] == "StandardMaterial" && mats.b.includes("PBRMaterial"), JSON.stringify(mats));

    // PoseLayer: scale and turn over the idle, fading in and out.
    await page.evaluate(() => {
        const a = document.getElementById("a"), scene = document.querySelector("garden-scene").scene;
        window.head = new JuelGarden.PoseLayer(scene, a.skeleton).scale("Head", 1.5);
        window.wave = JuelGarden.waveLayer(scene, a.skeleton, { side: "r" });
    });
    await frames(5);
    const head = await page.evaluate(() => JuelGarden.boneNode(document.getElementById("a").skeleton, "Head").scaling.x);
    check("PoseLayer.scale holds over the animation", Math.abs(head - 1.5) < 1e-3, String(head));
    const hand = () => page.evaluate(() => {
        const s = document.getElementById("a").skeleton;
        const h = JuelGarden.worldPosition(JuelGarden.boneNode(s, "hand_r")), top = JuelGarden.worldPosition(JuelGarden.boneNode(s, "Head"));
        const f = JuelGarden.boneNode(s, "index_02_r").rotationQuaternion;
        return { up: h.y - top.y, x: h.x, finger: [f.x, f.y, f.z, f.w].map(v => +v.toFixed(3)) };
    });
    const down = await hand();
    await page.evaluate(() => (window.wave.target = 1));
    await page.waitForTimeout(1200);
    const up1 = await hand();
    await page.waitForTimeout(230);
    const up2 = await hand();
    check("waveLayer raises the hand above the head", down.up < -0.3 && up1.up > -0.05, `${down.up.toFixed(2)} -> ${up1.up.toFixed(2)}`);
    check("…and sways it", Math.abs(up1.x - up2.x) > 0.02, `${up1.x.toFixed(3)} / ${up2.x.toFixed(3)}`);
    check("…with the hand opened from the clip's", JSON.stringify(up1.finger) != JSON.stringify(down.finger));
    await page.evaluate(() => (window.wave.target = 0));
    await page.waitForTimeout(1500);
    const lowered = await hand();
    check("target 0 lowers it again", Math.abs(lowered.up - down.up) < 0.05, `${lowered.up.toFixed(2)} vs ${down.up.toFixed(2)}`);

    // BoneSeat: the small one's pelvis on the big one's neck while the big one walks about.
    await page.evaluate(() => {
        const a = document.getElementById("a"), b = document.getElementById("b"), scene = document.querySelector("garden-scene").scene;
        window.seat = new JuelGarden.BoneSeat(scene, b.mesh, JuelGarden.boneNode(b.skeleton, "pelvis"), JuelGarden.boneNode(a.skeleton, "neck_01"),
            { offset: new BABYLON.Vector3(0, 0.1, -0.15), facing: a.mesh });
        const t0 = performance.now();
        scene.onBeforeRenderObservable.add(() => {
            const t = (performance.now() - t0) / 1000;
            a.mesh.position.x = Math.sin(t) * 2;
            a.mesh.rotation.y = t * 0.7;
            b.mesh.rotation.y = a.mesh.rotation.y;
        });
    });
    await page.waitForTimeout(1500);
    const seated = await page.evaluate(() => {
        const a = document.getElementById("a"), b = document.getElementById("b");
        const n = JuelGarden.worldPosition(JuelGarden.boneNode(a.skeleton, "neck_01")), p = JuelGarden.worldPosition(JuelGarden.boneNode(b.skeleton, "pelvis"));
        const yaw = a.mesh.rotation.y;
        const want = n.add(new BABYLON.Vector3(-0.15 * Math.sin(yaw), 0.1, -0.15 * Math.cos(yaw)));
        return BABYLON.Vector3.Distance(want, p);
    });
    check("BoneSeat keeps one model's bone on another's as it moves and turns", seated < 0.03, seated.toFixed(3));
    await page.evaluate(() => window.seat.dispose());

    // HeldProp: a staff upright in the hand.
    const held = await page.evaluate(async () => {
        const a = document.getElementById("a"), scene = document.querySelector("garden-scene").scene;
        const staff = BABYLON.MeshBuilder.CreateCylinder("staff", { height: 1.9, diameter: 0.04 }, scene);
        staff.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0.95, 0));
        new JuelGarden.HeldProp(scene, staff, JuelGarden.boneNode(a.skeleton, "hand_r"), a.mesh, { grip: 1.0 });
        await new Promise(r => setTimeout(r, 400));
        const h = JuelGarden.worldPosition(JuelGarden.boneNode(a.skeleton, "hand_r"));
        const up = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Up(), staff.getWorldMatrix());
        return { gap: Math.hypot(staff.position.x - h.x, staff.position.z - h.z), drop: h.y - staff.position.y, upright: up.normalize().y };
    });
    check("HeldProp follows the hand", held.gap < 0.03 && Math.abs(held.drop - 1.0) < 0.03, JSON.stringify(held));
    check("…standing upright", held.upright > 0.999, held.upright.toFixed(4));

    // Huddle: the followers shelter behind the leader, away from the wolf, then follow again.
    await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        window.changes = 0;
        window.huddle = new JuelGarden.Huddle(scene, [...document.querySelectorAll(".kid")], {
            centre: document.getElementById("leader").mesh, danger: document.getElementById("wolf").mesh,
            onChange: (el, i, settled) => settled && window.changes++,
        });
    });
    await page.waitForTimeout(2500);
    const sheltered = await page.evaluate(() => {
        const L = document.getElementById("leader").mesh.position, W = document.getElementById("wolf").mesh.position;
        return [...document.querySelectorAll(".kid")].map(k => {
            const p = k.mesh.position;
            const behind = (p.x - L.x) * (L.x - W.x) + (p.z - L.z) * (L.z - W.z) > 0;
            const facing = Math.atan2(W.x - p.x, W.z - p.z), yaw = k.mesh.rotation.y;
            return { behind, faces: Math.abs(Math.atan2(Math.sin(facing - yaw), Math.cos(facing - yaw))) < 0.3, waiting: k.waiting };
        });
    });
    check("Huddle: they shelter behind the leader, away from the danger", sheltered.every(s => s.behind), JSON.stringify(sheltered));
    check("…turn to watch it, paused (waiting)", sheltered.every(s => s.faces && s.waiting), JSON.stringify(sheltered));
    check("…and say when each has settled", (await page.evaluate(() => window.changes)) == 3);
    await page.evaluate(() => { window.huddle.end(); document.getElementById("leader").mesh.position.set(-10, 0.5, 12); });
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => [...document.querySelectorAll(".kid")].map(k => +k.mesh.position.z.toFixed(1)));
    check("end() lets them follow again", after.every(z => z > 6), JSON.stringify(after));
});
