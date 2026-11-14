// Browser test of a <garden-waypoint> stop's `panorama` (a 360° photo round you while you stand
// there: a Jollify VR presentation's photo scene). On the first stop its photo is on show at once;
// flying to a stop without one fades it out; to another with one fades that in; back again, the
// first dome is used again (not a second). The domes are behind everything and can't be picked,
// so look-and-hold still finds a stop through one. Control: a stop with no `panorama` shows none.
// Run after a build: node tests/waypoint-panorama.js.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera position="0 1.6 0">
    <garden-waypoint waypoints="#a #b #c #d" offset="0 1.6 0" speed="4" dwell="0"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-ground width="80" height="80"></garden-ground>
  <garden-cylinder id="a" height="0.2" diameter="1.5" position="0 0.1 0" panorama="/examples/assets/dunes.png"></garden-cylinder>
  <garden-cylinder id="b" height="0.2" diameter="1.5" position="5 0.1 0"></garden-cylinder>
  <garden-cylinder id="c" height="0.2" diameter="1.5" position="10 0.1 0" panorama="/examples/assets/Christ_Pantokrator.jpg"></garden-cylinder>
  <garden-cylinder id="d" height="0.2" diameter="1.5" position="15 0.1 0"></garden-cylinder>
</garden-scene>`, async ({ page, check, errors }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 10, null, { timeout: 30000 });
    const state = () => page.evaluate(() => {
        const w = document.querySelector("garden-waypoint");
        const domes = w.getScene().meshes.filter(m => m.name.startsWith("waypoint-panorama"));
        return { shown: w.panoramaShown, domes: domes.map(m => ({ on: m.isEnabled(), v: Math.round(m.visibility * 100) / 100, pick: m.isPickable, far: m.infiniteDistance })) };
    });
    const settle = () => page.waitForTimeout(1600);

    let s = await state();
    check("the first stop's photo is on show at once", s.shown === "/examples/assets/dunes.png" && s.domes.length === 1 && s.domes[0].v === 1, JSON.stringify(s));
    check("its dome can't be picked and sits at the sky's distance", s.domes[0].pick === false && s.domes[0].far === true, JSON.stringify(s));
    const texture = await page.evaluate(() => document.querySelector("garden-waypoint").getScene().meshes.find(m => m.name.startsWith("waypoint-panorama")).material.emissiveTexture?.url);
    check("the dome shows the photo", /dunes\.png$/.test(texture ?? ""), texture);

    await page.evaluate(() => document.querySelector("garden-waypoint").go(1));
    await settle();
    s = await state();
    check("control: a stop with no panorama shows none (faded out, disabled)", s.shown === "" && s.domes.every(d => d.v === 0 && !d.on), JSON.stringify(s));

    await page.evaluate(() => document.querySelector("garden-waypoint").go(2));
    await page.waitForTimeout(300);
    const midway = await state();
    check("flying to the next photo stop, its photo fades in (partway after 0.3 s)", midway.domes[1] && midway.domes[1].v > 0 && midway.domes[1].v < 1, JSON.stringify(midway));
    await settle();
    s = await state();
    check("…and is on show once there, the first still off", s.shown === "/examples/assets/Christ_Pantokrator.jpg" && s.domes[1].v === 1 && s.domes[0].v === 0, JSON.stringify(s));

    await page.evaluate(() => document.querySelector("garden-waypoint").go(0));
    await settle();
    s = await state();
    check("back on the first: its dome again, not a third", s.domes.length === 2 && s.domes[0].v === 1 && s.domes[1].v === 0 && !s.domes[1].on, JSON.stringify(s));

    // Look-and-hold through a dome: the stop ahead is still found.
    const through = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        const w = document.querySelector("garden-waypoint");
        const cam = scene.activeCamera;
        cam.setTarget(document.getElementById("b").getPosition());
        const pick = scene.pickWithRay(cam.getForwardRay(200), m => m.isPickable && m.isEnabled());
        return pick?.hit ? w.stopOf(pick.pickedMesh)?.id ?? pick.pickedMesh.name : "nothing";
    });
    check("looking at the next stop through the photo finds it", through === "b", through);

    // The right way up: a photo red above its horizon and blue below, seen looking up, is red.
    await page.evaluate(() => {
        const c = Object.assign(document.createElement("canvas"), { width: 256, height: 128 });
        const g = c.getContext("2d");
        g.fillStyle = "#ff0000"; g.fillRect(0, 0, 256, 64);
        g.fillStyle = "#0000ff"; g.fillRect(0, 64, 256, 64);
        document.getElementById("d").setAttribute("panorama", c.toDataURL("image/png"));
        document.querySelector("garden-waypoint").go(3);
    });
    await page.waitForFunction(() => { const w = document.querySelector("garden-waypoint"); const d = w.getScene().meshes.filter(m => m.name.startsWith("waypoint-panorama")).at(-1); return w.panoramaShown.startsWith("data:") && d.visibility === 1 && d.material.emissiveTexture.isReady() && !w.getScene().getAnimatableByTarget(w.getScene().activeCamera); }, null, { timeout: 15000 });
    const up = await page.evaluate(async () => {
        const s = document.querySelector("garden-scene").scene, engine = s.getEngine(), cam = s.activeCamera;
        // 40° up: well inside the top half, away from the pole (the wrap there blends the two).
        const V = cam.position.constructor;
        cam.setTarget(cam.position.add(new V(0, 0.84, 1)));
        s.render();
        const w = engine.getRenderWidth(), h = engine.getRenderHeight();
        const px = await engine.readPixels(Math.floor(w / 2), Math.floor(h / 2), 1, 1);
        return [px[0], px[1], px[2]];
    });
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    check("looking up you see the photo's top (red), not its bottom (blue)", up[0] > 150 && up[2] < 100, JSON.stringify(up));

    // Not mirrored: four strips (red, green, blue, yellow, left to right in the photo) seen turning right
    // round the circle come in the photo's order (a turn of it), not the reverse (a mirror).
    await page.evaluate(() => {
        const c = Object.assign(document.createElement("canvas"), { width: 256, height: 128 });
        const g = c.getContext("2d");
        ["#ff0000", "#00ff00", "#0000ff", "#ffff00"].forEach((colour, i) => { g.fillStyle = colour; g.fillRect(i * 64, 0, 64, 128); });
        // A stop of its own, as each photo is made once per URL.
        document.getElementById("d").setAttribute("panorama", c.toDataURL("image/png"));
    });
    // d's photo is already shown with the old URL: leave and come back so the new one is read.
    await page.evaluate(() => document.querySelector("garden-waypoint").go(1));
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector("garden-waypoint").go(3));
    await page.waitForFunction(() => { const w = document.querySelector("garden-waypoint"); const d = w.getScene().meshes.filter(m => m.name.startsWith("waypoint-panorama")).at(-1); return d.visibility === 1 && d.material.emissiveTexture.isReady() && !w.getScene().getAnimatableByTarget(w.getScene().activeCamera); }, null, { timeout: 15000 });
    const round = await page.evaluate(async () => {
        const s = document.querySelector("garden-scene").scene, engine = s.getEngine(), cam = s.activeCamera;
        const V = cam.position.constructor;
        const seen = [];
        // Facing +z, then turning right (clockwise seen from above: +z, +x, -z, -x), 30° up.
        for (const [x, z] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            cam.setTarget(cam.position.add(new V(x, 0.58, z)));
            s.render();
            const px = await engine.readPixels(Math.floor(engine.getRenderWidth() / 2), Math.floor(engine.getRenderHeight() / 2), 1, 1);
            const [r, g, b] = [px[0] > 128, px[1] > 128, px[2] > 128];
            seen.push(r && g ? "Y" : r ? "R" : g ? "G" : b ? "B" : "?");
        }
        return seen.join("");
    });
    const order = "RGBY";
    const turned = [0, 1, 2, 3].some(k => order.slice(k) + order.slice(0, k) === round);
    check("turning right you meet the photo's strips left to right (not mirrored)", turned, round);
    check("no page errors", errors.length === 0, errors.join(" | "));
});
