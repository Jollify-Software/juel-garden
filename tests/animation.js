// Browser test of an event="load" <garden-animation target="id"> whose target is declared
// later in the markup and builds asynchronously (a garden-room), and of a target id that
// matches nothing (warns, no page error). Serves a small inline page.
// Run after a build: npm run test:animation. Same harness as rotunda.js.
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
        await page.route(ORIGIN + "/animation-test.html", route => route.fulfill({ status: 200, contentType: "text/html", body: `
<!DOCTYPE html><html><head><script src="/dist/juel-garden.js"></script></head><body>
<garden-scene>
  <garden-camera type="arc" position="0 10 -20"></garden-camera>
  <garden-box id="driver" size="1">
    <garden-animation target="hall" event="load" property="position.y" type="float"
                      from="0" to="30" speed="30" keyframes="0 0, 30 5"></garden-animation>
    <garden-animation target="nothing-here" event="load" property="position.y" type="float"
                      from="0" to="30" speed="30" keyframes="0 0, 30 5"></garden-animation>
  </garden-box>
  <garden-room id="hall" width="6" depth="6" position="10 0 0"></garden-room>
  <garden-box id="pair" size="1" position="-10 0 0">
    <garden-animation id="pair-spin" property="rotation.y" type="float" from="0" to="60" speed="30"
                      loop="true" keyframes="0 0, 60 (2*Math.PI)"></garden-animation>
    <garden-animation id="pair-bounce" property="position.y" type="float" from="0" to="30" speed="30"
                      loop="true" keyframes="0 0, 15 2, 30 0"></garden-animation>
  </garden-box>
</garden-scene></body></html>` }));
        await page.goto(ORIGIN + "/animation-test.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(2000);
        const got = await page.evaluate(() => ({ y: document.getElementById("hall").mesh?.position?.y ?? null }));
        check("the later room was animated (y = 5)", got.y != null && Math.abs(got.y - 5) < 1e-3, JSON.stringify(got));
        // New keyframes on the <garden-animation> are used by the next play(), and the target
        // holds one animation from it, not the old one as well.
        const changed = await page.evaluate(async () => {
            const anim = document.querySelector("garden-animation"), hall = document.getElementById("hall");
            anim.setAttribute("keyframes", "0 0, 30 2");
            await new Promise(r => setTimeout(r, 300));
            anim.play(document.getElementById("driver"));
            const playing = hall.getScene().getAllAnimatablesByTarget(hall.mesh).length;
            await new Promise(r => setTimeout(r, 2000));
            return { y: hall.mesh.position.y, animations: playing, listed: hall.mesh.animations.length };
        });
        check("new keyframes play from the next play() (y = 2), one animatable on the target and one in its list",
            Math.abs(changed.y - 2) < 1e-3 && changed.animations == 1 && changed.listed == 1, JSON.stringify(changed));
        // Two <garden-animation>s on one box run side by side: playing the second doesn't
        // restart the first with its frames, stop() stops only its own, and one removed for
        // good stops (a loop would otherwise run on).
        const pair = await page.evaluate(async () => {
            const box = document.getElementById("pair"), spin = document.getElementById("pair-spin"),
                bounce = document.getElementById("pair-bounce"), wait = ms => new Promise(r => setTimeout(r, ms));
            const moving = async () => {
                const a = { r: box.mesh.rotation.y, y: box.mesh.position.y };
                await wait(250);
                return { spin: Math.abs(box.mesh.rotation.y - a.r) > 1e-3, bounce: Math.abs(box.mesh.position.y - a.y) > 1e-3 };
            };
            spin.play(box);
            await wait(200);
            bounce.play(box);
            await wait(200);
            const both = await moving();
            const spinner = box.getScene().getAllAnimatablesByTarget(box.mesh)
                .find(a => a.getAnimations().some(r => r.animation.targetProperty == "rotation.y"));
            const spinFrom = spinner?.fromFrame, spinTo = spinner?.toFrame;
            spin.stop(box);
            const stopped = await moving();
            spin.play(box);
            await wait(100);
            bounce.remove();
            await wait(100);
            const removed = await moving();
            return { both, spinRange: [spinFrom, spinTo], stopped, removed,
                animatables: box.getScene().getAllAnimatablesByTarget(box.mesh).length, listed: box.mesh.animations.length };
        });
        check("two animations on one target both run, each with its own frames",
            pair.both.spin && pair.both.bounce && pair.spinRange[0] == 0 && pair.spinRange[1] == 60, JSON.stringify(pair));
        check("stop() stops only its own animation", !pair.stopped.spin && pair.stopped.bounce, JSON.stringify(pair.stopped));
        check("a looping animation removed for good stops; the other runs on",
            pair.removed.spin && !pair.removed.bounce && pair.animatables == 1 && pair.listed == 1, JSON.stringify(pair));
        check("no page errors (a missing target only warns)", errors.length == 0, JSON.stringify(errors));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
