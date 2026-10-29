// Smoke test of every example page: opens each examples/**/*.html in the installed Chrome,
// waits for the scene to render 30 frames, and fails on page errors or console errors.
// Failed loads of remote assets (no network) are ignored; a missing local file is not.
// Run after a build: npm run test:examples [filter]. Same harness as rotunda.js.
// --lean serves dist/juel-garden.lean.js (npm run build:lean: the library as an app
// bundling it from npm gets it, without all of Babylon) in place of the global
// bundle, to catch a Babylon side-effect import missing from src/SideEffects.ts.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json" };
const REMOTE_NOISE = /net::ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION_REFUSED|ADDRESS_UNREACHABLE)/;

function pages(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
        d.isDirectory() ? pages(path.join(dir, d.name)) : d.name.endsWith(".html") ? [path.join(dir, d.name)] : []);
}

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

(async () => {
    const lean = process.argv.includes("--lean");
    const filter = process.argv.slice(2).find(a => !a.startsWith("--")) || "";
    const files = pages(path.join(ROOT, "examples")).map(f => path.relative(ROOT, f).split(path.sep).join("/"))
        .filter(f => f.includes(filter)).sort();
    const browser = await chromium.launch({ executablePath: CHROME, headless: true,
        args: [...require("./gpu").GPU_ARGS] });
    try {
        for (const file of files) {
            // The lean build is the library as an app bundles it: no window.BABYLON and no
            // window.JuelGarden. A page that scripts those globals can only run on the global
            // bundle, so --lean skips it (its elements are still covered by the other pages).
            if (lean && /\b(BABYLON|JuelGarden)\b/.test(fs.readFileSync(path.join(ROOT, file), "utf8").replace(/<script[^>]*\bsrc=[^>]*>/g, ""))) {
                console.log(`SKIP  ${file}  -- scripts the global bundle's BABYLON/JuelGarden`);
                continue;
            }
            const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
            const errors = [];
            page.on("pageerror", e => errors.push("pageerror: " + e.message));
            page.on("console", m => { if (m.type() == "error" && !REMOTE_NOISE.test(m.text())) errors.push(m.text()); });
            page.on("requestfailed", r => { if (r.url().startsWith(ORIGIN)) errors.push("failed: " + r.url()); });
            await page.route(ORIGIN + "/**", route => {
                let f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
                if (lean && f == path.join(ROOT, "dist", "juel-garden.js"))
                    f = path.join(ROOT, "dist", "juel-garden.lean.js");
                if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                    return route.fulfill({ status: 404, body: "" });
                route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
            });
            let rendered = true;
            try {
                await page.goto(ORIGIN + "/" + file, { waitUntil: "load", timeout: 30000 });
                await page.waitForFunction(() => {
                    const scenes = [...document.querySelectorAll("garden-scene")];
                    return scenes.length > 0 && scenes.every(s => s.scene?.getFrameId() > 30);
                }, null, { timeout: 20000 });
                await page.waitForTimeout(500);
            } catch (e) {
                rendered = false;
                errors.push("did not render 30 frames: " + e.message.split("\n")[0]);
            }
            check(file, rendered && errors.length == 0, [...new Set(errors)].slice(0, 4).join(" | "));
            await page.close();
        }
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
