// End to end: a plan whose pictures have a real size (data-<surface>-size, "1.5 1" metres across
// and up) -> parterre -> the page in Chrome. For every <garden-texture size>, the test finds the
// faces wearing it and works out, from their positions, their UVs and the texture's own matrix (not
// from juel-garden's sizing code), how many metres one picture covers across and up, and which way
// "up" points. A picture of one size must cover that size on a box room's long and short walls, a
// polygon room's walls, a round room's wall, a free-standing wall, floors, the ground's pieces and a
// dome's inside. The control: the same rooms with a -repeat count, where a count covers a different
// size on a box wall and a polygon wall (Sue's item 24, 2026-11-06).
// Needs the sibling C:\Jollify\parterre checkout and dotnet:  node tests/parterre-texture-size.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const PARTERRE = path.resolve(ROOT, "..", "parterre");
const OUT = path.join(os.tmpdir(), "juel-garden-parterre-texture-size");
const ORIGIN = "http://parterre.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".png": "image/png" };
// A 4x4 grey PNG: what it looks like doesn't matter, only where it lands.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAAAAACMmsGiAAAAEUlEQVR4nGNoYGBgYGBgYAAABZABgWcBmKcAAAAASUVORK5CYII=", "base64");

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

// At --scale 0.05 (20 px a metre). Each surface has its own picture file, so its <garden-texture> is easy to find.
const PLAN = `<svg xmlns="http://www.w3.org/2000/svg">
<rect data-fixture="ground" data-id="g" x="-200" y="-200" width="1400" height="1000" data-floor-texture="t/ground.png" data-floor-size="3"/>
<rect data-fixture="room" data-id="box" x="0" y="0" width="320" height="80"
      data-walls-texture="t/brick.png" data-walls-size="1.5 1" data-floor-texture="t/floor.png" data-floor-size="2"
      data-east-texture="t/east.png" data-east-size="0.5 0.5"/>
<polygon data-fixture="room" data-id="poly" points="400,0 560,0 600,80 400,120" data-walls-texture="t/poly.png" data-walls-size="1.5 1"/>
<circle data-fixture="room" data-id="round" cx="800" cy="60" r="60" data-roof="dome"
        data-walls-texture="t/round.png" data-walls-size="1.5 1" data-roof-inside-texture="t/dome.png" data-roof-inside-size="1"/>
<rect data-fixture="wall" data-id="w" x="0" y="300" width="300" height="6" data-walls-texture="t/wall.png" data-walls-size="1.5 1"/>
<rect data-fixture="room" data-id="cbox" x="0" y="500" width="320" height="80" data-walls-texture="t/cbox.png" data-walls-repeat="4 3"/>
<polygon data-fixture="room" data-id="cpoly" points="400,500 560,500 600,580 400,620" data-walls-texture="t/cpoly.png" data-walls-repeat="4 3"/>
</svg>`;

/** The page's own measure of every <garden-texture>: each triangle wearing it, through the texture's matrix. */
function measureInPage() {
    const scene = document.querySelector("garden-scene").scene;
    const slots = ["diffuse", "bump", "emissive", "specular", "opacity", "ambient"];
    const wears = (m, t) => !!m && slots.some(s => m[s + "Texture"] == t);
    const out = [];
    for (const el of document.querySelectorAll("garden-texture")) {
        const t = el.texture, M = t.getTextureMatrix().m;
        const tri = [];
        for (const mesh of scene.meshes) {
            const mat = mesh.material;
            if (!mat || !mesh.isEnabled()) continue;
            const subs = mat.subMaterials ? (mesh.subMeshes || []).filter(s => wears(mat.subMaterials[s.materialIndex], t)) : wears(mat, t) ? [null] : [];
            if (!subs.length) continue;
            const P = mesh.getVerticesData("position"), U = mesh.getVerticesData("uv"), I = mesh.getIndices(), W = mesh.computeWorldMatrix(true);
            if (!P || !U || !I) continue;
            const at = i => BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), W);
            // The picture coordinate a vertex gets in the shader: (M * vec4(uv, 1, 0)).xy.
            const pic = i => [M[0] * U[i * 2] + M[4] * U[i * 2 + 1] + M[8], M[1] * U[i * 2] + M[5] * U[i * 2 + 1] + M[9]];
            for (const s of subs) {
                const start = s ? s.indexStart : 0, end = start + (s ? s.indexCount : I.length);
                for (let k = start; k + 2 < end; k += 3) {
                    const a = I[k], b = I[k + 1], c = I[k + 2];
                    const p0 = at(a), e1 = at(b).subtract(p0), e2 = at(c).subtract(p0);
                    const [x0, y0] = pic(a), [x1, y1] = pic(b), [x2, y2] = pic(c);
                    const dx1 = x1 - x0, dy1 = y1 - y0, dx2 = x2 - x0, dy2 = y2 - y0, det = dx1 * dy2 - dx2 * dy1;
                    const cross = BABYLON.Vector3.Cross(e1, e2), area = cross.length() / 2;
                    if (Math.abs(det) < 1e-9 || area < 1e-6) continue;
                    // How far the surface moves for one picture across, and one up (the inverse of the Jacobian).
                    const across = e1.scale(dy2).subtract(e2.scale(dy1)).scale(1 / det);
                    const up = e2.scale(dx1).subtract(e1.scale(dx2)).scale(1 / det);
                    const n = cross.normalize();
                    tri.push({ area, across: across.length(), up: up.length(), upright: Math.abs(up.y) / up.length(), wall: Math.abs(n.y) < 0.2 });
                }
            }
        }
        out.push({ src: el.getAttribute("src"), size: el.getAttribute("size"), turn: el.getAttribute("turn"), tri });
    }
    return out;
}

