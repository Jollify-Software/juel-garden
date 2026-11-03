// Browser test of <garden-joint> motors and grid copies: motor-type="position" turns a joint to an
// angle and holds it there; motor, motor-force, motor-type and motor-axis change live without a new
// constraint; taking the motor off frees the axis; instance-a/instance-b join two copies of one
// physics grid. Run after a build: npm run test:joint-motor.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics gravity="0 -10 0"></garden-physics>
  <garden-camera type="arc" position="0 6 -25"></garden-camera>
  <garden-light></garden-light>

  <!-- A wheel on a fixed axle, its pivots locked together; a position motor tilts it about z. -->
  <garden-cylinder id="wheel" physics physics-shape="convex" mass="5" height="1" diameter="5" tessellation="8" position="4 4 0"></garden-cylinder>
  <garden-cylinder id="axle" physics="static" physics-shape="convex" height="3" diameter="1" tessellation="6" position="4 4 0"></garden-cylinder>
  <garden-joint id="tilt" type="six-dof" between="#wheel #axle" limits="linear-distance 0 0"
      motor="0.7854" motor-type="position" motor-axis="angular-z" motor-force="100"></garden-joint>

  <!-- The same with a velocity motor about y. -->
  <garden-cylinder id="spinner" physics physics-shape="convex" mass="5" height="1" diameter="5" tessellation="8" position="-4 4 0"></garden-cylinder>
  <garden-cylinder id="post" physics="static" physics-shape="convex" height="3" diameter="1" tessellation="6" position="-4 4 0"></garden-cylinder>
  <garden-joint id="spin" type="six-dof" between="#spinner #post" limits="linear-distance 0 0"
      motor="5" motor-axis="angular-y" motor-force="100"></garden-joint>

  <!-- Two copies of one grid, 4 m apart on the floor, joined by a 1.5 m rod. -->
  <garden-ground width="40" height="40" physics="static"></garden-ground>
  <garden-box id="links" physics size="1" position="-2 0.5 -8" grid="2 1 1" grid-spacing="4 1 1"></garden-box>
  <garden-joint id="pair" type="distance" between="#links #links" instance-a="0" instance-b="1" max-distance="1.5"></garden-joint>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => ["tilt", "spin", "pair"].every(id => document.getElementById(id).constraint), null, { timeout: 20000 });
    // The wheel's tilt: the angle of its up axis from the world's, signed by which way it leans (x).
    const tilt = () => page.evaluate(() => {
        const m = document.getElementById("wheel").mesh.computeWorldMatrix(true);
        const up = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 1, 0), m).normalize();
        return Math.sign(-up.x || 1) * Math.acos(Math.min(1, up.y));
    });
    await page.waitForTimeout(2500);
    let a = await tilt();
    check("a position motor turns the joint to its target and holds it", Math.abs(Math.abs(a) - 0.785) < 0.08, String(a));

    const before = await page.evaluate(() => (window.__tilt = document.getElementById("tilt").constraint, 1));
    await page.evaluate(() => document.getElementById("tilt").motor = 0);
    await page.waitForTimeout(2000);
    a = await tilt();
    const same = await page.evaluate(() => document.getElementById("tilt").constraint == window.__tilt);
    check("a new target turns it there, live, on the same constraint", before && same && Math.abs(a) < 0.08, String(a));

    const spin = () => page.evaluate(() => document.getElementById("spinner").physicsAggregate.body.getAngularVelocity().length());
    let w = await spin();
    check("a velocity motor turns at its speed", Math.abs(w - 5) < 0.5, String(w));

    const force = await page.evaluate(() => {
        const j = document.getElementById("spin");
        window.__spin = j.constraint;
        j.setAttribute("motor-force", "250");
        return new Promise(r => requestAnimationFrame(() => r({
            force: j.getScene().getPhysicsEngine().getPhysicsPlugin().getAxisMotorMaxForce(j.constraint, BABYLON.PhysicsConstraintAxis.ANGULAR_Y),
            same: j.constraint == window.__spin,
        })));
    });
    check("motor-force changes live", Math.abs(force.force - 250) < 1e-3 && force.same, JSON.stringify(force));

    // Switched to a position motor at 0 about y: it stops turning.
    await page.evaluate(() => { const j = document.getElementById("spin"); j.setAttribute("motor-type", "position"); j.motor = 0; });
    await page.waitForTimeout(2000);
    w = await spin();
    check("motor-type changes live (a position motor holds still)", w < 0.3, String(w));

    // Taken off: the axis is free again, so a push sets the wheel turning (the motor held it still).
    await page.evaluate(() => {
        const j = document.getElementById("spin");
        j.removeAttribute("motor");
        const body = document.getElementById("spinner").physicsAggregate.body;
        return new Promise(r => requestAnimationFrame(() => { body.setAngularVelocity(new BABYLON.Vector3(0, 3, 0)); r(); }));
    });
    await page.waitForTimeout(1000);
    w = await spin();
    check("removing motor frees the axis", w > 2, String(w));

    const gap = await page.evaluate(() => {
        const ms = document.getElementById("links").mesh.thinInstanceGetWorldMatrices();
        return BABYLON.Vector3.Distance(ms[0].getTranslation(), ms[1].getTranslation());
    });
    check("instance-a/instance-b join two copies of a grid", gap < 1.6, String(gap));
});
