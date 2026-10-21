// Browser test of <garden-mesh-model extension>: a model from a blob: URL (no file name to pick
// Babylon's loader by) loads when `extension` names its type, with no failed requests. Control:
// the same blob without `extension` doesn't load (garden-model-error), so the check can fail.
// Run after a build: node tests/model-extension.js. Same harness as model.js.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const URL = ORIGIN + "/examples/Dynamic/model-gltf.html";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
    ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

(async () => {
    const browser = await chromium.launch({
        executablePath: CHROME, headless: true, timeout: 30000,
        args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"],
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
        await page.route(/babylonjs\.com/, route => route.abort());
        page.setDefaultTimeout(20000);
        const failed = [];
        page.on("requestfailed", r => failed.push(r.url()));
        await page.goto(URL, { waitUntil: "load" });
        await page.waitForFunction(() => [...document.querySelectorAll("garden-mesh-model:not([load-distance])")].every(m => m.mesh), null);

        /** Adds a model from a blob: URL of Fox.glb, with `extension` if given: "load" or "error". */
        const add = (id, extension) => page.evaluate(async ([id, extension]) => {
            const blob = await (await fetch("../assets/characters/Fox.glb")).blob();
            const model = document.createElement("garden-mesh-model");
            model.id = id;
            if (extension) model.setAttribute("extension", extension);
            model.setAttribute("height", "1");
            model.setAttribute("position", "0 0 4");
            model.setAttribute("src", URL.createObjectURL(blob));
            const done = new Promise(resolve => {
                model.addEventListener("garden-model-load", () => resolve("load"));
                model.addEventListener("garden-model-error", () => resolve("error"));
                setTimeout(() => resolve("timeout"), 15000);
            });
            document.querySelector("garden-scene").appendChild(model);
            return done;
        }, [id, extension]);

        const before = failed.length;
        check("a blob: model with extension=\"glb\" loads", await add("with-ext", "glb") === "load");
        check("...with no failed requests", failed.length === before, failed.slice(before).join(", "));
        check("\".GLB\" (dot, any case) works too", await add("dotted", ".GLB") === "load");
        check("control: the same blob without extension doesn't load", await add("without", null) !== "load");
    } finally {
        await browser.close();
    }
    const ok = results.every(Boolean);
    console.log(ok ? `all ${results.length} passed` : `${results.filter(r => !r).length} FAILED`);
    process.exit(ok ? 0 : 1);
})();
