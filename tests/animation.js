// Browser test of an event="load" <garden-animation target="id"> whose target is declared
// later in the markup and builds asynchronously (a garden-room), and of a target id that
// matches nothing (warns, no page error). Serves a small inline page.
// Run after a build: npm run test:animation. Same harness as rotunda.js.
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
        await page.route(ORIGIN + "/animation-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-box id="driver" size="1">
    <garden-animation target="hall" event="load" property="position.y" type="float"
                      from="0" to="30" speed="30" keyframes="0 0, 30 5"></garden-animation>
    <garden-animation target="nothing-here" event="load" property="position.y" type="float"
                      from="0" to="30" speed="30" keyframes="0 0, 30 5"></garden-animation>
  </garden-box>
  <garden-room id="hall" width="6" depth="6" position="10 0 0"></garden-room>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/animation-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(2000);
        const got = await page.evaluate(() => ({ y: document.getElementById("hall").mesh?.position?.y ?? null }));
        check("the later room was animated (y = 5)", got.y != null && Math.abs(got.y - 5) < 1e-3, JSON.stringify(got));
        check("no page errors (a missing target only warns)", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
