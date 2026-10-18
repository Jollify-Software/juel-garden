// Browser test of polygon rooms (examples/Structures/polygon-room.html):
// <garden-room type="polygon" points="...">. Reads the geometry back through
// Babylon -- the floor's top area, the wall loop, the bounds -- and casts rays
// at the inner wall faces. Run after a build: npm run test:polygon
// Same harness as rotunda.js.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}
const near = (a, b, tol = 0.05) => a && b.every((v, i) => Math.abs(a[i] - v) <= tol);

async function open(browser, file) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.route(ORIGIN + "/**", route => {
        const f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
            return route.fulfill({ status: 404, body: "" });
        route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    });
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(ORIGIN + "/examples/Structures/" + file, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
    await page.waitForTimeout(2000); // structure joins and openings finish
    return { page, errors };
}

// The room's geometry, read back from its mesh: bounds, the area of its
// triangles lying flat at floor level (local y = 0, i.e. the floor's top face),
// the wall loop's corner count, and the submaterial count.
const room = (page, id) => page.evaluate(id => {
    const el = document.getElementById(id);
    const m = el.mesh;
    const bb = m.getBoundingInfo().boundingBox;
    const r = v => +v.toFixed(2);
    const pos = m.getVerticesData("position"), idx = m.getIndices();
    let floorArea = 0;
    for (let i = 0; i < idx.length; i += 3) {
        const p = [0, 1, 2].map(k => Array.from(pos.slice(idx[i + k] * 3, idx[i + k] * 3 + 3)));
        if (!p.every(v => Math.abs(v[1]) < 1e-3)) continue;
        floorArea += Math.abs((p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) - (p[2][0] - p[0][0]) * (p[1][2] - p[0][2])) / 2;
    }
    return {
        min: bb.minimumWorld.asArray().map(r), max: bb.maximumWorld.asArray().map(r),
        floorArea: r(floorArea),
        corners: el.wallLoop?.length ?? 0,
        subMaterials: m.material?.subMaterials?.length ?? 0,
        finite: Array.from(pos).every(Number.isFinite),
        // Normals Babylon would derive from the winding vs. the ones stored: they
        // agree (dot > 0) everywhere when faces are wound the way they're lit.
        windingAgrees: (() => {
            const stored = m.getVerticesData("normal"), derived = [];
            BABYLON.VertexData.ComputeNormals(pos, idx, derived);
            for (let i = 0; i < stored.length; i += 3)
                if (stored[i] * derived[i] + stored[i + 1] * derived[i + 1] + stored[i + 2] * derived[i + 2] <= 0) return false;
            return true;
        })()
    };
}, id);

