// Shared harness for the character/guide tests (walk, follow, near, sound, ...): the same
// set-up as rotunda.js/ground.js -- installed Chrome on the real GPU, the repo served from
// disk through Playwright routing -- with an inline test page and PASS/FAIL reporting.
//
//   const { run } = require("./harness");
//   run("<garden-scene>...</garden-scene>", async ({ page, check, errors }) => { ... });
//
// `html` is the body (or null with `url` set to a repo page); the page loads
// /dist/juel-garden.js. `open(html)` loads a second inline page in the same tab. Never return a Babylon object
// from page.evaluate() (Playwright tries to serialise it and stalls).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".png": "image/png",
    ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".wav": "audio/wav", ".json": "application/json" };

function run(html, body, { url = "/test.html", viewport = { width: 1000, height: 700 } } = {}) {
    const results = [];
    const check = (name, ok, info = "") => {
        results.push(!!ok);
        console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
    };
    (async () => {
        const browser = await chromium.launch({ executablePath: CHROME, headless: true,
            args: [...require("./gpu").GPU_ARGS, "--autoplay-policy=no-user-gesture-required"] });
        try {
            const page = await browser.newPage({ viewport, hasTouch: true });
            page.setDefaultTimeout(15000);
            await page.route(ORIGIN + "/**", route => {
                const f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
                if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                    return route.fulfill({ status: 404, body: "" });
                route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
            });
            const errors = [];
            page.on("pageerror", e => errors.push("pageerror: " + e.message));
            page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
            // Opens another inline page (or a repo file when html is null) in the same tab.
            let pages = 0;
            const open = async (html, at = `/test-${++pages}.html`) => {
                if (html != null)
                    await page.route(ORIGIN + at, route => route.fulfill({ status: 200, contentType: "text/html",
                        body: `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/dist/juel-garden.js"></script></head><body>${html}</body></html>` }));
                await page.goto(ORIGIN + at, { waitUntil: "load" });
                await page.waitForFunction(() => document.querySelector("garden-scene")?.scene?.getFrameId() > 10, null, { timeout: 30000 });
            };
            await open(html, url);
            const frames = n => page.evaluate(n => new Promise(r => {
                const s = document.querySelector("garden-scene").scene, end = s.getFrameId() + n;
                const o = s.onAfterRenderObservable.add(() => { if (s.getFrameId() >= end) { s.onAfterRenderObservable.remove(o); r(); } });
            }), n);
            await body({ page, check, errors, frames, open });
            check("no page errors", errors.length == 0, errors.join(" | "));
        } finally {
            await browser.close();
        }
        const failed = results.filter(r => !r).length;
        console.log(`\n${results.length - failed}/${results.length} passed`);
        process.exit(failed ? 1 : 0);
    })().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { run, ROOT, ORIGIN };
