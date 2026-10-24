// Browser test of <garden-room wall-thickness>: the walls grow inward from the outline
// (a ray from the centre meets the inner face width/2 - wall-thickness away), the floor
// slab keeps `thickness` (its top doesn't move), polygon and round rooms follow, and a
// <garden-structure> join cuts a doorway through two thick walls. Serves a small inline
// page. Run after a build: npm run test:wall-thickness. Same harness as opening.js.
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
const near = (a, b, tol = 0.03) => a != null && Math.abs(a - b) <= tol;

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
        await page.route(ORIGIN + "/wall-thickness-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 40 -60"></garden-camera>
  <garden-light></garden-light>
  <garden-room id="thin" width="10" depth="10" height="4" position="0 0 0"></garden-room>
  <garden-room id="thick" width="10" depth="10" height="4" wall-thickness="1.5" position="20 0 0"></garden-room>
  <garden-room id="poly" type="polygon" points="-5 -5, 5 -5, 5 5, -5 5" height="4" wall-thickness="1.5" position="40 0 0"></garden-room>
  <garden-room id="round" type="rotunda" width="10" height="4" wall-thickness="1.5" position="60 0 0"></garden-room>
  <garden-structure>
    <garden-room id="ja" width="10" depth="10" height="4" wall-thickness="1.5" position="-5 0 40"></garden-room>
    <garden-room id="jb" width="10" depth="10" height="4" wall-thickness="1.5" position="5 0 40"></garden-room>
  </garden-structure>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/wall-thickness-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(2000);
        const ray = (from, dir) => page.evaluate(([from, dir]) => {
            const scene = document.querySelector("garden-scene").scene;
            const V = scene.activeCamera.position.constructor;
            const Ray = scene.activeCamera.getForwardRay().constructor;
            const hit = scene.pickWithRay(new Ray(new V(...from), new V(...dir), 100), m => m.isVisible && m.isPickable);
            return hit?.hit ? { d: +hit.distance.toFixed(3), y: +hit.pickedPoint.y.toFixed(3) } : null;
        }, [from, dir]);
        const east = async (x, z = 0) => (await ray([x, 1.5, z], [1, 0, 0]))?.d;
        const floorTop = async (x) => (await ray([x, 3, 0], [0, -1, 0]))?.y;

        check("a thin room's inner face is 4.8 m from its centre", near(await east(0), 4.8), String(await east(0)));
        check("wall-thickness 1.5: the inner face is 3.5 m from the centre", near(await east(20), 3.5), String(await east(20)));
        check("the floor top doesn't move with wall-thickness", near(await floorTop(20), await floorTop(0)), `${await floorTop(20)} vs ${await floorTop(0)}`);
        check("a polygon room's walls thicken inward too", near(await east(40), 3.5), String(await east(40)));
        check("so do a rotunda's", near(await east(60), 3.5), String(await east(60)));
        // From ja's centre (x -5) east: through the doorway, jb's far wall's inner face is at x 8.5.
        const joined = await east(-5, 40);
        check("a structure join cuts through two 1.5 m walls", near(joined, 13.5), String(joined));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
