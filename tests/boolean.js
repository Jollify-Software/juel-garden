// Browser test of `garden-boolean` (examples/Boolean/subtract.html): every CSG result is
// built, even when its operand (by id) comes later in the markup than the element. That
// used to race the HTML parser: getElementById found nothing and the page threw. The page
// is loaded several times because the race was intermittent.
// Run after a build: npm run test:boolean. Same harness as rotunda.js.
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

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true,
        args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"] });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        await page.route(ORIGIN + "/**", route => {
            const f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        const RUNS = 4;
        for (let run = 1; run <= RUNS; run++) {
            errors.length = 0;
            await page.goto(ORIGIN + "/examples/Boolean/subtract.html", { waitUntil: "load" });
            await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
            const meshes = await page.evaluate(() => [...document.querySelectorAll("garden-boolean")].map(b => ({
                op: b.getAttribute("subtract") ? "subtract " + b.getAttribute("subtract") : "intersect " + b.getAttribute("intersect"),
                parent: b.parentElement.id,
                vertices: b.mesh?.getTotalVertices() ?? 0,
            })));
            const built = meshes.filter(m => m.vertices > 0).length;
            check(`run ${run}: all ${meshes.length} CSG meshes built, no page errors`,
                meshes.length == 4 && built == 4 && errors.length == 0, JSON.stringify({ meshes, errors }));
            if (run == 1) {
                // A box minus a sphere has many more vertices than the 24 of a plain box.
                const boxMinusSphere = meshes.find(m => m.parent == "box1" && m.op == "subtract sphere");
                check("box1 minus sphere is a real cut (more than a plain box's 24 vertices)",
                    boxMinusSphere && boxMinusSphere.vertices > 24, JSON.stringify(boxMinusSphere));
            }
        }
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });