// Browser test of <garden-opening>: a square opening cuts its room (vertex count changes),
// and an unrecognised `type` warns and cuts nothing instead of throwing. Serves a small
// inline page. Run after a build: npm run test:opening. Same harness as rotunda.js.
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
        const warnings = [];
        page.on("pageerror", e => errors.push(e.message));
        page.on("console", m => { if (m.type() == "warning") warnings.push(m.text()); });
        await page.route(ORIGIN + "/opening-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-light></garden-light>
  <garden-room id="cut" width="6" depth="6" position="0 0 0"></garden-room>
  <garden-room id="uncut" width="6" depth="6" position="20 0 0"></garden-room>
  <garden-room id="plain" width="6" depth="6" position="40 0 0"></garden-room>
  <garden-opening between="#cut" position="0 1 -3" width="2" height="2" depth="0.6"></garden-opening>
  <garden-opening type="arched" between="#uncut" position="20 1 -3" width="2" height="2" depth="0.6"></garden-opening>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/opening-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(2000);
        const got = await page.evaluate(() => Object.fromEntries(["cut", "uncut", "plain"].map(id =>
            [id, document.getElementById(id).mesh?.getTotalVertices() ?? null])));
        check("a square opening cut its room", got.cut != null && got.plain != null && got.cut != got.plain, JSON.stringify(got));
        check("an unknown type left its room uncut", got.uncut != null && got.uncut == got.plain, JSON.stringify(got));
        check("an unknown type warned", warnings.some(w => w.includes("garden-opening") && w.includes("arched")), JSON.stringify(warnings));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
