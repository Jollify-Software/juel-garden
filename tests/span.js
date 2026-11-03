// Browser test of `span` (a mesh kept between two elements: a pendulum's rod) and garden-line's
// `colour`: the rod sits halfway between a swinging bob and its pivot with its y axis along them,
// `span-stretch` makes it reach from one to the other, and a line takes its colour.
// Run after a build: npm run test:span.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics gravity="0 -10 0"></garden-physics>
  <garden-camera type="arc" position="-20 0 0"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="pivot" physics="static" size="1" position="0 1 0"></garden-box>
  <garden-sphere id="bob" physics diameter="1" position="0 1 -2"></garden-sphere>
  <garden-joint type="distance" between="#bob #pivot" max-distance="3"></garden-joint>
  <garden-cylinder id="rod" span="#pivot #bob" height="3" diameter="0.1"></garden-cylinder>
  <garden-cylinder id="rope" span="#pivot #bob" span-stretch height="1" diameter="0.05"></garden-cylinder>
  <garden-line id="ray" points="0 0 0, 1 0 0" colour="#ffff00"></garden-line>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("bob").physicsAggregate);
    const samples = [];
    for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(400);
        samples.push(await page.evaluate(() => {
            const p = id => document.getElementById(id).mesh.getAbsolutePosition();
            const a = p("pivot"), b = p("bob"), rod = document.getElementById("rod").mesh;
            const up = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 1, 0), rod.computeWorldMatrix(true)).normalize();
            const along = b.subtract(a).normalize();
            return {
                mid: BABYLON.Vector3.Distance(rod.getAbsolutePosition(), a.add(b).scale(0.5)),
                aligned: Math.abs(BABYLON.Vector3.Dot(up, along)),
                length: BABYLON.Vector3.Distance(a, b),
                rope: document.getElementById("rope").mesh.scaling.y,
                bobY: b.y,
            };
        }));
    }
    const ys = samples.map(s => s.bobY), moved = Math.max(...ys) - Math.min(...ys) > 0.05;
    check("the bob swings", moved, JSON.stringify(samples));
    check("the rod stays halfway between pivot and bob", samples.every(s => s.mid < 0.05), JSON.stringify(samples));
    check("the rod's y axis lies along them", samples.every(s => s.aligned > 0.999), JSON.stringify(samples));
    check("span-stretch scales a 1-unit mesh to reach between them", samples.every(s => Math.abs(s.rope - s.length) < 0.05), JSON.stringify(samples));

    const colour = await page.evaluate(() => document.getElementById("ray").mesh.color.asArray());
    check("a garden-line takes its colour", colour.join() == "1,1,0", JSON.stringify(colour));
});
