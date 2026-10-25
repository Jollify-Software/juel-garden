// Browser test of <garden-waypoint>'s start-up race (Jollify night 9's Q9): a second update
// that arrives while the first is still waiting for the document (an inline script sets
// `speed` once the first update has run, before DOMContentLoaded) must not set the stops up
// twice or hand the resolved array back to the selector code (the `n.trim is not a function`
// page error the Jollify app's e2e saw about 1 run in 6). Checks: one reticle, one pointer
// handler (a click flies once, to the right stop), no page errors.
// Run after a build: npm run test:waypoint-race. Same harness as waypoint.js.
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
        const page_ = (late) => `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="free">
    <garden-waypoint waypoints="#wp1 #wp2" dwell="1000"></garden-waypoint>
  </garden-camera>
  <script>
    // Once the first update has run (its updated() now awaits the document), ask for another.
    window.updates = [];
    const wp = document.querySelector("garden-waypoint");
    wp.updateComplete.then(() => { window.updates.push(document.readyState); wp.speed = 3; return wp.updateComplete; })
        .then(() => { window.updates.push(document.readyState); ${late ? 'wp.speed = 4;' : ''} });
  </script>
  <garden-light></garden-light>
  <garden-box id="wp1" position="0 0.5 3" size="1"></garden-box>
  <garden-box id="wp2" position="10 0.5 3" size="1"></garden-box>
</garden-scene></body></html>`;
        async function run(name, late) {
            errors.length = 0;
            await page.route(ORIGIN + "/" + name, route => route.fulfill({ status: 200, contentType: "text/html", body: page_(late) }));
            await page.goto(ORIGIN + "/" + name, { waitUntil: "load" });
            await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
            await page.waitForTimeout(800);
            return page.evaluate(() => {
                const scene = document.querySelector("garden-scene").scene;
                const wp = document.querySelector("garden-waypoint");
                const rings = scene.meshes.filter(m => m.name === "waypoint-reticle-ring").length;
                const resolved = Array.isArray(wp.waypoints) && wp.waypoints.length;
                let changes = 0;
                wp.addEventListener("waypoint-changed", () => changes++);
                scene.simulatePointerDown({ hit: true, pickedMesh: document.getElementById("wp2").mesh });
                return { updates: window.updates, rings, resolved, changes, speed: wp.speed };
            });
        }
        for (const [name, late] of [["race.html", false], ["race-late.html", true]]) {
            const got = await run(name, late);
            check(`${name}: the second update came before DOMContentLoaded`, got.updates[0] === "loading", JSON.stringify(got.updates));
            check(`${name}: the stops resolved (2)`, got.resolved === 2, String(got.resolved));
            check(`${name}: one reticle, not one per update`, got.rings === 1, String(got.rings));
            check(`${name}: one click is one move`, got.changes === 1, String(got.changes));
            check(`${name}: no page errors`, errors.length == 0, JSON.stringify(errors));
        }
    } finally {

        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