(async () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(path.join(OUT, "t"), { recursive: true });
    for (const name of ["ground", "brick", "floor", "east", "poly", "round", "dome", "wall", "cbox", "cpoly"])
        fs.writeFileSync(path.join(OUT, "t", name + ".png"), PNG);
    const planFile = path.join(OUT, "plan.svg");
    fs.writeFileSync(planFile, PLAN);
    execFileSync("dotnet", ["run", "--project", path.join(PARTERRE, "Parterre.Cli"), "--",
        "--in", planFile, "--out", path.join(OUT, "scene.html"), "--scale", "0.05", "--height", "3",
        "--no-directory", "--garden", path.join(ROOT, "dist", "juel-garden.js")], { stdio: "inherit" });

    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [...require("./gpu").GPU_ARGS] });
    try {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        await page.route("**/*", route => {
            const url = route.request().url();
            if (!url.startsWith(ORIGIN + "/")) return route.abort();
            const f = path.join(OUT, decodeURIComponent(new globalThis.URL(url).pathname));
            if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push("pageerror: " + e.message));
        page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
        await page.goto(ORIGIN + "/scene.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 45000 });
        await page.waitForTimeout(3000); // structure joins and CSG cuts finish
        const measured = await page.evaluate(measureInPage);

        // The area-weighted median of a value over the faces that matter (the wall faces of a wall, all of a floor).
        const median = (tri, key) => {
            const sorted = [...tri].sort((a, b) => a[key] - b[key]), half = sorted.reduce((s, t) => s + t.area, 0) / 2;
            let run = 0;
            for (const t of sorted) if ((run += t.area) >= half) return t[key];
            return NaN;
        };
        const close = (got, want, within) => Math.abs(got - want) <= want * within;
        const r2 = n => Math.round(n * 100) / 100;
        const byName = name => measured.filter(m => m.src == `t/${name}.png`);
        const report = (name, wall, within = 0.05) => {
            const all = byName(name);
            check(`${name}: found and worn`, all.length > 0 && all.every(m => m.tri.length > 0), JSON.stringify(all.map(m => m.tri.length)));
            for (const m of all) {
                const faces = wall ? m.tri.filter(t => t.wall) : m.tri;
                const [want, wantUp = want] = (m.size || "").split(" ").map(Number);
                const across = median(faces, "across"), up = median(faces, "up"), upright = median(faces, "upright");
                const label = `${name}${m.turn ? ` (turn ${m.turn})` : ""}`;
                check(`${label}: one picture covers ${want} m across and ${wantUp} m up`,
                    close(across, want, within) && close(up, wantUp, within), `${r2(across)} x ${r2(up)} m`);
                if (wall)
                    check(`${label}: the picture stands upright`, upright > 0.95, `up is ${r2(upright)} vertical`);
            }
        };

        report("brick", true);       // the box room's north, south and west walls (16 m and 4 m long)
        report("east", true);        // its east side, a size of its own
        report("floor", false);
        report("poly", true);        // a polygon room's walls, laid in metres by juel-garden
        report("round", true, 0.1);  // a round room's wall, swept round its ring
        report("wall", true);        // a free-standing wall
        report("ground", false);     // the ground, cut into pieces round the rooms
        report("dome", false, 0.25); // a dome's inside: curved, so only roughly

        // The control: one count, two shapes, two sizes.
        const cbox = byName("cbox").map(m => median(m.tri.filter(t => t.wall), "across"));
        const cpoly = byName("cpoly").map(m => median(m.tri.filter(t => t.wall), "across"));
        check("control: a -repeat count covers a different size on a box wall and a polygon wall",
            cbox.length > 0 && cpoly.length > 0 && !close(cpoly[0], cbox[0], 0.5), `box ${cbox.map(r2)} m, polygon ${cpoly.map(r2)} m`);
        check("no page errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(failed ? `${failed} failed` : "all passed");
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
