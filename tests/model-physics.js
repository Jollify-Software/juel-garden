// Browser test of `physics` on a <garden-mesh-model>: the body's shape is the whole model's, as
// scaled -- a convex hull by default for a dynamic one, a box with physics-shape="box", its
// triangles for a static one -- so a model lands on its own base and things land on it.
// The fixture (examples/assets/block.gltf) is a 2 x 4 x 2 box whose base is 1 unit above its
// origin. Run after a build: npm run test:model-physics.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics></garden-physics>
  <garden-camera type="arc" position="0 6 -20"></garden-camera>
  <garden-light></garden-light>
  <garden-ground id="floor" width="30" height="30" physics="static"></garden-ground>
  <!-- Half size: 1 x 2 x 1, its base 0.5 above the element's position. -->
  <garden-mesh-model id="hull" src="/examples/assets/block.gltf" scale="0.5 0.5 0.5" position="-4 5 0" physics loading-screen="false"></garden-mesh-model>
  <garden-mesh-model id="crate" src="/examples/assets/block.gltf" scale="0.5 0.5 0.5" position="0 5 0" physics physics-shape="box" loading-screen="false"></garden-mesh-model>
  <!-- A static one, its triangles; a ball dropped on it rests on its top (y 0.5 + 2 = 2.5). -->
  <garden-mesh-model id="plinth" src="/examples/assets/block.gltf" scale="0.5 0.5 0.5" position="4 0 0" physics="static" loading-screen="false"></garden-mesh-model>
  <garden-sphere id="ball" physics diameter="0.5" position="4 6 0"></garden-sphere>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => ["hull", "crate", "plinth", "ball"].every(id => document.getElementById(id).physicsAggregate), null, { timeout: 20000 });
    const shapes = await page.evaluate(() => {
        const box = id => { const b = document.getElementById(id).physicsAggregate.shape.getBoundingBox(); return [b.minimum.asArray(), b.maximum.asArray()].map(v => v.map(n => +n.toFixed(2))); };
        return { hull: box("hull"), crate: box("crate"), plinth: box("plinth"), types: ["hull", "crate", "plinth"].map(id => document.getElementById(id).physicsAggregate.shape.type) };
    });
    // Shape space is the holder's, scale baked in: x and z -0.5..0.5, y 0.5..2.5.
    const fits = b => Math.abs(b[0][0] + 0.5) < 0.05 && Math.abs(b[1][0] - 0.5) < 0.05 && Math.abs(b[0][1] - 0.5) < 0.05 && Math.abs(b[1][1] - 2.5) < 0.05;
    check("a dynamic model's default shape is a convex hull round the whole (scaled) model", shapes.types[0] == 4 && fits(shapes.hull), JSON.stringify(shapes));
    check("physics-shape=\"box\" on a model is a box round it", shapes.types[1] == 3 && fits(shapes.crate), JSON.stringify(shapes));
    check("a static model's default shape is its triangles", shapes.types[2] == 6 && fits(shapes.plinth), JSON.stringify(shapes));

    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => {
        const bottom = id => +document.getElementById(id).mesh.getHierarchyBoundingVectors(true).min.y.toFixed(2);
        return { hull: bottom("hull"), crate: bottom("crate"), ball: +document.getElementById("ball").mesh.getAbsolutePosition().y.toFixed(2) };
    });
    check("a model with a hull lands on its own base", Math.abs(s.hull) < 0.05, JSON.stringify(s));
    check("a model with a box lands on its own base", Math.abs(s.crate) < 0.05, JSON.stringify(s));
    check("a ball rests on a static model's top", Math.abs(s.ball - 2.75) < 0.05, JSON.stringify(s));

    // Removed: the body (and the shape the model's body was given) go.
    const gone = await page.evaluate(async () => {
        const el = document.getElementById("hull"), shape = el.physicsAggregate.shape;
        el.removePhysics();
        return { body: el.physicsAggregate, disposed: shape._pluginData == null || shape.isDisposed === true || shape._isDisposed === true };
    });
    check("removePhysics disposes a model's shape too", gone.body == null, JSON.stringify(gone));
});
