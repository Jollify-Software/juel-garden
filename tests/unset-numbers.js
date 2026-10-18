// Browser test of number attributes left unset: each falls back to a sensible default
// instead of reaching Babylon as undefined (NaN). <garden-column> with no `height`,
// <garden-animation> with no `speed`, <garden-action type="beforeRender"> with no
// `increment`, <garden-sprite> with no `capacity`, and an animation with no `from`/`to`. Serves a small inline page.
// Run after a build: npm run test:unset-numbers. Same harness as rotunda.js.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg" };
const DOT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true,
        args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"] });
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
        await page.route(ORIGIN + "/unset-numbers-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-light></garden-light>
  <garden-column id="col" diameter="0.5"></garden-column>
  <garden-box id="anim-box" position="3 0 0">
    <garden-animation event="load" property="position.y" type="float"
        from="0" to="30" loop="true" keyframes="0 0, 15 2, 30 0"></garden-animation>
  </garden-box>
  <garden-box id="anim-box2" position="6 0 0">
    <garden-animation event="load" property="position.y" type="float" speed="30"
        loop="true" keyframes="0 0, 15 2, 30 0"></garden-animation>
  </garden-box>
  <garden-box id="act-box" position="-3 0 0"></garden-box>
  <garden-action type="beforeRender" parameter="#act-box" property="position" value="-3 (1+i) 0"></garden-action>
  <garden-sprite id="spr" url="${DOT}" count="3" positions="0 1 3"></garden-sprite>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/unset-numbers-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        const got = await page.evaluate(() => {
            const scene = document.querySelector("garden-scene").scene;
            const col = document.getElementById("col").mesh;
            const anim = document.getElementById("anim-box").mesh;
            const anim2 = document.getElementById("anim-box2").mesh;
            const act = document.getElementById("act-box").mesh;
            const mgr = scene.spriteManagers?.find(m => m.name == "spr");
            return {
                colY: col?.position.y,
                colHeight: col ? col.getBoundingInfo().boundingBox.extendSize.y * 2 : null,
                animY: anim?.position.y,
                animFps: anim?.animations?.[0]?.framePerSecond,
                anim2Y: anim2?.position.y,
                anim2Range: anim2 ? scene.getAnimatableByTarget(anim2)?.toFrame : null,
                actPos: act ? [act.position.x, act.position.y, act.position.z] : null,
                sprites: mgr ? mgr.sprites.length : null,
                capacity: mgr ? mgr._spriteRenderer?.capacity ?? mgr.capacity : null,
            };
        });
        check("column with no height stands on y=0 (centre at half its height)",
            Number.isFinite(got.colY) && Math.abs(got.colY - got.colHeight / 2) < 1e-6, JSON.stringify(got));
        check("animation with no speed has finite fps and position", Number.isFinite(got.animFps) && Number.isFinite(got.animY), JSON.stringify(got));
        check("animation with no from/to plays (finite position, moved off 0)",
            Number.isFinite(got.anim2Y) && got.anim2Y != 0, JSON.stringify(got));
        check("beforeRender action with no increment keeps a finite position",
            got.actPos && got.actPos.every(Number.isFinite), JSON.stringify(got));
        check("sprite with count and no capacity draws its sprites", got.sprites == 3, JSON.stringify(got));
        check("no page errors", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
