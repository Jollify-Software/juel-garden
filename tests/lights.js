// Browser test of carried lights: a <garden-light> inside a mesh rides on it, pool="n"
// is a downward spot light whose ground circle grows when pool is set from code (and
// really lights the ground under it), intensity/range are live, a <garden-animation
// property="intensity"> animates the light, and shadows builds a shadow generator.
// Run after a build: npm run test:lights.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 14 -0.01"></garden-camera>
  <garden-ground width="30" height="30" colour="#ffffff"></garden-ground>
  <garden-box id="carrier" position="0 0.5 0" width="0.5" height="1" depth="0.5">
    <garden-light id="lamp" type="point" pool="4" position="0 2.5 0" intensity="2" diffuse="1 1 1" shadows="512"></garden-light>
  </garden-box>
  <garden-light id="pulse" type="point" position="20 3 20" range="5">
    <garden-animation event="load" property="intensity" type="float" loop="true" from="0" to="30" keyframes="0 0, 15 3, 30 0"></garden-animation>
  </garden-light>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("lamp").light?.parent);
    const lamp = () => page.evaluate(() => {
        const el = document.getElementById("lamp"), l = el.light;
        return { cls: l.getClassName(), parent: l.parent?.element?.id, dir: l.direction.asArray(), angle: +(l.angle * 180 / Math.PI).toFixed(1),
                 abs: l.getAbsolutePosition().asArray().map(n => +n.toFixed(2)), intensity: l.intensity, range: l.range,
                 casters: el.shadowGenerator?.getShadowMap().renderList.length ?? 0 };
    });
    let l = await lamp();
    check("pool makes a downward spot light", l.cls == "SpotLight" && l.dir[1] == -1, JSON.stringify(l));
    check("a light inside a mesh hangs on that mesh", l.parent == "carrier" && l.abs[1] == 3, JSON.stringify(l));
    check("shadows builds a shadow generator with casters", l.casters > 0, String(l.casters));

    await page.evaluate(() => document.getElementById("carrier").mesh.position.set(5, 0.5, 2));
    await frames(2);
    l = await lamp();
    check("…and moves with it", l.abs[0] == 5 && l.abs[2] == 2, JSON.stringify(l.abs));
    await page.evaluate(() => document.getElementById("carrier").mesh.position.set(0, 0.5, 0));

    const before = l.angle;
    await page.evaluate(() => { const el = document.getElementById("lamp"); el.pool = 8; el.intensity = 3; el.range = 12; });
    await page.waitForTimeout(100);
    l = await lamp();
    check("setting pool from code widens the circle", l.angle > before * 1.5, `${before} -> ${l.angle}`);
    check("intensity and range are live", l.intensity == 3 && l.range == 12, JSON.stringify(l));

    // The pool really lights the ground: bright under the lamp, dark far away (no other light).
    await page.evaluate(() => { const el = document.getElementById("lamp"); el.pool = 4; el.shadows = null; });
    await frames(3);
    const px = await page.evaluate(async () => {
        const s = document.querySelector("garden-scene"), e = s.engine, w = e.getRenderWidth(), h = e.getRenderHeight();
        await s.scene.whenReadyAsync(); // a new light recompiles the materials
        s.scene.render();
        const at = async (x, y) => Array.from(await e.readPixels(x, y, 1, 1)).slice(0, 3).reduce((a, b) => a + b, 0);
        return { centre: await at(Math.floor(w / 2), Math.floor(h / 2) + 40), corner: await at(30, 30) };
    });
    check("the ground under the pool is lit, outside it is dark", px.centre > 200 && px.corner < 60, JSON.stringify(px));

    const a = await page.evaluate(() => document.getElementById("pulse").light.intensity);
    await page.waitForTimeout(250);
    const b = await page.evaluate(() => document.getElementById("pulse").light.intensity);
    check("<garden-animation property=\"intensity\"> animates a light", a != b, `${a} -> ${b}`);

    // type="hemispheric" is another name for "hemi".
    const names = await page.evaluate(async () => {
        const out = {};
        for (const type of ["hemi", "hemispheric"]) {
            const el = document.createElement("garden-light");
            el.setAttribute("type", type);
            document.querySelector("garden-scene").appendChild(el);
            await el.updateComplete;
            out[type] = el.light?.getClassName() ?? null;
            el.remove();
        }
        return out;
    });
    check("type=\"hemispheric\" builds a hemispheric light, as \"hemi\" does", names.hemi == "HemisphericLight" && names.hemispheric == "HemisphericLight", JSON.stringify(names));
});
