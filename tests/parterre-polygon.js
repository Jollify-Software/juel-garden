// End to end: Parterre's samples/polygon-plan.svg (a plain hall, an L-shaped
// <polygon> room sharing its east wall, a rect turned 20 degrees) -> parterre
// -> the page in Chrome, read back through Babylon. Needs the sibling
// C:\Jollify\parterre checkout and dotnet; run after a build:
//   node tests/parterre-polygon.js
// Same harness as rotunda.js, serving the generated folder instead of the repo.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const PARTERRE = path.resolve(ROOT, "..", "parterre");
const OUT = path.join(os.tmpdir(), "juel-garden-parterre-polygon");
const ORIGIN = "http://parterre.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

(async () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    execFileSync("dotnet", ["run", "--project", path.join(PARTERRE, "Parterre.Cli"), "--",
        "--in", path.join(PARTERRE, "samples", "polygon-plan.svg"), "--out", path.join(OUT, "scene.html"),
        "--scale", "0.1", "--garden", path.join(ROOT, "dist", "juel-garden.js")], { stdio: "inherit" });

    const browser = await chromium.launch({ executablePath: CHROME, headless: true,
        args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"] });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        await page.route(ORIGIN + "/**", route => {
            const f = path.join(OUT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
            if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push("pageerror: " + e.message));
        page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
        await page.goto(ORIGIN + "/scene.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(2000); // structure joins finish

        const rooms = await page.evaluate(() => ["hall", "ell", "turned"].map(id => {
            const el = document.getElementById(id);
            const m = el.mesh;
            const pos = m.getVerticesData("position"), idx = m.getIndices();
            let floorArea = 0;
            for (let i = 0; i < idx.length; i += 3) {
                const p = [0, 1, 2].map(k => Array.from(pos.slice(idx[i + k] * 3, idx[i + k] * 3 + 3)));
                if (!p.every(v => Math.abs(v[1]) < 1e-3)) continue;
                floorArea += Math.abs((p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) - (p[2][0] - p[0][0]) * (p[1][2] - p[0][2])) / 2;
            }
            // Edge lengths of the outer outline, from the room's own `points`.
            const pts = el.points.map(p => [p.x, p.z]);
            const edges = pts.map((p, i) => +Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]).toFixed(2));
            return { id, type: el.type, corners: el.wallLoop?.length ?? 0, floorArea: +floorArea.toFixed(2), edges };
        }));
        const [hall, ell, turned] = rooms;
        check("the hall stays a box room", hall.type == "rect" && hall.corners == 0, JSON.stringify(hall));
        check("the L <polygon> is a polygon room with 6 corners", ell.type == "polygon" && ell.corners == 6, JSON.stringify(ell));
        check("the rotated rect is a polygon room, not its bounding box: 4 corners, edges 10/6/10/6",
            turned.type == "polygon" && turned.corners == 4 && JSON.stringify(turned.edges) == "[10,6,10,6]", JSON.stringify(turned));
        check("the rotated room's floor is 10 x 6 = 60 m2", Math.abs(turned.floorArea - 60) < 0.05, String(turned.floorArea));

        // The hall (box) and the L (polygon) share the plan's x = 100 wall: a ray
        // east from the hall's centre line at plan y = 30 (scene z = 8: plan north is +z) goes
        // through the doorway and on to the L's east wall (inner face x = 8.8).
        const ray = await page.evaluate(() => {
            const scene = document.querySelector("garden-scene").scene;
            const V = scene.activeCamera.position.constructor;
            const Ray = scene.activeCamera.getForwardRay().constructor;
            const hit = scene.pickWithRay(new Ray(new V(-8, 1.2, 8), new V(1, 0, 0), 100), m => m.isVisible && m.isPickable);
            return hit?.hit ? +hit.distance.toFixed(2) : null;
        });
        check("hall -> L doorway cut by the structure (16.8 m, not 4.8)", Math.abs(ray - 16.8) < 0.05, String(ray));

        await page.screenshot({ path: path.join(OUT, "scene.png") });
        check("no errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
