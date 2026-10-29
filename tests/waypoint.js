// Browser test of <garden-waypoint>: clicking a stop flies the camera there with no
// `offset` set (no page error), and `speed` sets the fly-to animation's speed ratio.
// Serves a small inline page; the click is scene.simulatePointerDown with the stop's mesh
// as the pick. Run after a build: npm run test:waypoint.
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

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true,
        args: [...require("./gpu").GPU_ARGS] });
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
        const pageFor = (attrs) => `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="free">
    <garden-waypoint ${attrs} waypoints="#wp1 #wp2"></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-box id="wp1" position="0 0.5 3" size="1"></garden-box>
  <garden-box id="wp2" position="10 0.5 3" size="1"></garden-box>
</garden-scene></body></html>`;
        // Clicks wp2, then reports the camera animation's speed ratio and, after `waitMs`,
        // where the camera is.
        async function run(name, attrs, waitMs) {
            await page.route(ORIGIN + "/" + name, route => route.fulfill({ status: 200, contentType: "text/html", body: pageFor(attrs) }));
            await page.goto(ORIGIN + "/" + name, { waitUntil: "load" });
            await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
            await page.waitForTimeout(500);
            const ratio = await page.evaluate(() => {
                const scene = document.querySelector("garden-scene").scene;
                const camera = document.querySelector("garden-camera").camera;
                scene.simulatePointerDown({ hit: true, pickedMesh: document.getElementById("wp2").mesh });
                return scene.getAnimatableByTarget(camera)?.speedRatio ?? null;
            });
            await page.waitForTimeout(waitMs);
            const pos = await page.evaluate(() => {
                const p = document.querySelector("garden-camera").camera.position;
                return { x: p.x, y: p.y, z: p.z };
            });
            return { ratio, pos };
        }

        let got = await run("waypoint-plain.html", "", 4500);
        check("no offset: no page errors on click", errors.length == 0, JSON.stringify(errors));
        check("no offset: camera flew to wp2 (10 0.5 3)", Math.abs(got.pos.x - 10) < 1e-3 && Math.abs(got.pos.y - 0.5) < 1e-3 && Math.abs(got.pos.z - 3) < 1e-3, JSON.stringify(got));
        check("no speed: speed ratio 1", got.ratio === 1, String(got.ratio));

        errors.length = 0;
        got = await run("waypoint-speed.html", 'offset="0 2 0" speed="4"', 1500);
        check("speed=4: speed ratio 4", got.ratio === 4, String(got.ratio));
        check("speed=4: camera at wp2 + offset within 1.5 s (10 2.5 3)", Math.abs(got.pos.x - 10) < 1e-3 && Math.abs(got.pos.y - 2.5) < 1e-3 && Math.abs(got.pos.z - 3) < 1e-3, JSON.stringify(got));
        check("speed=4: no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
