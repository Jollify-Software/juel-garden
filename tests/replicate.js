// Browser test of <garden-replicate> placed *before* the elements it copies, in the initial
// markup: its source ids must still resolve (they used to be looked up before the parser had
// reached them). Serves a small inline page. Run after a build: npm run test:replicate.
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
        await page.route(ORIGIN + "/replicate-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-replicate instances='["late"]' positions="0: 4 0 0, 0: 8 0 0, 0: 12 0 0"
                    rotations="0: 0 0 0, 0: 0 0 0, 0: 0 0 0"></garden-replicate>
  <garden-box id="late" size="1"></garden-box>
  <garden-box id="early" size="1" position="0 0 4"></garden-box>
  <garden-replicate instances='["early"]' positions="0: 4 0 4, 0: 8 0 4"
                    rotations="0: 0 0 0, 0: 0 0 0"></garden-replicate>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/replicate-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(500);
        const counts = await page.evaluate(() => ({
            late: document.getElementById("late").mesh?.instances?.length ?? null,
            early: document.getElementById("early").mesh?.instances?.length ?? null,
        }));
        check("a replicate after its source makes its instances (2)", counts.early == 2, JSON.stringify(counts));
        check("a replicate before its source makes its instances (3)", counts.late == 3, JSON.stringify(counts));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
