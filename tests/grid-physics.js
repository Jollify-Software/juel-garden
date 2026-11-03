// Browser test of a physics grid's extras: instance-rotations turns each copy (a list taken in turn,
// or random), a physics grid is always drawn (its bounds don't follow the copies), impulse(v, point,
// instance) pushes one copy, and collision reports are opt-in for a grid (collide-events) and can be
// turned off on a body (collide-events="false"). Run after a build: npm run test:grid-physics.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics></garden-physics>
  <garden-camera type="arc" position="0 8 -24"></garden-camera>
  <garden-light></garden-light>
  <garden-ground id="floor" width="40" height="40" physics="static"></garden-ground>
  <garden-box id="turned" size="1" position="-6 3 0" grid="3 1 1" grid-spacing="2 2 2" instance-rotations="0 90 0, 45 0 0"></garden-box>
  <garden-box id="heap" size="1" position="0 0.5 0" grid="3 1 1" grid-spacing="2 1 1" instance-rotations="random" physics mass="1"></garden-box>
  <garden-box id="noisy" size="1" position="0 0.5 6" grid="2 1 1" grid-spacing="2 1 1" physics collide-events></garden-box>
  <garden-sphere id="quiet" diameter="1" position="6 3 0" physics collide-events="false"></garden-sphere>
  <garden-sphere id="ball" diameter="1" position="8 3 0" physics></garden-sphere>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => ["heap", "noisy", "quiet", "ball"].every(id => document.getElementById(id).physicsAggregate));
    const s = await page.evaluate(() => {
        const turn = (id, i) => {
            const q = new BABYLON.Quaternion();
            document.getElementById(id).mesh.thinInstanceGetWorldMatrices()[i].decompose(undefined, q);
            return q.toEulerAngles().asArray().map(n => Math.round(n * 180 / Math.PI));
        };
        const heap = document.getElementById("heap").mesh;
        return {
            turned: [0, 1, 2].map(i => turn("turned", i)),
            third: Array.from(document.getElementById("turned").mesh.thinInstanceGetWorldMatrices()[2].getTranslation().asArray()),
            heapTurned: [0, 1, 2].some(i => turn("heap", i).some(n => n != 0)),
            always: heap.alwaysSelectAsActiveMesh,
            plainAlways: document.getElementById("turned").mesh.alwaysSelectAsActiveMesh,
            callbacks: ["heap", "noisy", "quiet", "ball"].map(id => document.getElementById(id).physicsAggregate.body.getCollisionObservable().hasObservers()),
        };
    });
    check("instance-rotations are taken in turn (degrees, x y z)", JSON.stringify(s.turned) == JSON.stringify([[0, 90, 0], [45, 0, 0], [0, 90, 0]]), JSON.stringify(s.turned));
    check("a turned copy stays where the grid puts it (4 m along x from the first)", s.third.map(n => +n.toFixed(2)).join() == "4,0,0", JSON.stringify(s.third));
    check("instance-rotations=\"random\" turns the copies", s.heapTurned, JSON.stringify(s));
    check("a physics grid is always drawn; a plain one is culled as usual", s.always && !s.plainAlways, JSON.stringify(s));
    check("collision reports: off for a grid unless collide-events, off with collide-events=\"false\", on by default",
        JSON.stringify(s.callbacks) == "[false,true,false,true]", JSON.stringify(s.callbacks));

    await page.waitForTimeout(1500);
    const kick = await page.evaluate(async () => {
        const el = document.getElementById("heap");
        const ys = () => [0, 1, 2].map(i => el.constructor.copyPlace(el.mesh, i).y);
        const before = ys();
        el.impulse("0 6 0", undefined, 1);
        await new Promise(r => setTimeout(r, 250));
        const after = ys();
        return { before, after };
    });
    check("impulse(v, point, instance) pushes only that copy", kick.after[1] - kick.before[1] > 0.5 &&
        Math.abs(kick.after[0] - kick.before[0]) < 0.1 && Math.abs(kick.after[2] - kick.before[2]) < 0.1, JSON.stringify(kick));
});
