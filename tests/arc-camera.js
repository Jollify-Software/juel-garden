// Browser test of the arc camera's own attributes and vector keyframes: alpha, beta,
// radius and their limits, target as a point (position is then taken round it) or an
// element it follows; and <garden-animation type="vector3"> keyframes, plain or in
// brackets, with Math expressions. Run after a build: npm run test:arc-camera.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera id="cam" type="arc" alpha="0" beta="0.8" radius="90" target="1 2 3"
      beta-lower="0.1" beta-upper="1.4" radius-lower="30" radius-upper="150"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="spinner" position="0 0.5 0">
    <garden-animation event="load" property="rotation" type="vector3" speed="60" from="0" to="60"
        keyframes="0 (0 0 0), 60 ((Math.PI) 0 1.2)"></garden-animation>
  </garden-box>
  <garden-box id="slider" position="0 0.5 0">
    <garden-animation event="load" property="position" type="vector3" speed="60" from="0" to="60"
        keyframes="0 0 0.5 0, 60 4 0.5 -2"></garden-animation>
  </garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("cam").camera);
    const cam = await page.evaluate(() => {
        const c = document.getElementById("cam").camera, r = v => +v.toFixed(3);
        return { alpha: r(c.alpha), beta: r(c.beta), radius: r(c.radius), target: c.target.asArray().map(r),
                 limits: [c.lowerBetaLimit, c.upperBetaLimit, c.lowerRadiusLimit, c.upperRadiusLimit] };
    });
    check("alpha, beta and radius", cam.alpha == 0 && cam.beta == 0.8 && cam.radius == 90, JSON.stringify(cam));
    check("target as a point", cam.target.join() == "1,2,3", JSON.stringify(cam.target));
    check("beta and radius limits", cam.limits.join() == "0.1,1.4,30,150", JSON.stringify(cam.limits));

    await frames(90);
    const end = await page.evaluate(() => ({
        rot: document.getElementById("spinner").mesh.rotation.asArray().map(v => +v.toFixed(2)),
        pos: document.getElementById("slider").mesh.position.asArray().map(v => +v.toFixed(2)),
    }));
    check("vector3 keyframes in brackets, with a Math expression", end.rot.join() == "3.14,0,1.2", JSON.stringify(end.rot));
    check("vector3 keyframes without brackets", end.pos.join() == "4,0.5,-2", JSON.stringify(end.pos));
});
