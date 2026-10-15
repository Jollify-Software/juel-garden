// Browser test of rotundas: round (examples/Structures/rotunda.html) and oval
// (examples/Structures/oval-rotunda.html, type="rotunda" with an explicit
// depth). Run after a build: npm run dev && npm run test:rotunda
// Same harness as link.js.
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
const near = (a, b, tol = 0.05) => a && b.every((v, i) => Math.abs(a[i] - v) <= tol);

async function open(browser, file) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.route(ORIGIN + "/**", route => {
        const f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
            return route.fulfill({ status: 404, body: "" });
        route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    });
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(ORIGIN + "/examples/Structures/" + file, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
    await page.waitForTimeout(2000); // structure joins and openings finish
    return { page, errors };
}

const bounds = (page, id) => page.evaluate(id => {
    const bb = document.getElementById(id).mesh.getBoundingInfo().boundingBox;
    const r = v => +v.toFixed(2);
    return { min: bb.minimumWorld.asArray().map(r), max: bb.maximumWorld.asArray().map(r) };
}, id);

// First thing a ray from `from` along `dir` hits, at 1.2 m.
const cast = (page, from, dir) => page.evaluate(([from, dir]) => {
    const scene = document.querySelector("garden-scene").scene;
    const V = scene.activeCamera.position.constructor;
    const Ray = scene.activeCamera.getForwardRay().constructor;
    const hit = scene.pickWithRay(new Ray(new V(...from), new V(...dir), 100), m => m.isVisible && m.isPickable);
    return hit?.hit ? +hit.distance.toFixed(2) : null;
}, [from, dir]);

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true,
        args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"] });
    try {
        let { page, errors } = await open(browser, "rotunda.html");
        const round = await bounds(page, "drum");
        check("a rotunda without depth stays round", near(round.min, [-8, -0.4, -8]) && near(round.max, [8, 5, 8]), JSON.stringify(round));
        check("no errors (round)", errors.length == 0, errors.join(" | "));
        await page.close();

        ({ page, errors } = await open(browser, "oval-rotunda.html"));
        const oval = await bounds(page, "rotunda");
        check("depth makes it oval: 24 x 16", near(oval.min, [-12, -0.4, -8]) && near(oval.max, [12, 9, 8]), JSON.stringify(oval));
        const north = await cast(page, [0, 1.2, 0], [0, 0, 1]);
        check("the wall follows the oval (inner face 7.8 m north)", Math.abs(north - 7.8) < 0.1, String(north));
        const east = await cast(page, [0, 1.2, 0], [1, 0, 0]);
        check("the doorway is cut: a ray east goes through to the wing", east > 19, String(east));
        await page.screenshot({ path: path.join(process.argv[2] || __dirname, "oval-rotunda.png") });
        check("no errors (oval)", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
