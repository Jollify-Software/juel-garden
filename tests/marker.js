// Browser test of <garden-marker>: an icon over an on-screen target, an edge arrow pointing
// the way to an off-screen or behind-the-camera one, hide-within, the label and distance,
// and retargeting from code. Run after a build: npm run test:marker.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="free" position="0 1.5 -10"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="guide" position="0 1 0" height="2"></garden-box>
  <garden-box id="door" position="-40 1 -10"></garden-box>
  <garden-marker id="m" target="#guide" icon="★" label="Guide" show-distance hide-within="3"></garden-marker>
</garden-scene>`, async ({ page, check, frames }) => {
    await frames(5);
    const state = () => page.evaluate(() => {
        const m = document.getElementById("m"), r = m.box.getBoundingClientRect();
        return { onScreen: m.onScreen, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                 angle: +(m.arrowAngle * 180 / Math.PI).toFixed(0), text: m.box.textContent, shown: m.box.style.display != "none" };
    });
    const move = async (x, y, z) => { await page.evaluate(([x, y, z]) => document.getElementById("guide").mesh.position.set(x, y, z), [x, y, z]); await frames(3); };

    let s = await state();
    check("on screen: the icon over the target, centred", s.onScreen === true && Math.abs(s.x - 500) < 15 && s.y < 350, JSON.stringify(s));
    check("label and distance", s.text.includes("Guide · 10 m"), s.text);

    await move(40, 1, -10);
    s = await state();
    check("off to the right: an arrow on the right edge pointing right", s.onScreen === false && s.x > 900 && Math.abs(s.angle) < 10, JSON.stringify(s));
    await move(-40, 1, -10);
    s = await state();
    check("off to the left: an arrow on the left edge pointing left", s.onScreen === false && s.x < 100 && Math.abs(Math.abs(s.angle) - 180) < 10, JSON.stringify(s));
    await move(0, 1, -40);
    s = await state();
    check("behind the camera: an arrow at the bottom pointing down", s.onScreen === false && s.y > 600 && Math.abs(s.angle - 90) < 10, JSON.stringify(s));
    await move(-6, 1, -16);
    s = await state();
    check("behind and to the left: the arrow points left", s.onScreen === false && s.x < 500 && Math.abs(s.angle) > 90, JSON.stringify(s));

    await move(0, 1, -8);
    s = await state();
    check("hide-within hides it close up", !s.shown && s.onScreen === null, JSON.stringify(s));

    await page.evaluate(() => { const m = document.getElementById("m"); m.target = "#door"; m.label = "Exit"; });
    await frames(3);
    s = await state();
    check("target and label can be changed from code", s.onScreen === false && s.x < 100 && s.text.includes("Exit · 40 m"), JSON.stringify(s));
    await page.evaluate(() => document.getElementById("m").target = null);
    await frames(3);
    check("no target: hidden", !(await state()).shown);
});
