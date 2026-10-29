// Browser test of <garden-webxr teleportation>: it defaults to on, and teleportation="false"
// turns it off (a plain Lit Boolean read any present value as true, so it could never be
// turned off). Reads the property and, where headless Chrome builds the XR experience, the
// teleportation feature. Serves a small inline page. Run after a build:
// npm run test:webxr. Same harness as rotunda.js.
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
        const errors = [];
        const read = async (attr, extra = "") => {
            const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
            page.on("pageerror", e => errors.push(e.message));
            await page.route(ORIGIN + "/**", route => {
                const f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
                if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                    return route.fulfill({ status: 404, body: "" });
                route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
            });
            await page.route(ORIGIN + "/webxr-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="10" height="10"></garden-ground>
  ${extra}
  <garden-webxr ${attr}></garden-webxr>
</garden-scene></body></html>` }));
            await page.goto(ORIGIN + "/webxr-test.html", { waitUntil: "load" });
            await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
            await page.waitForTimeout(1500);
            const got = await page.evaluate(() => {
                const el = document.querySelector("garden-webxr");
                return { prop: el.teleportation, xr: !!el.xr, teleport: el.xr ? !!el.xr.teleportation : null,
                         floors: el.floorMeshes.map(m => m.name) };
            });
            await page.close();
            return got;
        };
        const unset = await read("");
        const bare = await read("teleportation");
        const off = await read('teleportation="false"');
        check("unset: teleportation is on", unset.prop === true && unset.teleport !== false, JSON.stringify(unset));
        check("bare attribute: teleportation is on", bare.prop === true && bare.teleport !== false, JSON.stringify(bare));
        check("teleportation=\"false\": teleportation is off", off.prop === false && !off.teleport, JSON.stringify(off));
        const env = await read("", '<garden-sky environment="default"></garden-sky>');
        check("floors: every garden-ground, and a default environment's ground", unset.floors.length == 1 && env.floors.length == 2 && env.floors.includes("BackgroundPlane"), JSON.stringify([unset.floors, env.floors]));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
