// Browser test of <garden-ground>'s default material: a bare ground reads as grass, and one
// with a <garden-material> child gets that material and no orphaned default (the default
// used to be built before the parser reached the child). Serves a small inline page.
// Run after a build: npm run test:ground. Same harness as rotunda.js.
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
        await page.route(ORIGIN + "/ground-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-ground id="g" width="8" height="8">
    <garden-material colour="#ff0000"></garden-material>
  </garden-ground>
  <garden-ground id="bare" width="8" height="8" position="10 0 0"></garden-ground>
  <garden-ground id="coloured" width="8" height="8" position="20 0 0" colour="#0000ff"></garden-ground>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/ground-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(500);
        const got = await page.evaluate(() => {
            const s = document.querySelector("garden-scene").scene;
            const hex = id => document.getElementById(id).mesh.material?.diffuseColor?.toHexString() ?? null;
            const used = new Set(s.meshes.map(m => m.material).filter(Boolean));
            return { g: hex("g"), bare: hex("bare"), coloured: hex("coloured"),
                     orphans: s.materials.filter(m => !used.has(m)).map(m => m.name) };
        });
        check("a <garden-material> child wins", got.g == "#FF0000", JSON.stringify(got));
        check("a bare ground is grass green", got.bare == "#6B8F4E", JSON.stringify(got));
        check("a colour attribute wins", got.coloured == "#0000FF", JSON.stringify(got));
        check("no orphaned materials", got.orphans.length == 0, JSON.stringify(got));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
