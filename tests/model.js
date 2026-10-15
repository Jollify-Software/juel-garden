// Browser test of <garden-mesh-model> loading glTF, through
// examples/Dynamic/model-gltf.html. Run after a build: npm run dev && npm run test:model
// Same harness as link.js. The fixture (examples/assets/block.gltf) is made by
// tests/fixtures/make-block-gltf.js: a 2 x 4 x 2 box, 1 unit above its origin.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const URL = ORIGIN + "/examples/Dynamic/model-gltf.html";
const outDir = process.argv[2] || __dirname;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
    ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}
const near = (a, b, tol = 0.02) => a && b.every((v, i) => Math.abs(a[i] - v) <= tol);

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
        page.on("console", m => { if ((m.type() == "error" || m.type() == "warning") && !/Failed to load resource|WebXR/.test(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
        page.on("pageerror", e => errors.push("pageerror: " + e.message));

        await page.goto(URL, { waitUntil: "load" });
        await page.waitForFunction(() => [...document.querySelectorAll("garden-mesh-model")].every(m => m.mesh), null);
        await page.waitForTimeout(500);

        const bounds = id => page.evaluate(id => {
            const mesh = document.getElementById(id).mesh;
            mesh.computeWorldMatrix(true);
            mesh.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
            const { min, max } = mesh.getHierarchyBoundingVectors(true);
            const r = v => +v.toFixed(3);
            return { min: min.asArray().map(r), max: max.asArray().map(r) };
        }, id);

        // As-is: the file's own size and origin, moved to x = -3.
        const asIs = await bounds("as-is");
        check("glTF loads at its own size", near(asIs.min, [-4, 1, -1]) && near(asIs.max, [-2, 5, 1]), JSON.stringify(asIs));

        // height="2.4": 4 tall -> 2.4 tall (k = 0.6), base on y = 0, centred on x/z.
        const exhibit = await bounds("exhibit");
        check("height scales and grounds the model", near(exhibit.min, [-0.6, 0, -0.6]) && near(exhibit.max, [0.6, 2.4, 0.6]), JSON.stringify(exhibit));

        // rotation works on a glTF (its root carries a quaternion we must not fight).
        const turned = await page.evaluate(() => document.getElementById("turned").mesh.rotation.asArray().map(v => +v.toFixed(3)));
        check("rotation (degrees) applies", near(turned, [0, 0.785, 0.297]), JSON.stringify(turned));
        const turnedB = await bounds("turned");
        const h = turnedB.max[1] - turnedB.min[1];
        check("fit scales the largest side to 1.5 (then tilted 17°)", Math.abs(h - (1.5 * Math.cos(17 * Math.PI / 180) + 0.75 * Math.sin(17 * Math.PI / 180))) < 0.02, JSON.stringify(turnedB));

        await page.screenshot({ path: path.join(outDir, "model-gltf.png") });
        check("no console errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
