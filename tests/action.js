// Browser test of a mesh's `action="..."` attribute naming a <garden-action> in the initial
// markup: the action must reach the mesh's ActionManager, whichever comes first in the page.
// Serves a small inline page. Run after a build: npm run test:action. Same harness as rotunda.js.
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
        await page.route(ORIGIN + "/action-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-action id="hoverIn" type="set" trigger="pointerOver" target="material"
                 property="emissiveColor" value="white"></garden-action>
  <garden-box id="first" size="1" colour="red" action="hoverIn"></garden-box>
  <garden-box id="before" size="1" colour="red" position="2 0 0" action="hoverLate"></garden-box>
  <garden-action id="hoverLate" type="set" trigger="pointerOver" target="material"
                 property="emissiveColor" value="white"></garden-action>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/action-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(500);
        const counts = await page.evaluate(() => Object.fromEntries(["first", "before"].map(id =>
            [id, document.getElementById(id).mesh?.actionManager?.actions?.length ?? 0])));
        check("an action declared before its mesh reaches the mesh's ActionManager", counts.first > 0, JSON.stringify(counts));
        check("an action declared after its mesh reaches the mesh's ActionManager", counts.before > 0, JSON.stringify(counts));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
