// Browser test of <garden-gizmo> placed *before* the meshes it attaches to, in the initial
// markup: its `elements` selectors must still resolve (they used to be looked up before the
// parser had reached them). Serves a small inline page. Run after a build: npm run test:gizmo.
// Same harness as rotunda.js.
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
        await page.route(ORIGIN + "/gizmo-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-gizmo id="before" elements="#late"></garden-gizmo>
  <garden-box id="late" size="1"></garden-box>
  <garden-box id="early" size="1" position="0 0 4"></garden-box>
  <garden-gizmo id="after" elements="#early"></garden-gizmo>
  <garden-gizmo id="missing" elements="#nothing-here"></garden-gizmo>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/gizmo-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(500);
        const got = await page.evaluate(() => {
            const names = id => document.getElementById(id).manager?.attachableMeshes?.map(m => m?.uniqueId ?? null) ?? null;
            return { before: names("before"), after: names("after"),
                     late: document.getElementById("late").mesh?.uniqueId, early: document.getElementById("early").mesh?.uniqueId };
        });
        check("a gizmo after its mesh attaches to it", JSON.stringify(got.after) == JSON.stringify([got.early]), JSON.stringify(got));
        check("a gizmo before its mesh attaches to it", JSON.stringify(got.before) == JSON.stringify([got.late]), JSON.stringify(got));
        // Changed three times, a gizmo is built again each time: the old manager must go (its
        // pointer observers and handles stayed), and the gizmo that was on stays on.
        const rebuilt = await page.evaluate(async () => {
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const scene = document.querySelector("garden-scene").scene;
            const el = document.getElementById("after");
            // A manager adds one to the scene and one to its utility layer's scene.
            const layer = () => el.manager?.utilityLayer?.utilityLayerScene ?? el.manager?._defaultUtilityLayer?.utilityLayerScene;
            const layerScene = layer();
            const observers = () => scene.onPointerObservable.observers.length + layerScene.onPointerObservable.observers.length;
            const before = observers();
            el.enablePosition();
            const base = observers();
            const first = el.manager;
            for (const t of ["2", "3", "5"]) { el.setAttribute("thickness", t); await wait(300); }
            const changed = { observers: observers(), replaced: el.manager != first,
                position: el.manager.positionGizmoEnabled, attached: el.manager.attachableMeshes?.length };
            el.remove();
            await wait(300);
            return { before, base, changed, gone: observers(), manager: !!el.manager };
        });
        check("a gizmo changed three times keeps one manager, its gizmo still on",
            rebuilt.changed.observers == rebuilt.base && rebuilt.changed.replaced
            && rebuilt.changed.position && rebuilt.changed.attached == 1, JSON.stringify(rebuilt));
        check("a gizmo removed for good takes its pointer observers with it",
            rebuilt.gone == rebuilt.before - 2 /* its two, scene and layer */ && !rebuilt.manager, JSON.stringify(rebuilt));
        check("no page errors (a selector matching nothing only warns)", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
