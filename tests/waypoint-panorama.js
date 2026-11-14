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
    <garden-waypoint waypoints="#a #b #c" offset="0 1.6 0" speed="4" dwell="0"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-ground width="80" height="80"></garden-ground>
  <garden-cylinder id="a" height="0.2" diameter="1.5" position="0 0.1 0" panorama="/examples/assets/dunes.png"></garden-cylinder>
  <garden-cylinder id="b" height="0.2" diameter="1.5" position="5 0.1 0"></garden-cylinder>
  <garden-cylinder id="c" height="0.2" diameter="1.5" position="10 0.1 0" panorama="/examples/assets/Christ_Pantokrator.jpg"></garden-cylinder>
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
    check("no page errors", errors.length === 0, errors.join(" | "));
});
