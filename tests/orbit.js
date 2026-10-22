// Browser test of the `orbit` behaviour (BehaviourOrbit): a child orbits its parent element,
// keeping its authored world-space height and radius, whether the parent is a box (mesh there at
// once) or a <garden-mesh-model> (mesh only once the file has loaded: the orbit waits for it).
// This is how Parterre's `data-orbit` platforms are emitted (VR presentations).
// Run after a build: node tests/orbit.js
const { run } = require("./harness");

const platform = (x = 5) => `<garden-cylinder orbit orbit-angle="0.02" id="p1" position="${x} 0.1 0" diameter="2" height="0.2"></garden-cylinder>`;

async function circles(page, check, label, cx = 0) {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 20, null, { timeout: 30000 });
    const at = () => page.evaluate(() => { const m = document.getElementById("p1").mesh; if (!m) return null; const p = m.getAbsolutePosition(); return [p.x, p.y, p.z]; });
    const a = await at();
    await page.waitForTimeout(2000);
    const b = await at();
    check(`${label}: the platform exists`, !!a && !!b, JSON.stringify(b));
    const moved = a && b ? Math.hypot(b[0] - a[0], b[2] - a[2]) : 0;
    check(`${label}: it moved round its parent in 2 s`, moved > 0.5, moved.toFixed(2));
    const r = b ? Math.hypot(b[0] - cx, b[2]) : 0;
    check(`${label}: keeping its 5 m radius`, Math.abs(r - 5) < 0.3, r.toFixed(2));
    check(`${label}: and its authored height (0.1), not lifted by the parent's`, !!b && Math.abs(b[1] - 0.1) < 0.01, b ? b[1].toFixed(3) : "-");
}

run(`
<garden-scene>
  <garden-camera position="0 8 -14"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="sun" position="0 1 0" width="2" height="2" depth="2">${platform()}</garden-box>
</garden-scene>`, async ({ page, check, open }) => {
    await circles(page, check, "box parent");
    await open(`
<garden-scene>
  <garden-camera position="0 8 -14"></garden-camera>
  <garden-light></garden-light>
  <garden-mesh-model id="sun" src="/examples/assets/block.gltf" position="2 0 0">${platform(7)}</garden-mesh-model>
</garden-scene>`);
    await circles(page, check, "model parent (at x 2)", 2);
});
