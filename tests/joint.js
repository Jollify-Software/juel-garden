// Browser test of <garden-joint>: a hinge holds a falling body, a distance joint keeps it
// in reach, a motor turns a wheel, six-dof limits hold, and the joint follows a rebuilt body
// and goes with its element. Run after a build: npm run test:joint.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics></garden-physics>
  <garden-camera type="arc" position="0 4 -16"></garden-camera>
  <garden-light></garden-light>

  <garden-box id="post" physics="static" size="1" position="-4 4 0"></garden-box>
  <garden-box id="flap" physics width="1" height="0.2" depth="1" position="-4 4 -1"></garden-box>
  <garden-joint id="hinge" type="hinge" between="#post #flap" pivot-a="0 0 -0.5" pivot-b="0 0 0.5"></garden-joint>

  <garden-sphere id="anchor" physics="static" diameter="1" position="0 4 0"></garden-sphere>
  <garden-box id="weight" physics size="1" position="0 4 -2"></garden-box>
  <garden-joint type="distance" between="#anchor #weight" max-distance="2"></garden-joint>

  <garden-box id="axle" physics="static" size="0.5" position="4 4 0"></garden-box>
  <garden-cylinder id="wheel" physics diameter="2" height="0.3" position="4 4 -1" rotation="90 0 0"></garden-cylinder>
  <garden-joint id="motor" type="hinge" between="#axle #wheel" pivot-a="0 0 -1" axis-a="0 0 1" axis-b="0 1 0" motor="3"></garden-joint>

  <garden-box id="base" physics="static" size="1" position="8 4 0"></garden-box>
  <garden-box id="rider" physics size="1" position="8 5.5 0"></garden-box>
  <garden-joint type="six-dof" between="#base #rider" pivot-a="0 0.5 0" pivot-b="0 -0.5 0" limits="linear-distance 0 1"></garden-joint>

  <garden-box id="loose" physics size="1" position="12 4 0"></garden-box>

  <!-- A rope (min-distance 0) with collisions: the block rests on the slab instead of falling through it. -->
  <garden-box id="slab" physics="static" width="2" height="0.2" depth="2" position="-8 4 0"></garden-box>
  <garden-box id="block" physics size="0.5" position="-8 4.5 0"></garden-box>
  <garden-joint type="distance" between="#slab #block" min-distance="0" max-distance="3" collisions></garden-joint>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("hinge").constraint && document.getElementById("motor").constraint, null, { timeout: 20000 });
    check("joints are made once both bodies exist", true);
    await page.waitForTimeout(2500);
    const s = await page.evaluate(() => {
        const p = id => document.getElementById(id).mesh.getAbsolutePosition();
        const d = (a, b) => p(a).subtract(p(b)).length();
        return {
            flapDrop: 4 - p("flap").y, flapToPivot: p("flap").subtract(p("post").add(new BABYLON.Vector3(0, 0, -0.5))).length(),
            weightToAnchor: d("weight", "anchor"), weightY: p("weight").y,
            spin: document.getElementById("wheel").physicsAggregate.body.getAngularVelocity().length(),
            wheelToAxle: d("wheel", "axle"),
            riderDrop: p("base").y - p("rider").y,
            riderPivots: p("rider").add(new BABYLON.Vector3(0, -0.5, 0)).subtract(p("base").add(new BABYLON.Vector3(0, 0.5, 0))).length(),
            looseY: p("loose").y, blockY: p("block").y,
        };
    });
    check("a rope with collisions: the block rests on the slab", s.blockY > 4.2 && s.blockY < 4.5, JSON.stringify(s));
    check("an unjoined body falls", s.looseY < 0, JSON.stringify(s));
    check("the hinge holds the flap 0.5 m from its pin (it swings, it doesn't fall)", Math.abs(s.flapToPivot - 0.5) < 0.05, JSON.stringify(s));
    check("the distance joint keeps the weight within 2 m", s.weightToAnchor < 2.1 && s.weightY > 1.5, JSON.stringify(s));
    check("the motor turns the wheel at about 3 rad/s on its axle", Math.abs(s.spin - 3) < 0.5 && s.wheelToAxle < 1.2, JSON.stringify(s));
    check("six-dof limits keep the rider's foot within 1 m of the base's top (it sinks through, no further)", s.riderPivots < 1.05 && s.riderDrop < 0.1, JSON.stringify(s));

    // Rebuild the flap (a change that isn't a transform): the hinge joins the new body.
    const old = await page.evaluate(() => {
        window.__oldConstraint = document.getElementById("hinge").constraint;
        document.getElementById("flap").setAttribute("colour", "#ff0000");
        return true;
    });
    await page.waitForFunction(() => document.getElementById("hinge").constraint && document.getElementById("hinge").constraint != window.__oldConstraint, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const flap = await page.evaluate(() => document.getElementById("flap").mesh.getAbsolutePosition().subtract(document.getElementById("post").mesh.getAbsolutePosition().add(new BABYLON.Vector3(0, 0, -0.5))).length());
    check("a rebuilt body is joined again", old && Math.abs(flap - 0.5) < 0.05, String(flap));

    // The motor's speed changes live.
    await page.evaluate(() => document.getElementById("motor").motor = -6);
    await page.waitForTimeout(1500);
    const spin = await page.evaluate(() => document.getElementById("wheel").physicsAggregate.body.getAngularVelocity().length());
    check("motor changes speed from code", Math.abs(spin - 6) < 0.8, String(spin));

    // Removing the joint frees the body.
    await page.evaluate(() => document.getElementById("hinge").remove());
    await page.waitForTimeout(2000);
    const freed = await page.evaluate(() => ({ y: document.getElementById("flap").mesh.getAbsolutePosition().y, c: !!document.getElementById("flap").physicsAggregate.body.getConstraints?.().length }));
    check("a removed joint lets go", freed.y < 0, JSON.stringify(freed));
});
