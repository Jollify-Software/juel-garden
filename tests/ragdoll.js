// Browser test of <garden-ragdoll>: physics boxes ride an animated character's bones, `limp`
// (or limp()) makes it fall onto the floor under physics and fires garden-ragdoll, impulse()
// throws it, removing it takes its bodies away; and <garden-physics debug> draws the bodies.
// Run after a build: npm run test:ragdoll.
const { run } = require("./harness");

const bones = `
  <garden-ragdoll-bone bones="root" size="0.05"></garden-ragdoll-bone>
  <garden-ragdoll-bone bones="pelvis" size="0.25"></garden-ragdoll-bone>
  <garden-ragdoll-bone bones="spine_03" size="0.25" box-offset="0.05" rotation-axis="0 0 1" min="-1" max="1"></garden-ragdoll-bone>
  <garden-ragdoll-bone bones="upperarm_l upperarm_r" width="0.1" height="0.25" depth="0.1" box-offset="0.12" rotation-axis="0 1 0" min="-1" max="1"></garden-ragdoll-bone>
  <garden-ragdoll-bone bones="thigh_l thigh_r" width="0.12" height="0.4" depth="0.12" box-offset="0.2" rotation-axis="0 1 0" min="-1" max="1"></garden-ragdoll-bone>
  <garden-ragdoll-bone bones="calf_l calf_r" width="0.1" height="0.4" depth="0.1" box-offset="0.2" rotation-axis="0 1 0" min="-1" max="1"></garden-ragdoll-bone>
  <garden-ragdoll-bone bones="Head" size="0.25" box-offset="0.1" joint="ball"></garden-ragdoll-bone>`;

run(`
<garden-scene>
  <garden-physics debug></garden-physics>
  <garden-camera type="arc" position="0 2 -6"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="20" height="20" physics="static"></garden-ground>
  <garden-mesh-model id="a" src="/examples/assets/characters/Mannequin.glb" play="Idle_Loop" position="-1 0 0">
    <garden-ragdoll id="ra">${bones}</garden-ragdoll>
  </garden-mesh-model>
  <garden-mesh-model id="b" src="/examples/assets/characters/Mannequin.glb" play="Idle_Loop" position="1 0 0">
    <garden-ragdoll id="rb">${bones}</garden-ragdoll>
  </garden-mesh-model>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("ra").ragdoll && document.getElementById("rb").ragdoll, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    const head = (id, bone = "Head") => page.evaluate(([id, bone]) => {
        const r = document.getElementById(id).ragdoll, n = r._boneNames.indexOf(bone);
        return r.getAggregate(n).body.transformNode.getAbsolutePosition().asArray();
    }, [id, bone]);
    const s = await page.evaluate(() => ({
        boxes: document.getElementById("ra").ragdoll._aggregates.length,
        wireframes: BABYLON.UtilityLayerRenderer.DefaultUtilityLayer.utilityLayerScene.meshes.length,
    }));
    check("a box for every bone named", s.boxes == 10, JSON.stringify(s));
    check("<garden-physics debug> draws the bodies (ground and boxes)", s.wireframes >= 21, JSON.stringify(s));
    const standing = await head("ra");
    check("before it goes limp, the boxes ride the animated bones (the head box is up at head height)", standing[1] > 1.3, JSON.stringify(standing));

    await page.evaluate(() => {
        window.__limp = [];
        document.querySelector("garden-scene").addEventListener("garden-ragdoll", e => window.__limp.push(e.target.id));
        document.getElementById("ra").setAttribute("limp", "");
    });
    await page.waitForTimeout(2500);
    const fallen = await head("ra"), other = await head("rb");
    const ev = await page.evaluate(() => ({ limp: window.__limp, isLimp: document.getElementById("ra").isLimp }));
    check("limp makes it fall to the floor (and not through it)", fallen[1] < 0.6 && fallen[1] > -0.05, JSON.stringify(fallen));
    const bone = await page.evaluate(() => {
        const m = document.getElementById("a"), sk = m.skeleton, mesh = m.getScene().meshes.find(x => x.skeleton == sk);
        return sk.bones.find(b => b.name == "Head").getAbsolutePosition(mesh).asArray();
    });
    check("...and the model falls with it (its head bone is down by the head box)", Math.abs(bone[1] - fallen[1]) < 0.3, JSON.stringify(bone));
    check("...fires garden-ragdoll", ev.isLimp && ev.limp.join() == "ra", JSON.stringify(ev));
    check("the other character keeps standing", other[1] > 1.3, JSON.stringify(other));

    await page.evaluate(() => document.getElementById("rb").limp());
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById("rb").impulse("0 0 400", "pelvis"));
    await page.waitForTimeout(1500);
    const thrown = await head("rb", "pelvis");
    check("impulse() throws it", thrown[2] > 0.5, JSON.stringify(thrown));

    const bodies = await page.evaluate(() => document.querySelector("garden-physics").plugin.numBodies);
    await page.evaluate(() => document.getElementById("ra").remove());
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.querySelector("garden-physics").plugin.numBodies);
    check("removing it takes its bodies away", after == bodies - 10, `${bodies} -> ${after}`);
});