// Distance to the first thing a ray from `from` along `dir` hits. The walls are
// mitred, so an inner face sits exactly a thickness in from the outline.
const TOL = 0.02;
const cast = (page, from, dir) => page.evaluate(([from, dir]) => {
    const scene = document.querySelector("garden-scene").scene;
    const V = scene.activeCamera.position.constructor;
    const Ray = scene.activeCamera.getForwardRay().constructor;
    const hit = scene.pickWithRay(new Ray(new V(...from), new V(...dir), 100), m => m.isVisible && m.isPickable);
    return hit?.hit ? +hit.distance.toFixed(2) : null;
}, [from, dir]);

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true,
        args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"] });
    try {
        const { page, errors } = await open(browser, "polygon-room.html");

        const ell = await room(page, "ell");
        check("L: the floor fills the L (12 x 8 less 6 x 4 = 72 m2)", Math.abs(ell.floorArea - 72) < 0.05, String(ell.floorArea));
        check("L: one wall corner per point (6)", ell.corners == 6, String(ell.corners));
        check("L: outer face on the outline (x -21..-9, z -4..4)", near([ell.min[0], ell.min[2], ell.max[0], ell.max[2]], [-21, -4, -9, 4]), JSON.stringify(ell));
        check("L: walls rise to the height (4)", Math.abs(ell.max[1] - 4) < 0.05, String(ell.max[1]));
        check("L: two submaterials, floor and wall", ell.subMaterials == 2, String(ell.subMaterials));
        check("L: geometry is finite", ell.finite);
        check("L: every face is wound the way its normal points", ell.windingAgrees);
        // In the north arm (local z = 2), east from local x = -3: the notch's wall
        // (outer face at local x = 0, inner at -0.2) is 2.8 m away.
        const notch = await cast(page, [-18, 1.2, 2], [1, 0, 0]);
        check("L: the notch's wall stands where the outline turns (2.8 m east)", Math.abs(notch - 2.8) < TOL, String(notch));
        // In the south arm (local z = -2) the same ray runs on to the east wall (inner face at local x = 5.8).
        const arm = await cast(page, [-18, 1.2, -2], [1, 0, 0]);
        check("L: the south arm runs on to the east wall (8.8 m)", Math.abs(arm - 8.8) < TOL, String(arm));

        const you = await room(page, "you");
        check("U: floor area 12 x 10 less 4 x 6 = 96 m2", Math.abs(you.floorArea - 96) < 0.05, String(you.floorArea));
        check("U: 8 wall corners", you.corners == 8, String(you.corners));
        // In the west prong, east from x = -4: the gap between the prongs is walled at x = -2.2.
        const prong = await cast(page, [-4, 1.2, 2], [1, 0, 0]);
        check("U: the gap between the prongs is walled (1.8 m east)", Math.abs(prong - 1.8) < TOL, String(prong));
        const mats = await page.evaluate(() => document.getElementById("you").mesh.material.subMaterials.map(m => m.diffuseColor.toHexString()));
        check("U: slot materials applied (floor, wall)", mats[0] == "#6F6A5F" && mats[1] == "#C9B79A", JSON.stringify(mats));

        const pent = await room(page, "pent");
        // Shoelace of 0 6, -5 2, -3 -5, 3 -5, 5 2 = 76.
        check("pentagon (anticlockwise points): floor area 76 m2", Math.abs(pent.floorArea - 76) < 0.05, String(pent.floorArea));
        check("pentagon: 5 wall corners", pent.corners == 5, String(pent.corners));
        const down = await cast(page, [15, 3, 0], [0, -1, 0]);
        check("pentagon: a ray from above lands on the floor (3 m)", Math.abs(down - 3) < 0.05, String(down));

        // A hand-placed <garden-opening> in the pentagon's south wall: from outside,
        // north through it, the ray runs on to the far (north) wall's inner face.
        const door = await cast(page, [15, 1.2, -8], [0, 0, 1]);
        check("pentagon: the hand-placed opening is cut (a ray passes to the north wall)", door > 12, String(door));

        // <garden-structure>: the L's south arm shares its east edge (x = 0) with
        // the annex, so a doorway is cut there. Without it the ray would stop at
        // the L's inner face (2.8 m); through it, at the annex's east wall
        // (inner face x = 7.8, from x = -3: 10.8 m).
        const join = await cast(page, [-3, 1.2, -22], [1, 0, 0]);
        check("structure: the L and the annex are joined by a doorway", Math.abs(join - 10.8) < TOL, String(join));
        // The north arm's notch wall doesn't touch the annex: still solid.
        const solid = await cast(page, [-9, 1.2, -18], [1, 0, 0]);
        check("structure: the L's other walls stay solid (2.8 m)", Math.abs(solid - 2.8) < TOL, String(solid));
        const ell2 = await room(page, "ell2");
        check("structure: the cut L keeps both submaterials", ell2.subMaterials == 2 && ell2.finite, JSON.stringify(ell2));

        // A slanted shared wall: from (2, 2) in tri1, diagonally toward tri2. The
        // hypotenuse is 2.83 m away; through the doorway the ray reaches tri2's far corner.
        const diag = await cast(page, [22, 1.2, -22], [Math.SQRT1_2, 0, Math.SQRT1_2]);
        check("structure: a diagonal shared wall gets a doorway", diag > 6, String(diag));
        const beside = await cast(page, [21, 1.2, -18], [Math.SQRT1_2, 0, Math.SQRT1_2]);
        check("structure: ...only one, mid-wall (beside it the wall is solid)", beside > 0 && beside < 1.5, String(beside));

        await page.screenshot({ path: path.join(process.argv[2] || __dirname, "polygon-room.png") });
        check("no errors", errors.length == 0, errors.join(" | "));

        // Repeated corners: a closing point that repeats the first is dropped (4
        // corners, not 5), and points that leave fewer than three real corners
        // ("0 0, 5 0, 0 0") fall back to a box room (no wall loop) with a warning,
        // rather than a two-corner polygon.
        const warnings = [];
        page.on("console", m => { if (m.type() == "warning") warnings.push(m.text()); });
        const added = await page.evaluate(async () => {
            const scene = document.querySelector("garden-scene");
            const make = (id, points, x) => {
                const r = document.createElement("garden-room");
                r.id = id;
                r.setAttribute("type", "polygon");
                r.setAttribute("points", points);
                r.setAttribute("position", `${x} 0 60`);
                scene.appendChild(r);
                return r;
            };
            const rooms = [make("closed", "0 0, 4 0, 4 4, 0 4, 0 0", 0), make("degenerate", "0 0, 5 0, 0 0", 20)];
            for (let i = 0; i < 100 && !rooms.every(r => r.mesh); i++)
                await new Promise(res => setTimeout(res, 50));
            return rooms.map(r => ({ mesh: !!r.mesh, corners: r.wallLoop?.length ?? 0 }));
        });
        check("closing point repeating the first is dropped (4 corners)", added[0].mesh && added[0].corners == 4, JSON.stringify(added[0]));
        check("fewer than 3 distinct corners builds a box (no wall loop)", added[1].mesh && added[1].corners == 0, JSON.stringify(added[1]));
        check("...and warns", warnings.some(w => /needs at least three points/.test(w)), JSON.stringify(warnings));
        check("no errors after adding them", errors.length == 0, errors.join(" | "));

        // A roof on a polygon room sizes to its points, not the ignored width/depth
        // (default 8 x 16): an off-centre 10 x 4 rectangle, square (clip="false")
        // flat roof and a dome. World x 40..50, z 70..74 (position 40 0 70).
        const roofs = await page.evaluate(async () => {
            const scene = document.querySelector("garden-scene");
            const out = [];
            for (const [type, x] of [["flat", 40], ["dome", 60]]) {
                const r = document.createElement("garden-room");
                r.setAttribute("type", "polygon");
                r.setAttribute("points", "0 0, 10 0, 10 4, 0 4");
                r.setAttribute("position", `${x} 0 70`);
                const roof = document.createElement("garden-roof");
                roof.setAttribute("type", type);
                if (type == "flat") roof.setAttribute("clip", "false");
                r.appendChild(roof);
                scene.appendChild(r);
                for (let i = 0; i < 100 && !roof.mesh; i++)
                    await new Promise(res => setTimeout(res, 50));
                roof.mesh.computeWorldMatrix(true);
                const bb = roof.mesh.getBoundingInfo().boundingBox;
                out.push([bb.minimumWorld.x - x, bb.maximumWorld.x - x, bb.minimumWorld.z - 70, bb.maximumWorld.z - 70].map(v => +v.toFixed(2)));
            }
            // The same room under a <garden-structure>, the roof a structure child.
            const s = document.createElement("garden-structure");
            const r = document.createElement("garden-room");
            r.setAttribute("type", "polygon");
            r.setAttribute("points", "0 0, 10 0, 10 4, 0 4");
            r.setAttribute("position", "80 0 70");
            const roof = document.createElement("garden-roof");
            roof.setAttribute("clip", "false");
            s.append(r, roof);
            scene.appendChild(s);
            for (let i = 0; i < 100 && !roof.mesh; i++)
                await new Promise(res => setTimeout(res, 50));
            roof.mesh.computeWorldMatrix(true);
            const bb = roof.mesh.getBoundingInfo().boundingBox;
            out.push([bb.minimumWorld.x - 80, bb.maximumWorld.x - 80, bb.minimumWorld.z - 70, bb.maximumWorld.z - 70].map(v => +v.toFixed(2)));
            // A round rotunda (no depth attribute) is built width x width, so its roof
            // must be too, not width x the box default depth (16).
            const rot = document.createElement("garden-room");
            rot.setAttribute("type", "rotunda");
            rot.setAttribute("width", "12");
            rot.setAttribute("position", "100 0 70");
            const rroof = document.createElement("garden-roof");
            rroof.setAttribute("clip", "false");
            rot.appendChild(rroof);
            scene.appendChild(rot);
            for (let i = 0; i < 100 && !rroof.mesh; i++)
                await new Promise(res => setTimeout(res, 50));
            rroof.mesh.computeWorldMatrix(true);
            const rb = rroof.mesh.getBoundingInfo().boundingBox;
            out.push([rb.minimumWorld.x - 100, rb.maximumWorld.x - 100, rb.minimumWorld.z - 70, rb.maximumWorld.z - 70].map(v => +v.toFixed(2)));
            return out;
        });
        check("a round rotunda's square-cut roof is width x width (12 x 12)", near(roofs[3], [-6, 6, -6, 6], 0.05), JSON.stringify(roofs[3]));
        check("a structure's roof over a polygon room covers its points' bounds", near(roofs[2], [0, 10, 0, 4], 0.05), JSON.stringify(roofs[2]));
        check("flat roof (clip off) covers the points' bounds (x 0..10, z 0..4)", near(roofs[0], [0, 10, 0, 4], 0.05), JSON.stringify(roofs[0]));
        check("dome roof sits within the points' bounds", near(roofs[1], [0, 10, 0, 4], 0.3), JSON.stringify(roofs[1]));
        await page.close();
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
