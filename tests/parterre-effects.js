// End to end: a plan with data-effect and data-sound -> parterre -> the page in Chrome.
// Fire, smoke and sparks: real particles, where the plan put them, drawing pixels, with nothing
// asked of another site (effect="fire" fetches from one; these presets mustn't). The sound: every
// connection to the speakers is tapped by an analyser, so "louder nearer" is a measured volume.
// Needs the sibling C:\Jollify\parterre checkout and dotnet:
//   node tests/parterre-effects.js
//   CONTROL=flat: the sound is made ambient on the page, so the "louder nearer" line must fail.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const PARTERRE = path.resolve(ROOT, "..", "parterre");
const OUT = path.join(os.tmpdir(), "juel-garden-parterre-effects");
const ORIGIN = "http://parterre.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".wav": "audio/wav" };
const CONTROL = process.env.CONTROL;

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

/** Two seconds of a steady 440 Hz tone, as a 16-bit mono WAV. */
function tone() {
    const rate = 22050, n = rate * 2, b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 12000), 44 + i * 2);
    return b;
}

// In metres at --scale 0.1. A level above, so the height the effect stands at is the stacked one.
const PLAN = `<svg xmlns="http://www.w3.org/2000/svg">
<rect data-fixture="ground" data-id="g" x="-100" y="-100" width="1000" height="500"/>
<rect data-fixture="room" data-id="fire" x="0" y="0" width="100" height="100" data-effect="fire"/>
<rect data-fixture="room" data-id="smoke" x="200" y="0" width="100" height="100" data-effect="smoke" data-effect-height="1"/>
<rect data-fixture="room" data-id="sparks" x="400" y="0" width="100" height="100" data-effect="sparks"/>
<rect data-fixture="room" data-id="sound" x="600" y="0" width="100" height="100" data-sound="sounds/tone.wav" data-sound-distance="1"/>
<rect data-fixture="room" data-id="lit" x="800" y="0" width="100" height="100"/>
<circle data-fixture="light" data-id="lamp" cx="850" cy="50" r="2" data-colour="#ff2000" data-range="8"/>
<circle data-fixture="light" data-id="wall-lamp" cx="899" cy="50" r="1" data-level="0" data-range="0.1"/>
</svg>`;

