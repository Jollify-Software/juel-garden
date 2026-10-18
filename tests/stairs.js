// Browser test of <garden-stairs> uvs (examples/Structures/stairs.html): every
// uv is a finite number, one pair per vertex, and they vary, so a texture maps
// across the steps instead of collapsing to its average colour. Run after a
// build: npm run test:stairs. Same harness as rotunda.js.
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
        page.on("pageerror", e => errors.push("pageerror: " + e.message));
        page.on("console", m => { if (m.type() == "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
        await page.goto(ORIGIN + "/examples/Structures/stairs.html", { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 30, null, { timeout: 30000 });
        await page.waitForTimeout(1000);

        for (const id of ["straight", "curved"]) {
            const uv = await page.evaluate(id => {
                const m = document.getElementById(id).mesh;
                const uvs = Array.from(m.getVerticesData("uv") || []);
                const finite = uvs.filter(Number.isFinite);
                const us = finite.filter((_, i) => i % 2 == 0), vs = finite.filter((_, i) => i % 2 == 1);
                return {
                    count: uvs.length, vertices: m.getTotalVertices(), nonFinite: uvs.length - finite.length,
                    u: [Math.min(...us), Math.max(...us)].map(v => +v.toFixed(2)),
                    v: [Math.min(...vs), Math.max(...vs)].map(v => +v.toFixed(2))
                };
            }, id);
            check(`${id}: one uv pair per vertex`, uv.count > 0 && uv.count == uv.vertices * 2, JSON.stringify(uv));
            check(`${id}: every uv is finite`, uv.nonFinite == 0, JSON.stringify(uv));
            check(`${id}: uvs span the steps (u and v both vary)`, uv.u[1] > uv.u[0] && uv.v[1] > uv.v[0], JSON.stringify(uv));
        }
        check("no errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
