// Browser test of <garden-structure doorways>: by default two rooms sharing a wall get
// a doorway cut in the middle of it; with doorways="none" they get none, and a drawn
// <garden-opening> still cuts its door. Rays along x at the wall's middle and at the
// drawn door tell which; a ray down through each threshold must find a floor. Serves a small inline page. Run after a build:
// npm run test:doorways. Same harness as opening.js.
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

// Two 10 x 10 rooms side by side along x, sharing the wall at x = 0 (offset by `dz`).
const pair = (dz, a, b) => `
  <garden-room id="${a}" width="10" depth="10" height="4" position="-5 0 ${dz}"></garden-room>
  <garden-room id="${b}" width="10" depth="10" height="4" position="5 0 ${dz}"></garden-room>`;

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
        await page.route(ORIGIN + "/doorways-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 30 -40"></garden-camera>
  <garden-light></garden-light>
  <garden-structure>${pair(0, "auto-a", "auto-b")}
  </garden-structure>
  <garden-ground id="lawn" width="200" height="200" position="0 0 0"></garden-ground>
  <garden-structure>
    <garden-room id="mix-box" width="10" depth="10" height="4" position="-5 0 80"></garden-room>
    <garden-room id="mix-poly" type="polygon" points="-5 -5, 5 -5, 5 5, -5 5" height="4" position="5 0 80"></garden-room>
  </garden-structure>
  <garden-structure doorways="none">${pair(40, "none-a", "none-b")}
    <garden-opening between="#none-a #none-b" position="0 0 43" width="0.6" depth="2" height="3"></garden-opening>
  </garden-structure>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/doorways-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(2000);
        // From inside room a (x = -5), a ray east at head height: through a doorway it
        // reaches room b's far wall (inner face 9.8 m away), else the shared wall (~4.8).
        const east = (z) => page.evaluate((z) => {
            const scene = document.querySelector("garden-scene").scene;
            const V = scene.activeCamera.position.constructor;
            const Ray = scene.activeCamera.getForwardRay().constructor;
            const hit = scene.pickWithRay(new Ray(new V(-5, 1.2, z), new V(1, 0, 0), 100), m => m.isVisible && m.isPickable);
            return hit?.hit ? +hit.distance.toFixed(2) : null;
        }, z);
        const auto = await east(0), none = await east(40), drawn = await east(43);
        check("doorways auto (default): the shared wall has a doorway in its middle", auto > 9, String(auto));
        check("doorways=\"none\": no doorway in the middle", none != null && none < 5, String(none));
        check("doorways=\"none\": the drawn <garden-opening> is a door", drawn > 9, String(drawn));
        // Straight down through each doorway's threshold: a floor, never the ground under it
        // (the cut used to start at the slabs' bottoms and go right through the box's floor).
        const down = (x, z) => page.evaluate(([x, z]) => {
            const scene = document.querySelector("garden-scene").scene;
            const V = scene.activeCamera.position.constructor;
            const Ray = scene.activeCamera.getForwardRay().constructor;
            const owner = m => { while (m && !m.element) m = m.parent; return m?.element?.id; };
            const hit = scene.pickWithRay(new Ray(new V(x, 3, z), new V(0, -1, 0), 10), m => m.isVisible && m.isPickable);
            return hit?.hit ? owner(hit.pickedMesh) : null;
        }, [x, z]);
        for (const [name, x, z] of [["box | box", -0.1, 0], ["box | polygon, box side", -0.1, 80], ["box | polygon, polygon side", 0.1, 80]]) {
            const under = await down(x, z);
            check(`${name}: the threshold has a floor under it`, under != null && under != "lawn", String(under));
        }
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
