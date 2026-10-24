// Browser test of <garden-torus-knot> (radius, tube, p, q) and <garden-replicate>
// taking its `instances` as plain ids as well as a JSON array, with rotations in
// degrees. Run after a build: npm run test:torus-knot-replicate.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" radius="60"></garden-camera>
  <garden-light></garden-light>
  <garden-torus-knot id="knot" radius="4" tube="1" p="3" q="2"></garden-torus-knot>
  <garden-box id="cube"></garden-box>
  <garden-replicate instances="knot cube" positions="0: 10 0 0, 1: -10 0 0" rotations="0: 0 90 0, 1: 0 0 0"></garden-replicate>
  <garden-replicate instances='["cube"]' positions="0: 0 10 0" rotations="0: 0 0 0"></garden-replicate>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.meshes.filter(m => m.name.startsWith("mesh-instance")).length >= 3);
    const r = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        const knot = document.getElementById("knot").mesh;
        const ext = knot.getBoundingInfo().boundingBox.extendSizeWorld;
        const inst = scene.meshes.filter(m => m.name.startsWith("mesh-instance")).map(m => ({ src: m.sourceMesh.element?.id, x: m.position.x, y: m.position.y, ry: +m.rotation.y.toFixed(3) }));
        return { width: +(ext.x * 2).toFixed(1), verts: knot.getTotalVertices(), inst };
    });
    check("a torus knot: its curve reaches 1.5 x radius, so 2 x (6 + 1) = 14 across", r.width == 14 && r.verts > 100, JSON.stringify({ width: r.width, verts: r.verts }));
    check("plain ids: a knot and a cube placed", r.inst.some(i => i.src == "knot" && i.x == 10) && r.inst.some(i => i.src == "cube" && i.x == -10), JSON.stringify(r.inst));
    check("rotations in degrees (90 -> pi/2)", r.inst.find(i => i.src == "knot").ry == 1.571, JSON.stringify(r.inst));
    check("a JSON array still works", r.inst.some(i => i.src == "cube" && i.y == 10), JSON.stringify(r.inst));
});
