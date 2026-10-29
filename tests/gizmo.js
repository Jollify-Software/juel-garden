// Browser test of <garden-gizmo> placed *before* the meshes it attaches to, in the initial
// markup: its `elements` selectors must still resolve (they used to be looked up before the
// parser had reached them). Serves a small inline page. Run after a build: npm run test:gizmo.
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
        await page.route(ORIGIN + "/gizmo-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-gizmo id="before" elements="#late"></garden-gizmo>
  <garden-box id="late" size="1"></garden-box>
  <garden-box id="early" size="1" position="0 0 4"></garden-box>
  <garden-gizmo id="after" elements="#early"></garden-gizmo>
  <garden-gizmo id="missing" elements="#nothing-here"></garden-gizmo>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/gizmo-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(500);
        const got = await page.evaluate(() => {
            const names = id => document.getElementById(id).manager?.attachableMeshes?.map(m => m?.uniqueId ?? null) ?? null;
            return { before: names("before"), after: names("after"),
                     late: document.getElementById("late").mesh?.uniqueId, early: document.getElementById("early").mesh?.uniqueId };
        });
        check("a gizmo after its mesh attaches to it", JSON.stringify(got.after) == JSON.stringify([got.early]), JSON.stringify(got));
        check("a gizmo before its mesh attaches to it", JSON.stringify(got.before) == JSON.stringify([got.late]), JSON.stringify(got));
        check("no page errors (a selector matching nothing only warns)", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
