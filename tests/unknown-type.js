// Browser test of an unrecognised `type` on <garden-light> and <garden-column>: each warns
// and builds nothing instead of throwing, and a known type still builds. Serves a small
// inline page. Run after a build: npm run test:unknown-type. Same harness as rotunda.js.
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
        const warnings = [];
        page.on("pageerror", e => errors.push(e.message));
        page.on("console", m => { if (m.type() == "warning") warnings.push(m.text()); });
        await page.route(ORIGIN + "/unknown-type-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-light id="good-light"></garden-light>
  <garden-light id="bad-light" type="spot"></garden-light>
  <garden-column id="good-column" height="3" diameter="0.5" position="0 0 0"></garden-column>
  <garden-column id="bad-column" type="square" height="3" diameter="0.5" position="2 0 0"></garden-column>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/unknown-type-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(1000);
        const got = await page.evaluate(() => ({
            lights: document.querySelector("garden-scene").scene.lights.length,
            goodLight: !!document.getElementById("good-light").light,
            badLight: !!document.getElementById("bad-light").light,
            goodColumn: !!document.getElementById("good-column").mesh,
            badColumn: !!document.getElementById("bad-column").mesh,
        }));
        check("a hemi light and a round column still build", got.goodLight && got.goodColumn, JSON.stringify(got));
        check("type=\"spot\" light built nothing (1 light in the scene)", !got.badLight && got.lights == 1, JSON.stringify(got));
        check("type=\"square\" column built nothing", !got.badColumn, JSON.stringify(got));
        check("both warned", warnings.some(w => w.includes("garden-light") && w.includes("spot")) && warnings.some(w => w.includes("garden-column") && w.includes("square")), JSON.stringify(warnings));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
