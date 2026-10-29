// Browser test of a custom <garden-particle> system's unset attributes
// (examples/Physics/starship.html): the plumes set no min/max-angular-speed, which used to be
// assigned as `undefined`, so every particle's angle went NaN after its first update. Now an
// unset attribute keeps Babylon's default. Run after a build: npm run test:particles.
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
        await page.goto(ORIGIN + "/examples/Physics/starship.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 60, null, { timeout: 30000 });

        const systems = await page.evaluate(() => [...document.querySelectorAll("garden-particle")]
            .filter(el => el.particleSystem)
            .map(el => {
                const ps = el.particleSystem;
                const parts = ps.particles || [];
                // Particles past their birth frame: age > 0 means at least one update has run.
                const aged = parts.filter(p => p.age > 0);
                return {
                    angular: [el.getAttribute("minangularspeed"), el.getAttribute("maxangularspeed")],
                    minAngularSpeed: ps.minAngularSpeed, maxAngularSpeed: ps.maxAngularSpeed,
                    count: parts.length, aged: aged.length,
                    nanAngles: aged.filter(p => !Number.isFinite(p.angle)).length,
                    nanPositions: aged.filter(p => ![p.position.x, p.position.y, p.position.z].every(Number.isFinite)).length,
                };
            }));
        check("starship has custom particle systems", systems.length >= 3, `${systems.length} systems`);
        const unset = systems.filter(s => s.angular[0] === null && s.angular[1] === null);
        check("some systems leave min/max-angular-speed unset (the case under test)", unset.length > 0, `${unset.length}`);
        check("unset angular speeds keep Babylon's finite defaults",
            unset.every(s => Number.isFinite(s.minAngularSpeed) && Number.isFinite(s.maxAngularSpeed)),
            JSON.stringify(unset.map(s => [s.minAngularSpeed, s.maxAngularSpeed])));
        check("every system has particles past their first update",
            systems.every(s => s.aged > 0), JSON.stringify(systems.map(s => `${s.aged}/${s.count}`)));
        check("no aged particle has a NaN angle",
            systems.every(s => s.nanAngles == 0), JSON.stringify(systems.map(s => s.nanAngles)));
        check("no aged particle has a NaN position",
            systems.every(s => s.nanPositions == 0), JSON.stringify(systems.map(s => s.nanPositions)));

        // A copy of a plume with no `capacity` attribute: the system must still be built and draw.
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        const noCap = await page.evaluate(async () => {
            const src = [...document.querySelectorAll("garden-particle")].find(el => el.particleSystem && el.hasAttribute("capacity"));
            const el = src.cloneNode(false);
            el.removeAttribute("id");
            el.removeAttribute("capacity");
            src.parentElement.appendChild(el);
            await new Promise(r => setTimeout(r, 300));
            el.play?.();
            await new Promise(r => setTimeout(r, 1500));
            const ps = el.particleSystem;
            return ps ? { capacity: ps.getCapacity(), count: ps.particles.length } : null;
        });
        check("a system with no capacity attribute is built and draws particles",
            noCap && Number.isFinite(noCap.capacity) && noCap.capacity > 0 && noCap.count > 0 && noCap.count <= noCap.capacity && errors.length == 0,
            JSON.stringify({ noCap, errors }));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
