// Browser test of <garden-webxr teleportation>: it defaults to on, and teleportation="false"
// turns it off (a plain Lit Boolean read any present value as true, so it could never be
// turned off). Reads the property and, where headless Chrome builds the XR experience, the
// teleportation feature. Removed for good, the "enter VR" button leaves (a page at localhost with a
// stand-in navigator.xr). Serves small inline pages. Run after a build:
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

        // Removed for good, the "enter VR" button leaves; added back, there's one, not two. Babylon
        // builds the button only for https or localhost, with WebXR, so this page is served as
        // http://localhost (still by routing) with a stand-in navigator.xr.
        const LOCAL = "http://localhost:59123";
        const buttons = async whatLeaves => {
            const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
            page.on("pageerror", e => errors.push(e.message));
            await page.route(LOCAL + "/**", route => {
                const p = decodeURIComponent(new globalThis.URL(route.request().url()).pathname);
                if (p == "/xr.html")
                    return route.fulfill({ status: 200, contentType: "text/html", body: `<!DOCTYPE html><html><head>
<script>Object.defineProperty(navigator, "xr", { configurable: true, value: { isSessionSupported: async () => true,
  addEventListener() {}, removeEventListener() {}, requestSession: async () => { throw new Error("stand-in"); } } });</script>
<script src="/dist/juel-garden.js"></script></head><body><garden-scene>
  <garden-camera type="arc" radius="10"></garden-camera><garden-light></garden-light>
  <garden-ground width="10" height="10"></garden-ground><garden-webxr></garden-webxr>
</garden-scene></body></html>` });
                const f = path.join(ROOT, p);
                if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                    return route.fulfill({ status: 404, body: "" });
                route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
            });
            await page.goto(LOCAL + "/xr.html", { waitUntil: "load" });
            await page.waitForFunction(() => !!document.querySelector("garden-webxr").xr, null, { timeout: 30000 });
            const got = await page.evaluate(async selector => {
                const wait = ms => new Promise(r => setTimeout(r, ms));
                const count = () => document.querySelectorAll(".xr-button-overlay").length;
                if (selector == "change") {
                    // A change rebuilds the element: the old experience goes, one button stays.
                    const el = document.querySelector("garden-webxr"), first = count(), xr = el.xr;
                    el.setAttribute("teleportation", "false");
                    await wait(2000);
                    el.setAttribute("teleportation", "true");
                    await wait(2000);
                    return { first, changed: count(), newXr: !!el.xr && el.xr !== xr, teleport: !!el.xr?.teleportation };
                }
                const el = document.querySelector(selector), parent = el.parentNode, first = count();
                el.remove();
                await wait(300);
                const removed = count();
                parent.appendChild(el);
                await wait(2000);
                return { first, removed, back: count() };
            }, whatLeaves);
            await page.close();
            return got;
        };
        const xrAlone = await buttons("garden-webxr");
        check("a <garden-webxr> removed for good takes its button; added back, one button",
            xrAlone.first == 1 && xrAlone.removed == 0 && xrAlone.back == 1, JSON.stringify(xrAlone));
        const xrScene = await buttons("garden-scene");
        check("a scene removed for good and added back has one button", xrScene.first == 1 && xrScene.back == 1, JSON.stringify(xrScene));
        const xrChange = await buttons("change");
        check("a <garden-webxr> changed twice has one button and a new experience", xrChange.first == 1 && xrChange.changed == 1 &&
            xrChange.newXr && xrChange.teleport, JSON.stringify(xrChange));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
