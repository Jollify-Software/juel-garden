// Test of the per-element library entries (`juel-garden/elements/*`, built by `npm run build:lib`):
// tiny apps under tests/fixtures/ are bundled here with esbuild the way an app's bundler does it
// (ESM, code splitting, minified; chunks only reached through dynamic import() are fetched on
// demand, so the size that counts is what the entry loads up front).
// (a) An app importing only `juel-garden/elements/model-viewer` runs: the hinged box loads, its
//     animations are there, no page errors; it comes out within 10% of dist/juel-garden-viewer.js
//     (`npm run build:viewer`).
// (b) Control: an app importing "juel-garden" comes out the full library's size, far bigger.
// (c) An app importing both runs with no errors: one copy of each element (the shared chunks).
// Run after `npm run build:lib` and `npm run build:viewer`.
const fs = require("fs");
const path = require("path");
const { build } = require("esbuild");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FIXTURES = path.join(__dirname, "fixtures");

const results = [];
const check = (name, ok, info = "") => {
    results.push(!!ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
};

/** Bundles one fixture app; returns its files by URL path and the bytes its entry loads up front. */
async function bundle(name) {
    const r = await build({ absWorkingDir: ROOT, entryPoints: { app: path.join(FIXTURES, name) }, bundle: true,
        splitting: true, format: "esm", minify: true, platform: "browser", target: "es2020", outdir: "out",
        write: false, metafile: true, logLevel: "error" });
    const outputs = r.metafile.outputs;
    const entry = Object.keys(outputs).find(k => k.endsWith("/app.js"));
    const upFront = new Set();
    const walk = k => {
        if (upFront.has(k)) return;
        upFront.add(k);
        for (const i of outputs[k].imports) if (i.kind == "import-statement") walk(i.path);
    };
    walk(entry);
    const files = new Map(r.outputFiles.map(f => ["/" + path.relative(ROOT, f.path).split(path.sep).join("/"), f.contents]));
    const bytes = [...upFront].reduce((sum, k) => sum + files.get("/" + k).length, 0);
    return { files, bytes };
}

/** Opens a page running the bundled app, with the repo behind it for the model. */
async function runApp(browser, app, html) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.route(ORIGIN + "/**", route => {
        const at = decodeURIComponent(new URL(route.request().url()).pathname);
        if (at == "/app.html")
            return route.fulfill({ status: 200, contentType: "text/html", body: `<!DOCTYPE html><html><head><meta charset="utf-8">
                <script type="module" src="/out/app.js"></script></head><body>${html}</body></html>` });
        if (app.files.has(at))
            return route.fulfill({ status: 200, contentType: "text/javascript", body: Buffer.from(app.files.get(at)) });
        const f = path.join(ROOT, at);
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
        route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: f.endsWith(".glb") ? "model/gltf-binary" : "application/octet-stream" });
    });
    await page.goto(ORIGIN + "/app.html", { waitUntil: "load" });
    return { page, errors };
}

const viewerTag = `<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" style="width: 400px; height: 300px"></garden-model-viewer>`;
const kb = n => (n / 1024).toFixed(0) + " KB";

(async () => {
    const viewerBundle = fs.statSync(path.join(ROOT, "dist", "juel-garden-viewer.js")).size;
    const viewerApp = await bundle("elements-viewer.mjs");
    const fullApp = await bundle("elements-full.mjs");
    const bothApp = await bundle("elements-both.mjs");
    check("viewer-only app is within 10% of dist/juel-garden-viewer.js", viewerApp.bytes <= viewerBundle * 1.1,
        `${kb(viewerApp.bytes)} up front vs ${kb(viewerBundle)}`);
    check("control: an app importing \"juel-garden\" is far bigger (the whole library)", fullApp.bytes > viewerApp.bytes * 1.2,
        `${kb(fullApp.bytes)} vs ${kb(viewerApp.bytes)}`);
    check("an app importing both is no bigger than the whole library (shared chunks)", bothApp.bytes <= fullApp.bytes * 1.01,
        `${kb(bothApp.bytes)} vs ${kb(fullApp.bytes)}`);

    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: require("./gpu").GPU_ARGS });
    try {
        for (const [name, app] of [["viewer-only", viewerApp], ["both", bothApp]]) {
            const { page, errors } = await runApp(browser, app, viewerTag);
            await page.waitForFunction(() => document.getElementById("viewer").animationNames?.length > 0, null, { timeout: 30000 });
            const state = await page.evaluate(() => ({
                names: document.getElementById("viewer").animationNames.join(),
                frames: document.querySelector("garden-scene").scene.getFrameId(),
                babylon: typeof BABYLON,
                tags: ["garden-model-viewer", "garden-scene", "garden-camera", "garden-light", "garden-mesh-model", "garden-box"]
                    .map(t => t + ":" + !!customElements.get(t)).join(" "),
            }));
            check(`${name} app: the box loads with its animations`, state.names == "Close,Open", JSON.stringify(state));
            if (name == "viewer-only")
                check("viewer-only app registers only the viewer's elements (no <garden-box>)", /garden-mesh-model:true/.test(state.tags) && /garden-box:false/.test(state.tags), state.tags);
            else
                check("both app registers every element", /garden-box:true/.test(state.tags), state.tags);
            check(`${name} app: no page errors`, errors.length == 0, errors.join(" | "));
            await page.close();
        }
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
