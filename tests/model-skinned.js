// Browser test of <garden-mesh-model height/fit/base> on a skinned model whose armature is
// scaled: tests/fixtures/scaled-armature.glb is a box 0.018 tall in its own vertices under an
// armature scaled 100 (1.8 m as drawn; made by Blender). `height` must measure it as drawn,
// with the skeleton applied, not by its tiny unskinned vertices. Read back as the skinned
// bounds of the mesh after a frame. Run after a build: node tests/model-skinned.js.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 2 -6"></garden-camera>
  <garden-light></garden-light>
  <garden-mesh-model id="plain" src="/tests/fixtures/scaled-armature.glb" position="-3 0 0"></garden-mesh-model>
  <garden-mesh-model id="tall" src="/tests/fixtures/scaled-armature.glb" height="1.2" position="0 0 0"></garden-mesh-model>
  <garden-mesh-model id="fitted" src="/tests/fixtures/scaled-armature.glb" fit="3" position="3 0 0"></garden-mesh-model>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => ["plain", "tall", "fitted"].every(id => document.getElementById(id).mesh?.getChildMeshes().length)
        && document.querySelector("garden-scene").scene?.getFrameId() > 10, null, { timeout: 30000 });
    const sizes = await page.evaluate(async () => {
        const scene = document.querySelector("garden-scene").scene;
        await new Promise(r => scene.onAfterRenderObservable.addOnce(() => r()));
        const drawn = (id) => {
            const el = document.getElementById(id);
            let lo = null, hi = null;
            for (const m of el.mesh.getChildMeshes()) {
                if (!m.getTotalVertices()) continue;
                m.computeWorldMatrix(true);
                m.refreshBoundingInfo({ applySkeleton: true });
                const b = m.getBoundingInfo().boundingBox;
                lo = lo ? BABYLON.Vector3.Minimize(lo, b.minimumWorld) : b.minimumWorld.clone();
                hi = hi ? BABYLON.Vector3.Maximize(hi, b.maximumWorld) : b.maximumWorld.clone();
            }
            const s = hi.subtract(lo);
            return { x: +s.x.toFixed(3), y: +s.y.toFixed(3), z: +s.z.toFixed(3), bottom: +lo.y.toFixed(3), skinned: !!el.skeleton };
        };
        return { plain: drawn("plain"), tall: drawn("tall"), fitted: drawn("fitted") };
    });
    check("the fixture is skinned and drawn 1.8 m tall as it comes", sizes.plain.skinned && Math.abs(sizes.plain.y - 1.8) < 0.02, JSON.stringify(sizes.plain));
    check("height=\"1.2\" makes it 1.2 m tall as drawn, standing on the ground", Math.abs(sizes.tall.y - 1.2) < 0.02 && Math.abs(sizes.tall.bottom) < 0.02, JSON.stringify(sizes.tall));
    check("fit=\"3\" makes its largest side 3 m as drawn", Math.abs(Math.max(sizes.fitted.x, sizes.fitted.y, sizes.fitted.z) - 3) < 0.03, JSON.stringify(sizes.fitted));
});
