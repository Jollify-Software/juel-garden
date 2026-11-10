// End to end: a plain room (no pictures, no colours) -> parterre -> the page in Chrome. Standing in the middle,
// the test looks at each of the room's four corners, and reads a pixel on each wall either side of it: the two
// must differ, or a person sees one flat wall (Sue's walk, 2026-11-06: "two plain walls meet with no visible
// corner"). Parterre tips its all-round light's "up" so each way a wall faces gets its own shade. The control is
// in the test: the same light set back to straight up, where every corner must vanish.
// Needs the sibling C:\Jollify\parterre checkout and dotnet:  node tests/parterre-corners.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const PARTERRE = path.resolve(ROOT, "..", "parterre");
const OUT = path.join(os.tmpdir(), "juel-garden-parterre-corners");
const ORIGIN = "http://parterre.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

// 10 m by 8 m at --scale 0.05, plain: juel-garden's own room colours.
const PLAN = `<svg xmlns="http://www.w3.org/2000/svg">
<rect data-fixture="room" data-id="hall" x="0" y="0" width="200" height="160"/>
</svg>`;

(async () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    const planFile = path.join(OUT, "plan.svg");
    fs.writeFileSync(planFile, PLAN);
    execFileSync("dotnet", ["run", "--project", path.join(PARTERRE, "Parterre.Cli"), "--",
        "--in", planFile, "--out", path.join(OUT, "scene.html"), "--scale", "0.05", "--height", "3",
        "--no-directory", "--garden", path.join(ROOT, "dist", "juel-garden.js")], { stdio: "inherit" });

    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [...require("./gpu").GPU_ARGS] });
    try {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        await page.route(ORIGIN + "/**", route => {
            const f = path.join(OUT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
            if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push("pageerror: " + e.message));
        await page.goto(ORIGIN + "/scene.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 45000 });
        await page.waitForTimeout(2500);

        // From the room's middle at eye height, look at each corner; read the wall 40 px either side of it.
        const corners = (up) => page.evaluate(async up => {
            const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine(), camera = scene.activeCamera;
            engine.stopRenderLoop();
            const hemi = scene.lights.find(l => l.getClassName() == "HemisphericLight");
            if (up) hemi.direction = new BABYLON.Vector3(...up);
            const room = document.getElementById("hall").mesh, box = room.getHierarchyBoundingVectors(true);
            const mid = box.min.add(box.max).scale(0.5);
            camera.position = new BABYLON.Vector3(mid.x, 1.6, mid.z);
            const canvas = engine.getRenderingCanvas(), out = [];
            const lum = async (x, y) => { const d = await engine.readPixels(Math.round(x), Math.round(canvas.height - y), 1, 1); return Math.round(0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]); };
            for (const [name, cx, cz] of [["north-east", box.max.x, box.max.z], ["south-east", box.max.x, box.min.z], ["south-west", box.min.x, box.min.z], ["north-west", box.min.x, box.max.z]]) {
                const corner = new BABYLON.Vector3(cx, 1.6, cz);
                camera.setTarget(corner);
                scene.render();
                const at = BABYLON.Vector3.Project(corner, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(canvas.width, canvas.height));
                out.push({ name, left: await lum(at.x - 40, at.y), right: await lum(at.x + 40, at.y) });
            }
            return { hemi: hemi.direction.asArray().map(v => +v.toFixed(2)), corners: out };
        }, up);

        const tipped = await corners(null);
        const visible = tipped.corners.map(c => ({ ...c, step: Math.abs(c.left - c.right) }));
        console.log("      light up", JSON.stringify(tipped.hemi), JSON.stringify(visible));
        check("the scene's all-round light isn't straight up", Math.abs(tipped.hemi[0]) + Math.abs(tipped.hemi[2]) > 0.2, JSON.stringify(tipped.hemi));
        for (const c of visible)
            check(`the ${c.name} corner shows: its two walls differ`, c.step >= 6, `${c.left} | ${c.right}`);

        const flat = await corners([0, 1, 0]);
        const gone = flat.corners.map(c => ({ ...c, step: Math.abs(c.left - c.right) }));
        console.log("      control, straight up", JSON.stringify(gone));
        check("control: with the light straight up, no corner shows (Sue's flat walls)", gone.every(c => c.step <= 2), JSON.stringify(gone));
        check("no page errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
