// Browser test of <garden-physics>.raycast() and a mesh's grid of copies: grid="nx ny nz" makes
// thin instances grid-spacing apart, instance-colours colours them, with physics each copy is a
// body; a raycast says which element (and copy) it hit, where, and can ignore a body; picking
// sees each copy. Run after a build: npm run test:raycast.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics></garden-physics>
  <garden-camera type="arc" position="0 10 -30"></garden-camera>
  <garden-light></garden-light>
  <garden-ground id="floor" width="40" height="40" physics="static"></garden-ground>
  <garden-box id="bricks" size="1" position="-1 0.5 0" grid="3 2 2" grid-spacing="1 1 1.5"
      instance-colours="#ff0000 #00ff00" physics mass="1"></garden-box>
  <garden-sphere id="eye" physics="static" diameter="1" position="10 1 0"></garden-sphere>
  <garden-box id="sensor" physics="trigger" size="2" position="10 5 5"></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("bricks").physicsAggregate && document.getElementById("eye").physicsAggregate);
    await frames(10);
    const s = await page.evaluate(() => {
        const bricks = document.getElementById("bricks").mesh;
        const data = bricks._userThinInstanceBuffersStorage?.data ?? {}, colours = data.instanceColor ?? data.color ?? null;
        return {
            count: bricks.thinInstanceCount,
            bodies: document.querySelector("garden-physics").plugin.numBodies,
            second: Array.from(bricks.thinInstanceGetWorldMatrices()[1].getTranslation().asArray()),
            back: Array.from(bricks.thinInstanceGetWorldMatrices()[6].getTranslation().asArray()),
            colours: colours ? Array.from(colours.slice(0, 8)) : null,
            updatable: bricks._thinInstanceDataStorage.matrixBuffer.isUpdatable(),
        };
    });
    check("grid makes nx x ny x nz copies", s.count == 12, JSON.stringify(s));
    check("each copy is a body of its own", s.bodies >= 12 + 3, String(s.bodies));
    check("copies are grid-spacing apart from position, along +x, +y, +z", s.second.map(n => +n.toFixed(2)).join() == "0,0.5,0" && s.back.map(n => +n.toFixed(2)).join() == "-1,0.5,1.5", JSON.stringify(s));
    check("a physics grid's matrices can be updated (the copies move on screen)", s.updatable, JSON.stringify(s));
    check("instance-colours are taken in turn", s.colours?.join() == "1,0,0,1,0,1,0,1", JSON.stringify(s.colours));

    const r = await page.evaluate(() => {
        const physics = document.querySelector("garden-physics"), V = BABYLON.Vector3;
        const fmt = h => h && { id: h.element?.id, point: h.point.asArray().map(n => +n.toFixed(2)), normal: h.normal.asArray().map(n => +n.toFixed(2)), distance: +h.distance.toFixed(2), instance: h.instance };
        return {
            down: fmt(physics.raycast(new V(1, 10, 0), new V(1, -10, 0))),
            floor: fmt(physics.raycast(new V(5, 10, 0), new V(5, -10, 0))),
            fromEye: fmt(physics.raycast(new V(12, 1, 0), new V(-10, 1, 0), { ignore: document.getElementById("eye") })),
            blocked: fmt(physics.raycast(new V(12, 1, 0), new V(-10, 1, 0))),
            sky: fmt(physics.raycast(new V(0, 20, 0), new V(0, 40, 0))),
            noTrigger: fmt(physics.raycast(new V(10, 10, 5), new V(10, -1, 5))),
            trigger: fmt(physics.raycast(new V(10, 10, 5), new V(10, -1, 5), { triggers: true })),
        };
    });
    check("a raycast hits the top copy of the grid's column, from above", r.down?.id == "bricks" && r.down.point[1] == 2 && r.down.normal.join() == "0,1,0" && r.down.distance == 8, JSON.stringify(r.down));
    check("...and says which copy", r.down?.instance == 5, JSON.stringify(r.down));
    check("a raycast down beside it hits the floor", r.floor?.id == "floor" && r.floor.point[1] == 0, JSON.stringify(r.floor));
    check("ignore leaves out the looker's own body", r.fromEye?.id == "bricks" && r.blocked?.id == "eye", JSON.stringify(r));
    check("nothing in the way gives null", r.sky === null, JSON.stringify(r.sky));
    check("triggers are seen only with triggers: true", r.noTrigger?.id == "floor" && r.trigger?.id == "sensor", JSON.stringify(r));

    const pick = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene, V = BABYLON.Vector3;
        const p = scene.pickWithRay(new BABYLON.Ray(new V(-1, 10, 0), new V(0, -1, 0), 20));
        return { mesh: p.pickedMesh?.element?.id, instance: p.thinInstanceIndex };
    });
    check("picking sees each copy", pick.mesh == "bricks" && pick.instance == 3, JSON.stringify(pick));
});