(async () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(path.join(OUT, "sounds"), { recursive: true });
    fs.writeFileSync(path.join(OUT, "sounds", "tone.wav"), tone());
    const planFile = path.join(OUT, "plan.svg");
    fs.writeFileSync(planFile, PLAN);
    execFileSync("dotnet", ["run", "--project", path.join(PARTERRE, "Parterre.Cli"), "--",
        "--in", planFile, "--out", path.join(OUT, "scene.html"), "--scale", "0.1", "--height", "3",
        "--no-directory", "--garden", path.join(ROOT, "dist", "juel-garden.js")], { stdio: "inherit" });
    const html = fs.readFileSync(path.join(OUT, "scene.html"), "utf8");
    if (CONTROL == "flat")
        fs.writeFileSync(path.join(OUT, "scene.html"), html.replace("<garden-sound ", "<garden-sound ambient "));

    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [...require("./gpu").GPU_ARGS] });
    try {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        const outside = [], missing = [];
        await page.route("**/*", route => {
            const url = route.request().url();
            if (!url.startsWith(ORIGIN + "/")) {
                if (!url.startsWith("data:") && !url.startsWith("blob:")) outside.push(url);
                return route.abort();
            }
            const f = path.join(OUT, decodeURIComponent(new globalThis.URL(url).pathname));
            if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
                missing.push(url);
                return route.fulfill({ status: 404, body: "" });
            }
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push("pageerror: " + e.message));
        page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
        // Whatever reaches the speakers reaches this analyser too.
        await page.addInitScript(() => {
            const connect = AudioNode.prototype.connect;
            AudioNode.prototype.connect = function (target, ...rest) {
                if (target instanceof AudioDestinationNode) {
                    const context = target.context;
                    const tap = context.__tap ??= Object.assign(context.createAnalyser(), { fftSize: 2048 });
                    window.__audio = context;
                    connect.call(this, tap);
                }
                return connect.call(this, target, ...rest);
            };
        });
        await page.goto(ORIGIN + "/scene.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 45000 });
        await page.waitForTimeout(2500); // structure joins and CSG cuts finish

        const roomAt = id => page.evaluate(id => document.getElementById(id).getAttribute("position").split(" ").map(Number), id);
        // The system under a room's element, by what the plan set on it.
        const about = name => page.evaluate(name => {
            const el = document.querySelector(`garden-particle[preset="${name}"]`);
            const ps = el?.particleSystem;
            if (!ps) return null;
            const ps2 = ps.particles;
            const mean = key => ps2.reduce((sum, p) => sum + p.position[key], 0) / Math.max(1, ps2.length);
            return {
                parent: el.parentElement.getAttribute("position").split(" ").map(Number),
                started: ps.isStarted(), count: ps2.length,
                x: mean("x"), y: mean("y"), z: mean("z"),
                minX: Math.min(...ps2.map(p => p.position.x)), maxX: Math.max(...ps2.map(p => p.position.x)),
            };
        }, name);

        for (const [name, room] of [["fire", "fire"], ["smoke", "smoke"], ["sparks", "sparks"]]) {
            const [rx, , rz] = await roomAt(room);
            const a = await about(name);
            check(`${name}: a system is running`, !!a?.started && a.count > 0, JSON.stringify(a && { started: a.started, count: a.count }));
            check(`${name}: it stands at its room's centre`, !!a && Math.abs(a.parent[0] - rx) < 0.01 && Math.abs(a.parent[2] - rz) < 0.01, a && `${a.parent} and room ${rx},${rz}`);
            check(`${name}: its particles are round there, not at the scene's middle`, !!a && Math.abs(a.x - rx) < 3 && Math.abs(a.z - rz) < 3, a && `mean ${a.x.toFixed(2)},${a.z.toFixed(2)}`);
            check(`${name}: they rise`, !!a && a.y > a.parent[1], a && `mean y ${a.y.toFixed(2)} above ${a.parent[1]}`);
        }
        const smoke = await about("smoke");
        check("data-effect-height lifts it", smoke?.parent[1] == 1, smoke && `y ${smoke.parent[1]}`);

        // Stand in the room, look at the flame, and count the pixels the fire adds: stopped and cleared, then running.
        const [fx, fy, fz] = await roomAt("fire");
        const reddish = async () => page.evaluate(async () => {
            const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
            scene.render();
            const c = engine.getRenderingCanvas();
            const data = await engine.readPixels(0, 0, c.width, c.height);
            let n = 0;
            for (let i = 0; i < data.length; i += 4)
                if (data[i] > 150 && data[i] > 1.4 * data[i + 2]) n++;
            return n;
        });
        await page.evaluate(([fx, fy, fz]) => {
            const scene = document.querySelector("garden-scene").scene, camera = scene.activeCamera;
            const V = camera.position.constructor;
            camera.applyGravity = false; camera.checkCollisions = false;
            camera.position = new V(fx, fy + 1, fz - 3);
            camera.setTarget(new V(fx, fy + 0.5, fz));
        }, [fx, fy, fz]);
        await page.waitForTimeout(600);
        const burning = await reddish();
        await page.screenshot({ path: path.join(OUT, "fire.png") });
        await page.evaluate(() => {
            const ps = document.querySelector('garden-particle[preset="fire"]').particleSystem;
            ps.stop(); ps.reset();
        });
        await page.waitForTimeout(300);
        const out = await reddish();
        check("fire: it draws", burning > out + 200, `${burning} reddish pixels burning, ${out} out`);
        await page.evaluate(() => document.querySelector('garden-particle[preset="fire"]').particleSystem.start());

        // ---- A light: stand in its room and read the floor with it on and off. ----
        const [lx, ly, lz] = await roomAt("lit");
        const floorWith = async on => {
            await page.evaluate(([on, lx, ly, lz]) => {
                const camera = document.querySelector("garden-scene").scene.activeCamera;
                const V = camera.position.constructor;
                document.getElementById("lamp").light.setEnabled(on);
                camera.position = new V(lx, ly + 1.6, lz - 1);
                camera.setTarget(new V(lx, ly, lz));
            }, [on, lx, ly, lz]);
            // Let the running loop draw it: a light switched on or off rebuilds the floor's shader over a few frames.
            await page.waitForTimeout(1000);
            return page.evaluate(async () => {
                const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
                scene.render();
                const c = engine.getRenderingCanvas();
                return Array.from(await engine.readPixels(c.width >> 1, c.height >> 1, 1, 1)).slice(0, 3);
            });
        };
        const lampOff = await floorWith(false), lampOn = await floorWith(true);
        check("light: it reddens the floor under it", lampOn[0] > lampOff[0] + 20 && lampOn[0] - lampOn[2] > lampOff[0] - lampOff[2] + 20, `rgb ${lampOff} off, ${lampOn} on`);
        const lamp = await page.evaluate(() => { const l = document.getElementById("lamp").light; return { kind: l.getClassName(), range: l.range, y: l.position.y }; });
        check("light: a point light, its range and height as the plan says", lamp.kind == "PointLight" && lamp.range == 8 && Math.abs(lamp.y - 2.2) < 0.01, JSON.stringify(lamp));
        const wallLamp = await page.evaluate(() => document.getElementById("wall-lamp").getAttribute("position").split(" ").map(Number)[0]);
        check("light: one on a wall hangs 0.5 m off it", Math.abs((lx + 5) - wallLamp - 0.5) < 0.01, `x ${wallLamp}, the wall at ${lx + 5}`);

        // ---- The sound. ----
        const sound = () => page.evaluate(() => {
            const el = document.querySelector("garden-sound");
            return { loaded: !!el?.sound, playing: !!el?.playing, state: window.__audio?.state ?? null };
        });
        await page.waitForFunction(() => document.querySelector("garden-sound")?.sound, null, { timeout: 15000 }).catch(() => {});
        console.log(`      before a click: ${JSON.stringify(await sound())}`);
        await page.mouse.click(400, 300);
        await page.waitForFunction(() => document.querySelector("garden-sound")?.playing && window.__audio?.state == "running", null, { timeout: 8000 }).catch(() => {});
        const s = await sound();
        check("sound: a click starts it", s.loaded && s.playing && s.state == "running", JSON.stringify(s));
        check("sound: it loops", await page.evaluate(() => document.querySelector("garden-sound").sound.loop === true));

        const [sx, sy, sz] = await roomAt("sound");
        const volumeAt = async distance => {
            await page.evaluate(([x, y, z]) => {
                const camera = document.querySelector("garden-scene").scene.activeCamera;
                camera.position = new camera.position.constructor(x, y, z);
            }, [sx, sy + 1.5, sz - distance]);
            await page.waitForTimeout(900);
            return page.evaluate(() => {
                const tap = window.__audio?.__tap;
                if (!tap) return 0;
                const buffer = new Float32Array(tap.fftSize);
                tap.getFloatTimeDomainData(buffer);
                return Math.sqrt(buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length);
            });
        };
        const near = await volumeAt(0.5);
        const far = await volumeAt(25);
        const back = await volumeAt(0.5);
        check("sound: it can be heard close to", near > 0.01, `rms ${near.toFixed(4)}`);
        check("sound: louder nearer (over 3 times)", near > 3 * far, `rms ${near.toFixed(4)} near, ${far.toFixed(4)} at 25 m`);
        check("sound: and again on coming back", back > 3 * far, `rms ${back.toFixed(4)}`);

        check("nothing was missing", missing.length == 0, missing.join(", "));
        check("nothing was asked of another site", outside.length == 0, outside.join(", "));
        check("no page errors", errors.length == 0, errors.slice(0, 3).join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(failed ? `${failed} FAIL` : "all ok");
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
