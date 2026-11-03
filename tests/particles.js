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

        // A custom system changed three times is rebuilt each time: the last build's system (and
        // its texture) must go, not run on beside the new one; removed for good, none is left.
        const rebuilt = await page.evaluate(async () => {
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const s = document.querySelector("garden-scene").scene;
            const count = () => ({ systems: s.particleSystems.length, textures: s.textures.length });
            const before = count();
            const el = document.createElement("garden-particle");
            el.setAttribute("capacity", "200");
            el.setAttribute("url", "/examples/assets/dunes.png");
            document.querySelector("garden-scene").appendChild(el);
            await wait(500);
            el.play();
            const built = count();
            for (const c of ["300", "400", "500"]) { el.setAttribute("capacity", c); await wait(400); }
            const changed = { ...count(), capacity: el.particleSystem?.getCapacity(), started: el.particleSystem?.isStarted() };
            el.remove();
            await wait(400);
            return { before, built, changed, gone: count() };
        });
        check("a changed custom system replaces the old one (one system, its texture, still playing)",
            rebuilt.built.systems == rebuilt.before.systems + 1 && rebuilt.changed.systems == rebuilt.built.systems
            && rebuilt.changed.textures == rebuilt.built.textures && rebuilt.changed.capacity == 500 && rebuilt.changed.started,
            JSON.stringify(rebuilt));
        check("a changed custom system removed for good leaves nothing",
            rebuilt.gone.systems == rebuilt.before.systems && rebuilt.gone.textures == rebuilt.before.textures, JSON.stringify(rebuilt));

        // Weather systems share one dot texture per scene: removing (or rebuilding) one must not
        // dispose it under the others.
        const shared = await page.evaluate(async () => {
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const scene = document.querySelector("garden-scene");
            const add = preset => { const e = document.createElement("garden-particle"); e.setAttribute("preset", preset); scene.appendChild(e); return e; };
            const rain = add("rain"), snow = add("snow");
            await wait(800);
            rain.setAttribute("event", "load"); // a property change rebuilds the rain
            await wait(800);
            rain.remove();
            await wait(400);
            const tex = snow.particleSystem?.particleTexture;
            const r = { texture: !!tex, live: !!tex?.getInternalTexture(), inScene: scene.scene.textures.includes(tex),
                count: snow.particleSystem?.particles.length };
            snow.remove();
            return r;
        });
        check("removing one weather system keeps the dot texture the others draw with",
            shared.texture && shared.live && shared.inScene && shared.count > 0, JSON.stringify(shared));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`
${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
