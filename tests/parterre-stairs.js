// End to end: Parterre's samples/two-storey-plan.svg (a hall, stairs in its corner, a
// landing on the storey above, all in one garden-structure) -> parterre -> the page in
// Chrome. Checks garden-stairs punches the upper floor: a ray straight down inside the
// stairs' footprint passes the landing's floor, one beside it lands on it. Needs the
// sibling C:\Jollify\parterre checkout and dotnet; run after a build:
//   node tests/parterre-stairs.js
// Same harness as rotunda.js, serving the generated folder instead of the repo.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const PARTERRE = path.resolve(ROOT, "..", "parterre");
const OUT = path.join(os.tmpdir(), "juel-garden-parterre-stairs");
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
        "--in", path.join(PARTERRE, "samples", "two-storey-plan.svg"), "--out", path.join(OUT, "scene.html"),
        "--scale", "0.05", "--garden", path.join(ROOT, "dist", "juel-garden.js")], { stdio: "inherit" });

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

        // Straight-down rays from above the landing; the first thing hit, and at what height.
        // The stairs rect is x -5..-2, z -2..-7 in the scene (plan north is +z; position is
        // the foot's centre, climbing south, -z), so (-3.5, -2.5) is near the foot and
        // (-3.5, -6.5) near the top.
        const down = await page.evaluate(([points]) => {
            const scene = document.querySelector("garden-scene").scene;
            const owner = m => { while (m && !m.element) m = m.parent; return m?.element?.id || "(none)"; };
            return points.map(([x, z]) => {
                const ray = new BABYLON.Ray(new BABYLON.Vector3(x, 5.5, z), new BABYLON.Vector3(0, -1, 0), 20);
                const hit = scene.pickWithRay(ray, m => m.isPickable && m.isEnabled() && m.isVisible);
                return { x, z, hit: hit?.hit ? owner(hit.pickedMesh) : "(none)", y: hit?.hit ? +hit.pickedPoint.y.toFixed(2) : null };
            });
        }, [[[-3.5, -2.5], [-3.5, -6.5], [3, -4.5], [-3.5, 0]]]);
        const [well, well2, beside, behind] = down;
        check("beside the stairs, a ray down lands on the landing's floor (~3.2)",
            beside.hit == "landing" && Math.abs(beside.y - 3.2) < 0.25, JSON.stringify(beside));
        check("just north of the stairs' foot (same x), it lands on the landing's floor too",
            behind.hit == "landing" && Math.abs(behind.y - 3.2) < 0.25, JSON.stringify(behind));
        check("near the stairs' foot, the ray passes the landing's floor (headroom)",
            !(well.hit == "landing" && Math.abs(well.y - 3.2) < 0.25) && well.y < 3.0, JSON.stringify(well));
        check("near the top, it lands on the stairs, not the landing",
            well2.hit == "stairs-1", JSON.stringify(well2));
        check("no console errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
