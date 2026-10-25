// Browser test of collision groups: physics-group / physics-collides say which bodies collide
// (a ball falls through a pane it doesn't collide with and lands on the floor it does), a
// raycast's collideWith hits only the groups asked for, and a physics-shape="mesh" hit says
// which triangle. Run after a build: npm run test:physics-filter.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics></garden-physics>
  <garden-camera type="arc" position="0 6 -16"></garden-camera>
  <garden-light></garden-light>
  <garden-ground id="floor" width="20" height="20" physics="static"></garden-ground>
  <!-- A pane in group 2 that the ball (in group 1, colliding only with group 1) passes through. -->
  <garden-box id="pane" physics="static" physics-group="0x2" width="4" height="0.2" depth="4" position="0 3 0"></garden-box>
  <garden-sphere id="ball" physics physics-group="1" physics-collides="1" diameter="1" position="0 5 0"></garden-sphere>
  <!-- A box that stops on the pane (both default: every group). -->
  <garden-box id="crate" physics size="1" position="-1.5 5 1.5"></garden-box>

  <garden-box id="front" size="2" position="6 1 1" physics="static" physics-shape="mesh" physics-group="1"></garden-box>
  <garden-box id="back" size="2" position="6 1 4" physics="static" physics-shape="mesh" physics-group="2"></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => ["floor", "pane", "ball", "crate", "front", "back"].every(id => document.getElementById(id).physicsAggregate));
    const masks = await page.evaluate(() => {
        const shape = id => document.getElementById(id).physicsAggregate.shape;
        return { pane: shape("pane").filterMembershipMask, ball: [shape("ball").filterMembershipMask, shape("ball").filterCollideMask] };
    });
    check("physics-group and physics-collides set the shape's filter masks", masks.pane == 2 && masks.ball.join() == "1,1", JSON.stringify(masks));

    await page.waitForTimeout(2500);
    const y = await page.evaluate(() => ({
        ball: document.getElementById("ball").mesh.getAbsolutePosition().y,
        crate: document.getElementById("crate").mesh.getAbsolutePosition().y,
    }));
    check("a ball that doesn't collide with the pane's group falls through it to the floor", y.ball < 0.7, JSON.stringify(y));
    check("a body in every group lands on the pane", y.crate > 3 && y.crate < 3.8, JSON.stringify(y));

    const r = await page.evaluate(() => {
        const physics = document.querySelector("garden-physics"), V = BABYLON.Vector3;
        const from = new V(6, 1, -2), to = new V(6.8, 1, 6);
        const fmt = h => h && { id: h.element?.id, point: h.point.asArray().map(n => +n.toFixed(2)), triangle: h.triangle };
        return {
            any: fmt(physics.raycast(from, to)),
            two: fmt(physics.raycast(from, to, { collideWith: 2 })),
            one: fmt(physics.raycast(from, to, { collideWith: 1 })),
            none: fmt(physics.raycast(from, to, { collideWith: 4 })),
            plain: fmt(physics.raycast(new V(0, 10, 0), new V(0, -10, 0), { collideWith: 1 })),
        };
    });
    check("an unfiltered ray hits the front box", r.any?.id == "front", JSON.stringify(r));
    check("collideWith 2 passes through the front box to the back one", r.two?.id == "back" && r.two.point.join() == "6.5,1,3", JSON.stringify(r.two));
    check("collideWith 1 hits only the front box", r.one?.id == "front", JSON.stringify(r.one));
    check("collideWith with no matching group hits nothing", r.none == null, JSON.stringify(r.none));
    check("a mesh-shape hit says which triangle", Number.isInteger(r.two?.triangle) && r.two.triangle >= 0, JSON.stringify(r.two));
    check("collideWith skips the pane (group 2) and hits the ball's group", r.plain?.id == "ball" || r.plain?.id == "floor", JSON.stringify(r.plain));
});
