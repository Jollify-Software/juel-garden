// End to end: a plan with data-floor-*, data-walls-*, a side's, data-roof-* and
// data-roof-inside-* -> parterre -> the page in Chrome. Each surface has its own
// single-colour picture, and the test stands the camera in front of it and reads the
// pixel, so a material in the wrong slot, or one juel-garden never picks up, shows as
// the wrong colour. Needs the sibling C:\Jollify\parterre checkout and dotnet:
//   node tests/parterre-materials.js
// Same harness as parterre-polygon.js.
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const PARTERRE = path.resolve(ROOT, "..", "parterre");
const OUT = path.join(os.tmpdir(), "juel-garden-parterre-materials");
const ORIGIN = "http://parterre.test";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".png": "image/png" };

const results = [];
function check(name, ok, info = "") {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

/** A 4x4 PNG of one colour. */
function png(r, g, b) {
    const crcTable = Array.from({ length: 256 }, (_, n) => {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        return c >>> 0;
    });
    const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => {
        const t = Buffer.concat([Buffer.from(type), data]);
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(t));
        return Buffer.concat([len, t, sum]);
    };
    const size = 4;
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
    const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([r, g, b]).flat())]);
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(size).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
}

const PICTURES = { red: [220, 30, 30], green: [30, 200, 30], blue: [30, 30, 220], cyan: [30, 200, 200], magenta: [210, 30, 210], yellow: [220, 210, 30] };

// In metres at --scale 0.1. "a" and "b" share a wall, so the structure cuts a doorway through it.
const PLAN = `<svg xmlns="http://www.w3.org/2000/svg">
<rect data-fixture="ground" data-id="g" x="-100" y="-100" width="700" height="500" data-floor-texture="textures/cyan.png" data-floor-repeat="4"/>
<rect data-fixture="room" data-id="a" x="0" y="0" width="100" height="100" data-roof="flat" fill="#ffffff"
      data-roof-texture="textures/magenta.png"
      data-floor-texture="textures/green.png" data-floor-repeat="4"
      data-walls-texture="textures/red.png" data-walls-repeat="6 2"
      data-north-colour="#2040d0"/>
<rect data-fixture="room" data-id="b" x="100" y="0" width="100" height="100"/>
<circle data-fixture="room" data-id="d" cx="350" cy="50" r="50" data-roof="dome"
        data-roof-texture="textures/yellow.png" data-roof-inside-texture="textures/blue.png"
        data-walls-texture="textures/green.png" data-floor-colour="#d02020"/>
<rect data-fixture="wall" data-id="w" x="0" y="200" width="100" height="4" data-walls-texture="textures/magenta.png" data-walls-repeat="3"/>
<path data-fixture="wall" data-id="p" d="M 150,200 L 250,200" data-walls-colour="#20c020"/>
<rect data-fixture="unit" data-id="u" data-label="Shop" x="300" y="180" width="100" height="100" data-front="south"
      data-floor-colour="#2040d0" data-walls-texture="textures/red.png"/>
</svg>`;

