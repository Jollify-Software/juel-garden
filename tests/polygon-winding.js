// Browser test of <garden-polygon extrude> winding: Babylon's ExtrudePolygon only
// builds its sides facing out for one winding, so a shape listed the other way round
// showed just its top (its sides culled). Two blocks, one per winding: the triangles
// of each one's south side must wind to face south (out), not north (in).
// Run after a build: npm run test:polygon-winding. Same harness as opening.js.
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
        const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
        await page.route(ORIGIN + "/**", route => {
            const f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        await page.route(ORIGIN + "/winding-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body style="margin:0">
<garden-scene>
  <garden-camera type="free" position="0 2.5 -25"></garden-camera>
  <garden-light></garden-light>
  <garden-polygon id="ccw" extrude shape="-12 0 -3, -6 0 -3, -6 0 3, -12 0 3" depth="5" position="0 5 0" colour="#ff0000"></garden-polygon>
  <garden-polygon id="cw" extrude shape="6 0 -3, 6 0 3, 12 0 3, 12 0 -3" depth="5" position="0 5 0" colour="#ff0000"></garden-polygon>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/winding-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        // The normals each block's triangles face by their winding (what culling goes by),
        // averaged over the vertices on the south (z = -3; the corners share the east/west
        // sides, so about -0.5 when they face out, +0.5 when in).
        const south = await page.evaluate(() => Object.fromEntries(["ccw", "cw"].map(id => {
            const m = document.getElementById(id).mesh;
            const pos = m.getVerticesData("position"), idx = m.getIndices(), derived = [];
            BABYLON.VertexData.ComputeNormals(pos, idx, derived);
            let z = 0, n = 0;
            for (let v = 0; v < pos.length / 3; v++)
                if (Math.abs(pos[v * 3 + 2] + 3) < 1e-3 && Math.abs(derived[v * 3 + 1]) < 0.5) { z += derived[v * 3 + 2]; n++; }
            return [id, n ? +(z / n).toFixed(2) : null];
        })));
        check("counter-clockwise shape: its south side faces out", south.ccw < -0.25, String(south.ccw));
        check("clockwise shape: its south side faces out too (turned round)", south.cw < -0.25, String(south.cw));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
