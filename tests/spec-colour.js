// Browser test of the `spec-colour` attribute on a mesh (examples/Physics/starship.html,
// the cockpit sphere's spec-colour="#BFE0FF"): it lands on the material's
// specularColor. Run after a build: npm run test:spec-colour. Same harness as rotunda.js.
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
        await page.goto(ORIGIN + "/examples/Physics/starship.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });

        const mat = await page.evaluate(() => {
            const m = document.querySelector("garden-sphere[spec-colour]").mesh.material;
            return { specular: m.specularColor.toHexString(), stray: m.specColor === undefined };
        });
        // A new StandardMaterial's specular is white (#FFFFFF), so this only passes if the attribute landed.
        check("spec-colour sets the material's specularColor (#BFE0FF)", mat.specular == "#BFE0FF", JSON.stringify(mat));
        check("...and not a stray specColor property", mat.stray, JSON.stringify(mat));

        // `diffuse-colour` on its own (no `colour`): its setter used to look up `colour`, and threw.
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        const diffuse = await page.evaluate(async () => {
            const box = document.createElement("garden-box");
            box.setAttribute("diffuse-colour", "#336699");
            document.querySelector("garden-scene").appendChild(box);
            await new Promise(r => setTimeout(r, 500));
            return box.mesh?.material?.diffuseColor?.toHexString() ?? null;
        });
        check("diffuse-colour alone sets the material's diffuseColor (#336699)", diffuse == "#336699" && errors.length == 0,
            JSON.stringify({ diffuse, errors }));

        // `diffuse-texture` on its own (no `texture`): same mistake, its setter looked up `texture`.
        const tex = await page.evaluate(async () => {
            const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
            const box = document.createElement("garden-box");
            box.setAttribute("diffuse-texture", png);
            document.querySelector("garden-scene").appendChild(box);
            await new Promise(r => setTimeout(r, 500));
            return box.mesh?.material?.diffuseTexture?.url?.slice(0, 22) ?? null;
        });
        check("diffuse-texture alone sets the material's diffuseTexture", tex == "data:image/png;base64," && errors.length == 0,
            JSON.stringify({ tex, errors }));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
