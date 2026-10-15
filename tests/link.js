// Browser test of <garden-link> through examples/Navigation/shopping-centre.html
// and food-court.html. Run after a build: npm run dev && npm run test:link
//
// Same harness as physics-zero-g.js: the installed Chrome on the real GPU,
// the repo served from disk through Playwright's request routing. Clicks are
// real mouse clicks on the projected mesh, so Babylon's picking and the
// ActionManager wiring are exercised, not just GardenLink.follow().
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://juel-garden.test";
const BASE = ORIGIN + "/examples/Navigation/";
const outDir = process.argv[2] || __dirname;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm",
    ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".css": "text/css" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}
const near = (a, b, tol = 0.15) => a && b.every((v, i) => Math.abs(a[i] - v) <= tol);

// Wait until the scene has rendered a few frames, so picking works.
async function sceneReady(page) {
    await page.waitForFunction(() => {
        const s = document.querySelector("garden-scene")?.scene;
        return s && s.activeCamera && s.getFrameId() > 10;
    }, null, { timeout: 15000 });
}

// The camera's position, as a plain array.
const cameraAt = page => page.evaluate(() =>
    document.querySelector("garden-scene").scene.activeCamera.position.asArray().map(v => +v.toFixed(2)));

// Screen point of an element's mesh centre (a link inside a mesh uses that mesh),
// or of a garden-link portal found by title.
async function screenPoint(page, find) {
    return page.evaluate(find => {
        const sceneEl = document.querySelector("garden-scene");
        const scene = sceneEl.scene;
        const el = find.selector ? document.querySelector(find.selector)
            : [...document.querySelectorAll("garden-link")].find(l => l.title == find.title);
        const mesh = el.mesh || el.parentElement.mesh;
        const engine = scene.getEngine();
        const centre = mesh.getBoundingInfo().boundingSphere.centerWorld;
        const V = centre.constructor;
        const M = mesh.getWorldMatrix().constructor;
        const vp = scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        const p = V.Project(centre, M.Identity(), scene.getTransformMatrix(), vp);
        const rect = sceneEl.canvas.getBoundingClientRect();
        const scale = rect.width / engine.getRenderWidth();
        return { x: rect.left + p.x * scale, y: rect.top + p.y * scale, z: p.z };
    }, find);
}

async function clickOn(page, find) {
    const p = await screenPoint(page, find);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.mouse.up();
    return p;
}

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
        page.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) errors.push(`${r.status()}: ${r.url()}`); });

        await page.goto(BASE + "shopping-centre.html", { waitUntil: "load" });
        await sceneReady(page);
        await page.screenshot({ path: path.join(outDir, "link-1-concourse.png") });
        check("starts on the concourse", near(await cameraAt(page), [0, 1.6, -8]), JSON.stringify(await cameraAt(page)));

        // Hover the portal: its ring lights up.
        const ringColour = () => page.evaluate(() => {
            const link = [...document.querySelectorAll("garden-link")].find(l => l.title == "Food court");
            return link.parts[0].material.emissiveColor.toHexString();
        });
        const before = await ringColour();
        const portal = await screenPoint(page, { title: "Food court" });
        await page.mouse.move(portal.x, portal.y);
        await page.waitForTimeout(300);
        const after = await ringColour();
        check("portal ring highlights on hover", after == "#24CAFF", `${before} -> ${after}`);

        // 1. A link inside a mesh: click the Coffee sign.
        await clickOn(page, { selector: 'garden-plane:has(garden-link[href="#coffee"])' });
        await page.waitForTimeout(1500);
        let hash = await page.evaluate(() => location.hash);
        check("clicking the sign pushes #coffee", hash == "#coffee", hash);
        check("camera flew into the coffee shop", near(await cameraAt(page), [0, 1.6, 5.5]), JSON.stringify(await cameraAt(page)));
        await page.screenshot({ path: path.join(outDir, "link-2-coffee.png") });

        // 2. Back button flies back out; forward goes in again.
        await page.goBack();
        await page.waitForTimeout(1500);
        check("back returns to the concourse", near(await cameraAt(page), [0, 1.6, -8]), JSON.stringify(await cameraAt(page)));
        await page.goForward();
        await page.waitForTimeout(1500);
        check("forward re-enters the coffee shop", near(await cameraAt(page), [0, 1.6, 5.5]), JSON.stringify(await cameraAt(page)));

        // 3. A link inside a <garden-info>: open the counter's card, click its button.
        await clickOn(page, { selector: "#coffee-counter" });
        await page.waitForTimeout(300);
        const button = page.locator("button", { hasText: "To the food court" });
        check("info card shows the link button", await button.isVisible());
        await Promise.all([page.waitForURL("**/food-court.html"), button.click()]);
        await sceneReady(page);
        check("info-card link opens the food court", page.url().endsWith("/food-court.html"), page.url());
        await page.screenshot({ path: path.join(outDir, "link-3-food-court.png") });

        // 4. A portal deep-linking into a shop on the other page.
        await Promise.all([page.waitForURL("**/shopping-centre.html#coffee"), clickOn(page, { title: "Coffee" })]);
        await sceneReady(page);
        await page.waitForTimeout(300);
        check("deep link starts inside the coffee shop", near(await cameraAt(page), [0, 1.6, 8]), JSON.stringify(await cameraAt(page)));
        await page.screenshot({ path: path.join(outDir, "link-4-deep-link.png") });

        // 5. A garden-navigate listener can take over.
        const cancelled = await page.evaluate(() => {
            let seen = null;
            document.addEventListener("garden-navigate", e => { seen = e.detail.href; e.preventDefault(); }, { once: true });
            document.querySelector('garden-link[href="#toys"]').follow();
            return seen;
        });
        await page.waitForTimeout(300);
        const hashAfter = await page.evaluate(() => location.hash);
        check("garden-navigate is cancelable", cancelled == "#toys" && hashAfter == "#coffee", `${cancelled} ${hashAfter}`);

        // 6. A pinned <garden-info> directory: always on screen, its buttons fly to shops.
        const dir = page.locator("button", { hasText: "Toys" });
        check("pinned directory is showing", await dir.isVisible());
        const box = await dir.boundingBox();
        check("directory sits in the top-left corner", box && box.x < 300 && box.y < 300, JSON.stringify(box));
        await dir.click();
        await page.waitForTimeout(1500);
        check("directory button flies into the toy shop", near(await cameraAt(page), [7, 1.6, 5.5]), JSON.stringify(await cameraAt(page)));
        check("directory stays open after the click", await dir.isVisible());
        await page.locator("button", { hasText: "▾" }).click();
        check("folding the directory hides its buttons", !(await dir.isVisible()));
        await page.locator("button", { hasText: "▸" }).click();
        check("unfolding shows them again", await dir.isVisible());

        check("no console errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(ok => !ok).length;
    console.log(failed ? `${failed} FAILED` : "all passed");
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
