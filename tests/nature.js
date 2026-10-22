// Browser test of the nature pieces: splatMaterial (three ground textures blended by a mix map,
// checked by reading pixels), PanoramaSky (cross-fade, haze from fog, lightning), StillWater
// (ripples, a mirror that leaves out what you say), rockMesh, stoneWall round an arcPath with a
// gate, cardTrees, GlowRing (following the ground), mottle and imageFromFunction.
// Textures are drawn in the page. Run after a build: npm run test:nature.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 30 -0.01"></garden-camera>
  <garden-light></garden-light>
  <garden-ground id="g" width="30" height="30" subdivisions="30"></garden-ground>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("g").mesh && document.querySelector("garden-scene").scene?.getFrameId() > 10, null, { timeout: 30000 });
    // A solid colour tile and a flat normal map, as data URLs.
    await page.evaluate(() => {
        window.tile = (colour) => { const c = document.createElement("canvas"); c.width = c.height = 16; const x = c.getContext("2d"); x.fillStyle = colour; x.fillRect(0, 0, 16, 16); return c.toDataURL("image/png"); };
        window.flat = tile("#8080ff");
        window.scene = document.querySelector("garden-scene").scene;
    });

    // imageFromFunction + splatMaterial: red layer on the left (-x), green in the middle, blue on the right.
    const splat = await page.evaluate(async () => {
        const mix = JuelGarden.imageFromFunction(64, 30, 30, (x) => x < -5 ? [1, 0, 0] : x < 5 ? [0, 1, 0] : [0, 0, 1]);
        const ground = document.getElementById("g").mesh;
        const m = JuelGarden.splatMaterial(scene, mix, [
            { colour: tile("#e02020"), normal: flat, tiles: 4 }, { colour: tile("#20e020"), normal: flat, tiles: 4 }, { colour: tile("#2020e0"), normal: flat, tiles: 4 }]);
        m.disableLighting = true;
        m.emissiveColor = new BABYLON.Color3(1, 1, 1);
        ground.material = m;
        const t0 = performance.now();
        while (!m.isReady(ground) && performance.now() - t0 < 10000) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 500));
        const engine = scene.getEngine(), w = engine.getRenderWidth(), h = engine.getRenderHeight();
        // The camera looks straight down; screen left is world -x or +x depending on its up: read across the middle row.
        // Read straight after a frame is drawn (the canvas is cleared between frames).
        const pix = await new Promise(r => scene.onAfterRenderObservable.addOnce(() => r(engine.readPixels(0, Math.floor(h / 2), w, 1))));
        const at = (f) => { const i = Math.floor(w * f) * 4; return [pix[i], pix[i + 1], pix[i + 2]]; };
        return { url: mix.slice(0, 22), ready: m.isReady(ground), samples: [0.3, 0.5, 0.7].map(at) };
    });
    check("imageFromFunction gives a PNG", splat.url == "data:image/png;base64,", splat.url);
    const dominant = splat.samples.map(([r, g, b]) => r > g && r > b ? "r" : g > r && g > b ? "g" : b > r && b > g ? "b" : "?");
    check("splatMaterial compiles and shows each layer where the mix map says", splat.ready && new Set(dominant).size == 3 && dominant[1] == "g", JSON.stringify(splat.samples));

    // mottle
    const mottled = await page.evaluate(() => {
        const ground = document.getElementById("g").mesh;
        JuelGarden.mottle(ground);
        const c = ground.getVerticesData("color");
        let lo = 9, hi = 0;
        for (let i = 0; i < c.length; i += 4) { lo = Math.min(lo, c[i]); hi = Math.max(hi, c[i]); }
        return { lo, hi };
    });
    check("mottle varies the ground's brightness", mottled.hi - mottled.lo > 0.08 && mottled.lo > 0.7, JSON.stringify(mottled));

    // PanoramaSky
    const sky = await page.evaluate(async () => {
        const wide = (colour) => { const c = document.createElement("canvas"); c.width = 64; c.height = 32; const x = c.getContext("2d"); x.fillStyle = colour; x.fillRect(0, 0, 64, 32); return c.toDataURL("image/png"); };
        const s = new JuelGarden.PanoramaSky(scene, { url: wide("#556"), tint: new BABYLON.Color3(0.5, 0.5, 0.6) }, { url: wide("#d96") });
        const step = () => new Promise(r => setTimeout(r, 120));
        const vis = () => s.domes.map(d => +d.mesh.visibility.toFixed(2));
        await step();
        const first = vis();
        s.blend = 1; await step();
        const second = vis();
        s.blend = 0; s.flash(); await step();
        const flashed = s.domes[0].material.emissiveColor.r;
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.2; scene.fogColor = new BABYLON.Color3(0.4, 0.3, 0.2);
        await step();
        const hazed = vis(), clear = [scene.clearColor.r, scene.clearColor.g].map(v => +v.toFixed(2));
        scene.fogMode = 0;
        s.dispose();
        return { first, second, flashed, hazed, clear };
    });
    check("PanoramaSky shows the first sky, then cross-fades to the second", sky.first[0] == 1 && sky.first[1] == 0 && sky.second[0] == 0 && sky.second[1] == 1, JSON.stringify(sky));
    check("…lightning lights the first up", sky.flashed > 0.6, String(sky.flashed));
    check("…and thick fog hides it, behind the fog's colour", sky.hazed.every(v => v == 0) && sky.clear[0] == 0.4 && sky.clear[1] == 0.3, JSON.stringify(sky));

    // StillWater
    const water = await page.evaluate(() => {
        const box = BABYLON.MeshBuilder.CreateBox("reflected", {}, scene);
        const w = new JuelGarden.StillWater(scene, { position: new BABYLON.Vector3(0, 0.05, 0), radius: 4 });
        const before = !!w.material.reflectionTexture;
        const mirror = w.reflect(m => m.name != "ground" && m.id != "g");
        const names = mirror.renderList.map(m => m.name);
        const r = { before, has: !!w.material.reflectionTexture, ripples: !!w.material.bumpTexture, box: names.includes("reflected"), self: names.includes("water"), ground: names.some(n => /ground/i.test(n)) };
        w.dispose(); box.dispose();
        return r;
    });
    check("StillWater has ripples, and a mirror only once reflect() is called", water.ripples && !water.before && water.has, JSON.stringify(water));
    check("…which leaves out itself and what you say", water.box && !water.self && !water.ground, JSON.stringify(water));

    // rockMesh
    const rock = await page.evaluate(() => {
        const a = JuelGarden.rockMesh(scene, 1, 3), b = JuelGarden.rockMesh(scene, 1, 9);
        const radii = (m) => { const p = m.getVerticesData("position"); const r = []; let low = 0; for (let i = 0; i < p.length; i += 3) { r.push(Math.hypot(p[i], p[i + 1], p[i + 2])); low = Math.min(low, p[i + 1]); } return { min: Math.min(...r), max: Math.max(...r), low, first: p[0] }; };
        const ra = radii(a), rb = radii(b);
        a.dispose(); b.dispose();
        return { ra, rb };
    });
    check("rockMesh is lumpy, not round, flat underneath, and differs by seed", rock.ra.min / rock.ra.max < 0.85 && rock.ra.low > -0.5 && rock.ra.first != rock.rb.first, JSON.stringify(rock));

    // stoneWall round an arcPath, with a gate
    const wall = await page.evaluate(() => {
        const gate = 0, gap = 0.4;
        const path = JuelGarden.arcPath({ x: 0, z: 0 }, 5, gate + gap / 2, gate + Math.PI * 2 - gap / 2, () => 0);
        const { wall, caps } = JuelGarden.stoneWall(scene, path, { height: 1.05 });
        const b = wall.getBoundingInfo().boundingBox;
        // Nothing of the wall right in the gateway (+z, the gate's angle 0).
        const p = wall.getVerticesData("position");
        let inGate = 0;
        for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i]) < 0.6 && p[i + 2] > 4) inGate++;
        const r = { top: +b.maximum.y.toFixed(2), bottom: +b.minimum.y.toFixed(2), inGate, caps: caps.getTotalVertices() > 0 };
        wall.dispose(); caps.dispose();
        return r;
    });
    check("stoneWall stands its height, sunk a little, with capstones", wall.top == 1 && wall.bottom == -0.05 && wall.caps, JSON.stringify(wall));
    check("…and leaves the gateway open", wall.inGate == 0, JSON.stringify(wall));

    // cardTrees
    const trees = await page.evaluate(() => {
        const t = JuelGarden.cardTrees(scene, { variants: 3 });
        const inst = t[0].trunk.createInstance("t0");
        const r = { n: t.length, hidden: t.every(s => s.trunk.position.y == -100), alphaTest: t[0].leaves.material.transparencyMode == 1, cut: t[0].leaves.material.useAlphaFromDiffuseTexture, tris: t.map(s => (s.trunk.getTotalIndices() + s.leaves.getTotalIndices()) / 3), inst: !!inst };
        return r;
    });
    check("cardTrees gives hidden templates to instance, light and cut out", trees.n == 3 && trees.hidden && trees.alphaTest && trees.cut && trees.tris.every(n => n < 2000) && trees.inst, JSON.stringify(trees));

    // GlowRing following the ground
    const ring = await page.evaluate(() => {
        const r = new JuelGarden.GlowRing(scene, { height: (x, z) => x * 0.1 });
        r.update(5, 5, 3);
        const p = r.mesh.getVerticesData("position");
        const n = p.length / 3, mid = [];
        // The middle path (the circle itself) is the second of three.
        for (let i = n / 3; i < (2 * n) / 3; i++) mid.push([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
        const radii = mid.map(([x, , z]) => Math.hypot(x - 5, z - 5));
        const heights = mid.map(([x, y]) => Math.abs(y - (x * 0.1 + 0.07)));
        r.level = 0;
        return { rmin: Math.min(...radii), rmax: Math.max(...radii), off: Math.max(...heights), hidden: !r.mesh.isEnabled() };
    });
    check("GlowRing circles where it's told, along the ground's height", Math.abs(ring.rmin - 3) < 0.01 && Math.abs(ring.rmax - 3) < 0.01 && ring.off < 1e-4, JSON.stringify(ring));
    check("…and fades out with level", ring.hidden);
});
