// Browser test of <garden-physics> through examples/Physics/zero-g.html.
// Run after a build: npm run dev && npm run test:physics
//
// Uses the installed Chrome with the real GPU (software WebGL is too slow
// for Babylon + Havok), and serves the repo straight from disk through
// Playwright's request routing, so no web server is needed. Every wait has a
// timeout, so a broken build fails instead of hanging. Never return a Babylon
// or Havok object from page.evaluate(): Playwright tries to serialise it
// (WASM heap and all) and the run stalls.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const URL = ORIGIN + "/examples/Physics/zero-g.html";
const out = process.argv[2] || path.join(__dirname, "zero-g.png");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
    ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".css": "text/css" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}
const withTimeout = (p, ms, what) => Promise.race([
    p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);

(async () => {
    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true,
        args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"],
        timeout: 30000,
    });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        await page.route(ORIGIN + "/**", route => {
            const file = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
                return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(file),
                contentType: TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
        });
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on("console", m => { if ((m.type() == "error" || m.type() == "warning") && !m.text().startsWith("Failed to load resource")) errors.push(`${m.type()}: ${m.text()}`); });
        page.on("pageerror", e => errors.push("pageerror: " + e.message));
        page.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) errors.push(`${r.status()}: ${r.url()}`); });

        await page.goto(URL, { waitUntil: "load" });

        const gpu = await page.evaluate(() => {
            const gl = document.createElement("canvas").getContext("webgl2");
            const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
            return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "no WebGL";
        });
        check("WebGL runs on the GPU", !/swiftshader|llvmpipe|no webgl/i.test(gpu), gpu);

        await page.evaluate(() => document.querySelector("garden-physics").ready.then(() => true));
        await page.waitForFunction(() =>
            [...document.querySelectorAll("garden-sphere, garden-box")].every(b => b.physicsAggregate), null, { timeout: 10000 });
        check("Havok loaded and every shape has a body", true);

        const state = () => page.evaluate(() => ({
            cue: document.getElementById("cue").mesh.position.asArray().map(n => +n.toFixed(2)),
            red: document.querySelectorAll("garden-sphere.ball")[1].mesh.position.asArray().map(n => +n.toFixed(2)),
            live: [...document.querySelectorAll("garden-sphere.ball")].filter(b => b.physicsAggregate).length,
            atRest: document.querySelector("garden-physics").atRest,
            status: document.getElementById("status").textContent,
        }));

        // Zero gravity: nothing should drift in a second.
        const s0 = await state();
        await page.waitForTimeout(1000);
        const s1 = await state();
        check("Zero gravity: balls stay put before the shot", JSON.stringify(s0.cue) == JSON.stringify(s1.cue) && JSON.stringify(s0.red) == JSON.stringify(s1.red), JSON.stringify(s1.cue));

        await page.evaluate(() => {
            window.log = { collide: 0, rest: 0, enter: 0 };
            const s = document.querySelector("garden-scene");
            s.addEventListener("garden-collide", () => log.collide++);
            s.addEventListener("garden-rest", () => log.rest++);
            s.addEventListener("garden-trigger-enter", () => log.enter++);
            document.getElementById("cue").impulse("0 0 8");
        });
        await page.waitForTimeout(600);
        const s2 = await state();
        const log1 = await page.evaluate(() => ({ ...log }));
        check("Impulse moves the cue ball", s2.cue[2] > 0.5, JSON.stringify(s2.cue));
        check("garden-collide fires when the cue hits the reds", log1.collide > 0, `collide=${log1.collide}`);
        check("Not at rest while moving", s2.atRest === false);

        // Send a red into the +,+,+ corner pocket.
        await page.evaluate(() => {
            const red = document.querySelectorAll("garden-sphere.ball")[1];
            red.teleport("3 3 3");
            setTimeout(() => red.setVelocity("4 4 4"), 100);
        });
        await page.waitForFunction(() => window.log.enter > 0, null, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(200);
        const s3 = await state();
        const log2 = await page.evaluate(() => ({ ...log }));
        check("garden-trigger-enter fires when a ball reaches a pocket", log2.enter > 0, `enter=${log2.enter}`);
        check("Potted ball loses its body", s3.live == 5, `live balls=${s3.live}`);

        // Everything should settle (damping 0.4) well within 30 s.
        const settled = await withTimeout(page.evaluate(() => new Promise(r => {
            const p = document.querySelector("garden-physics");
            if (p.atRest) r(true); else p.addEventListener("garden-rest", () => r(true), { once: true });
        })), 30000, "garden-rest").catch(e => e.message);
        const s4 = await state();
        check("garden-rest fires once everything stops", settled === true, `${settled}; status="${s4.status}"`);
        check("Shoot button re-enabled at rest", await page.isEnabled("#shoot"));

        await page.screenshot({ path: out });
        check("No console errors or warnings", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(failed ? `${failed} FAILED` : "ALL PASSED");
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
