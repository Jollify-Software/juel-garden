// Browser test of <garden-canvas content="text">: a change rebuilds it with its text where
// `point` says (the build used to move `point` down each time) and one texture, not one per
// build. Serves a small inline page.
// Run after a build: npm run test:canvas. Same harness as rotunda.js.
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
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        await page.route(ORIGIN + "/**", route => {
            const f = path.join(ROOT, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
                return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        await page.route(ORIGIN + "/canvas-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" radius="6"></garden-camera><garden-light type="hemi"></garden-light>
  <garden-canvas id="sign" content="text" foreground="red" point="0 0">Hello</garden-canvas>
  <garden-box id="crate" size="1" position="0 -2 0"><garden-canvas id="label" content="text" foreground="red" point="0 0">Hi</garden-canvas></garden-box>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/canvas-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 10, null, { timeout: 30000 });
        await page.waitForTimeout(500);
        // A change rebuilds the canvas: its text stays where `point` puts it, and the old
        // texture goes with the old build.
        const got = await page.evaluate(async () => {
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const el = document.getElementById("sign"), scene = el.getScene();
            const canvases = () => scene.textures.filter(t => t.name == "canvas" && !t.isDisposed?.()).length;
            const read = () => ({ y: el.point.y, textures: canvases(), hasTexture: !!el.mesh?.material?.diffuseTexture });
            const first = read();
            el.setAttribute("foreground", "blue");
            await wait(500);
            el.setAttribute("foreground", "green");
            await wait(500);
            return { first, after: read() };
        });
        check("point stays as written after two changes", got.first.y == 0 && got.after.y == 0, JSON.stringify(got));
        check("no more canvas textures after two changes, one on the new mesh", got.after.textures == got.first.textures && got.after.hasTexture, JSON.stringify(got));
        // On a mesh, the canvas draws on the mesh's material: a rebuild replaces its texture there.
        const onMesh = await page.evaluate(async () => {
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const el = document.getElementById("label"), crate = document.getElementById("crate"), scene = el.getScene();
            const canvases = () => scene.textures.filter(t => t.name == "canvas").length;
            const first = canvases();
            el.setAttribute("foreground", "blue");
            await wait(500);
            el.setAttribute("foreground", "green");
            await wait(500);
            const tex = crate.mesh.material.diffuseTexture;
            return { first, after: canvases(), onCrate: !!tex && scene.textures.includes(tex) };
        });
        check("a canvas on a mesh changed twice: its texture replaced, not added to", onMesh.after == onMesh.first && onMesh.onCrate, JSON.stringify(onMesh));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
