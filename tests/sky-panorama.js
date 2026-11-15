// Browser test of a photographed sky (`<garden-sky panorama>`, PanoramaSky: the games' storm and
// dusk skies) the right way up and the right way round, as tests/waypoint-panorama.js checks a
// stop's 360° photo (VR-PLAN §12: the first `panorama` loaded flipped and mirrored, upside down on
// Babylon's sphere). A photo red above its horizon and blue below is red looking up and blue looking
// down; four strips (red, green, blue, yellow, left to right) come in that order turning right.
// Control: CONTROL=1 swaps the sky's texture for one loaded as PanoramaSky first did (flipped, uScale
// -1): the up/down and turn checks FAIL.
// Run after a build: node tests/sky-panorama.js.
const { run } = require("./harness");

const control = process.env.CONTROL === "1";

run(`
<garden-scene>
  <garden-camera position="0 1.6 0"></garden-camera>
  <garden-light></garden-light>
</garden-scene>`, async ({ page, check, errors }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 10, null, { timeout: 30000 });

    /** Puts a sky with the photo `paint` draws on the scene, and waits for its texture. */
    const sky = async (paint) => {
        await page.evaluate(async ({ paint, control }) => {
            const make = new Function(`return (${paint})`)();
            const c = Object.assign(document.createElement("canvas"), { width: 256, height: 128 });
            make(c.getContext("2d"));
            document.querySelector("garden-sky")?.remove();
            const el = document.createElement("garden-sky");
            el.setAttribute("panorama", c.toDataURL("image/png"));
            document.querySelector("garden-scene").appendChild(el);
            for (let i = 0; i < 100 && !el.panoramaSky; i++) await new Promise(r => setTimeout(r, 50));
            if (control) {
                // As PanoramaSky first loaded it: flipped (invertY, Texture's default) and mirrored.
                const material = el.panoramaSky.domes[0].material;
                const old = material.diffuseTexture;
                const T = old.constructor;
                const flipped = new T(old.url, old.getScene());
                flipped.uScale = -1;
                material.diffuseTexture = flipped;
            }
        }, { paint: paint.toString(), control });
        await page.waitForFunction(() => { const d = document.querySelector("garden-sky")?.panoramaSky?.domes[0]; return d && d.material.diffuseTexture?.isReady() && d.mesh.isEnabled() && d.mesh.isReady(true); }, null, { timeout: 15000 });
    };
    /** The colour in the middle of the view, looking along (x, y, z) from the camera. */
    const look = (x, y, z) => page.evaluate(async ([x, y, z]) => {
        const s = document.querySelector("garden-scene").scene, engine = s.getEngine(), cam = s.activeCamera;
        const V = cam.position.constructor;
        cam.setTarget(cam.position.add(new V(x, y, z)));
        s.render();
        const px = await engine.readPixels(Math.floor(engine.getRenderWidth() / 2), Math.floor(engine.getRenderHeight() / 2), 1, 1);
        return [px[0], px[1], px[2]];
    }, [x, y, z]);

    // The right way up: red above the horizon, blue below.
    await sky(g => { g.fillStyle = "#ff0000"; g.fillRect(0, 0, 256, 64); g.fillStyle = "#0000ff"; g.fillRect(0, 64, 256, 64); });
    const s = await page.evaluate(() => { const d = document.querySelector("garden-sky").panoramaSky.domes[0]; return { pick: d.mesh.isPickable, far: d.mesh.infiniteDistance }; });
    check("the sky's dome can't be picked and sits at the sky's distance", s.pick === false && s.far === true, JSON.stringify(s));
    // 40° up and down: well inside each half, away from the poles (the wrap there blends the two).
    const up = await look(0, 0.84, 1), down = await look(0, -0.84, 1);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    check("looking up you see the photo's top (red), not its bottom (blue)", up[0] > 150 && up[2] < 100, JSON.stringify(up));
    check("looking down you see the photo's bottom (blue)", down[2] > 150 && down[0] < 100, JSON.stringify(down));

    // Not mirrored: turning right round the circle meets the strips in the photo's order (a turn of it).
    await sky(g => { ["#ff0000", "#00ff00", "#0000ff", "#ffff00"].forEach((colour, i) => { g.fillStyle = colour; g.fillRect(i * 64, 0, 64, 128); }); });
    const seen = [];
    // Facing +z, then turning right (clockwise seen from above: +z, +x, -z, -x), 30° up.
    for (const [x, z] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const [r, g, b] = (await look(x, 0.58, z)).map(v => v > 128);
        seen.push(r && g ? "Y" : r ? "R" : g ? "G" : b ? "B" : "?");
    }
    const round = seen.join(""), order = "RGBY";
    check("turning right you meet the photo's strips left to right (not mirrored)", [0, 1, 2, 3].some(k => order.slice(k) + order.slice(0, k) === round), round);
    check("no page errors", errors.length === 0, errors.join(" | "));
});