(async () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(path.join(OUT, "textures"), { recursive: true });
    for (const [name, [r, g, b]] of Object.entries(PICTURES))
        fs.writeFileSync(path.join(OUT, "textures", name + ".png"), png(r, g, b));
    const planFile = path.join(OUT, "plan.svg");
    fs.writeFileSync(planFile, PLAN);
    execFileSync("dotnet", ["run", "--project", path.join(PARTERRE, "Parterre.Cli"), "--",
        "--in", planFile, "--out", path.join(OUT, "scene.html"), "--scale", "0.1", "--height", "3",
        "--no-directory", "--garden", path.join(ROOT, "dist", "juel-garden.js")], { stdio: "inherit" });

    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [...require("./gpu").GPU_ARGS] });
    try {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        const requested = [], missing = [], outside = [];
        await page.route("**/*", route => {
            const url = route.request().url();
            if (!url.startsWith(ORIGIN + "/")) {
                if (!url.startsWith("data:") && !url.startsWith("blob:")) outside.push(url);
                return route.abort();
            }
            const f = path.join(OUT, decodeURIComponent(new globalThis.URL(url).pathname));
            requested.push(url.slice(ORIGIN.length));
            if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
                missing.push(url);
                return route.fulfill({ status: 404, body: "" });
            }
            route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        });
        const errors = [];
        page.on("pageerror", e => errors.push("pageerror: " + e.message));
        page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
        await page.goto(ORIGIN + "/scene.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 45000 });
        await page.waitForTimeout(2500); // structure joins and CSG cuts finish
        await page.waitForFunction(() => document.querySelector("garden-scene").scene.textures.every(t => t.isReady()), null, { timeout: 15000 });

        // Stand the camera at `from`, look at `to`, draw one frame, read the middle pixel.
        const look = async (from, to) => page.evaluate(async ([from, to]) => {
            const scene = document.querySelector("garden-scene").scene;
            const camera = scene.activeCamera, engine = scene.getEngine();
            engine.stopRenderLoop();
            const V = camera.position.constructor;
            camera.position = new V(...from);
            camera.setTarget(new V(...to));
            scene.render();
            const canvas = engine.getRenderingCanvas();
            const data = await engine.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1);
            return Array.from(data).slice(0, 3);
        }, [from, to]);

        const at = id => page.evaluate(id => document.getElementById(id).getAttribute("position").split(" ").map(Number), id);
        const [ax, ay, az] = await at("a");
        const [dx, dy, dz] = await at("d");
        const [ux, uy, uz] = await at("u");
        const wall = (await page.evaluate(() => document.getElementById("w").getAttribute("position"))).split(" ").map(Number);
        const pointsOfP = await page.evaluate(() => document.getElementById("p").getAttribute("points"));
        const p0 = pointsOfP.split(",")[0].trim().split(" ").map(Number);
        const p1 = pointsOfP.split(",")[1].trim().split(" ").map(Number);

        const says = {
            red: c => c[0] > 2 * c[1] && c[0] > 2 * c[2] && c[0] > 40,
            green: c => c[1] > 2 * c[0] && c[1] > 2 * c[2] && c[1] > 40,
            blue: c => c[2] > 2 * c[0] && c[2] > 2 * c[1] && c[2] > 40,
            cyan: c => c[1] > 2 * c[0] && c[2] > 2 * c[0] && c[1] > 40,
            magenta: c => c[0] > 2 * c[1] && c[2] > 2 * c[1] && c[0] > 40,
            yellow: c => c[0] > 2 * c[2] && c[1] > 2 * c[2] && c[0] > 40,
        };
        const expectColour = async (name, colour, from, to) => {
            const c = await look(from, to);
            check(name, says[colour](c), `${colour}? rgb ${c.join(",")}`);
        };

        const eye = ay + 1.6;
        await expectColour("room a's floor wears its texture (green)", "green", [ax + 2, eye, az + 2], [ax + 2, ay, az + 2]);
        await expectColour("room a's south wall wears data-walls (red)", "red", [ax - 3, eye, az], [ax - 3, eye, az - 5]);
        await expectColour("room a's west wall wears data-walls (red)", "red", [ax, eye, az + 3], [ax - 5, eye, az + 3]);
        await expectColour("room a's north wall wears its own colour, not the brick (blue)", "blue", [ax - 3, eye, az], [ax - 3, eye, az + 5]);
        await expectColour("room a's east wall keeps data-walls after the doorway was cut (red)", "red", [ax, eye, az + 3], [ax + 5, eye, az + 3]);
        // Parterre's <garden-light> is the default hemi, whose ground colour is black, so what faces straight
        // down would get no light; its ceiling light is there for that alone. Turned off is the control: the
        // ceiling goes black. Walls and floors mustn't change at all, or every old scene has been relit.
        // A light switched on or off recompiles every material, and Babylon skips a mesh until it's ready.
        const ceilingLight = on => page.evaluate(async on => {
            const scene = document.querySelector("garden-scene").scene;
            document.getElementById("parterre-ceiling-light").light.setEnabled(on);
            for (let i = 0; i < 200; i++) {
                scene.render();
                if (scene.meshes.every(m => !m.isEnabled() || !m.isVisible || !m.subMeshes?.length || m.isReady(true))) break;
                await new Promise(done => setTimeout(done, 25));
            }
        }, on);
        const views = { ceiling: [[ax + 2, eye, az + 2], [ax + 2, ay + 3, az + 2]], wall: [[ax - 3, eye, az], [ax - 3, eye, az - 5]], floor: [[ax + 2, eye, az + 2], [ax + 2, ay, az + 2]] };
        const lit = {}, unlit = {};
        for (const [name, [from, to]] of Object.entries(views)) lit[name] = await look(from, to);
        await ceilingLight(false);
        for (const [name, [from, to]] of Object.entries(views)) unlit[name] = await look(from, to);
        await ceilingLight(true);
        check("a ceiling isn't black from inside", Math.max(...lit.ceiling) > 40, `rgb ${lit.ceiling.join(",")}`);
        check("...and is with the ceiling light off (the control)", Math.max(...unlit.ceiling) < 10, `rgb ${unlit.ceiling.join(",")}`);
        check("the ceiling light leaves a wall as it was", lit.wall.every((c, i) => Math.abs(c - unlit.wall[i]) <= 1), `${lit.wall} against ${unlit.wall}`);
        check("the ceiling light leaves a floor as it was", lit.floor.every((c, i) => Math.abs(c - unlit.floor[i]) <= 1), `${lit.floor} against ${unlit.floor}`);
        const lightOrder = await page.evaluate(() => { const scene = document.querySelector("garden-scene").scene, mine = document.getElementById("parterre-ceiling-light").light; return scene.lights.filter(l => !l.name.endsWith("-inside-light")).map(l => l === mine ? "ceiling" : l.getClassName()); });
        // A dome's own inside light comes later, and reaches only that dome (Roof.ts).
        check("it's the last light of the plan's, so a surface full of lamps drops it first", lightOrder.at(-1) == "ceiling", lightOrder.join(" "));
        await expectColour("room a's flat roof wears data-roof from above (magenta)", "magenta", [ax + 2, ay + 12, az + 2], [ax + 2, ay + 3, az + 2]);

        const door = await page.evaluate(([x, y, z]) => {
            const scene = document.querySelector("garden-scene").scene;
            const V = scene.activeCamera.position.constructor;
            const Ray = scene.activeCamera.getForwardRay().constructor;
            const hit = scene.pickWithRay(new Ray(new V(x, y, z), new V(1, 0, 0), 100), m => m.isVisible && m.isPickable);
            return hit?.hit ? +hit.distance.toFixed(2) : null;
        }, [ax, ay + 1.2, az]);
        check("the doorway between a and b is still cut (over 5 m to the next wall)", door > 5.5, String(door));

        await expectColour("the rotunda's floor wears data-floor-colour (red)", "red", [dx + 2, dy + 1.6, dz], [dx + 2, dy, dz]);
        await expectColour("the rotunda's wall wears data-walls, slot wall (green)", "green", [dx, dy + 1.6, dz], [dx - 5, dy + 1.6, dz]);
        await expectColour("the dome's inside wears data-roof-inside (blue)", "blue", [dx, dy + 1.6, dz], [dx, dy + 8, dz]);
        await expectColour("the dome's outside wears data-roof (yellow)", "yellow", [dx, dy + 25, dz], [dx, dy + 3, dz]);

        await expectColour("the wall box wears data-walls (magenta)", "magenta", [wall[0], wall[1], wall[2] - 5], [wall[0], wall[1], wall[2]]);
        await expectColour("the path wall wears data-walls (green)", "green",
            [(p0[0] + p1[0]) / 2, p0[1] + 1.5, p0[2] - 5], [(p0[0] + p1[0]) / 2, p0[1] + 1.5, p0[2]]);
        await expectColour("the ground wears data-floor (cyan)", "cyan", [wall[0], 10, wall[2] - 8], [wall[0], 0, wall[2] - 8]);

        await expectColour("the unit's floor wears data-floor-colour (blue)", "blue", [ux, uy + 1.6, uz], [ux, uy, uz]);
        await expectColour("the unit's back wall wears data-walls (red)", "red", [ux, uy + 1.6, uz], [ux, uy + 1.6, uz + 5]);

        const repeats = await page.evaluate(() => {
            const texture = (id, slot) => document.querySelector(`#${id} > garden-material[slot="${slot}"]`).material.diffuseTexture;
            const t = texture("a", "east"), f = texture("a", "floor");
            return { wall: [t.uScale, t.vScale], floor: [f.uScale, f.vScale],
                north: document.querySelector('#a > garden-material[slot="north"]').material.diffuseTexture ?? null,
                spec: document.querySelector('#a > garden-material[slot="floor"]').material.specularColor.r };
        });
        check("data-walls-repeat=\"6 2\" is six across, two up", repeats.wall.join() == "6,2", repeats.wall.join());
        check("data-floor-repeat=\"4\" is four both ways", repeats.floor.join() == "4,4", repeats.floor.join());
        check("the plain side has no texture", repeats.north === null);
        check("the surfaces are matte", repeats.spec === 0, String(repeats.spec));
        check("room b, with no attributes, has no material element",
            await page.evaluate(() => !document.querySelector("#b garden-material")));

        check("all six pictures were fetched", Object.keys(PICTURES).every(n => requested.includes(`/textures/${n}.png`)), requested.filter(r => r.includes("textures")).join(" "));
        check("nothing was missing", missing.length == 0, missing.join(" "));
        check("nothing was asked of another host", outside.length == 0, outside.join(" "));

        await look([ax - 3, eye, az - 3], [ax + 3, eye, az + 3]);
        await page.screenshot({ path: path.join(OUT, "inside.png") });
        check("no errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
