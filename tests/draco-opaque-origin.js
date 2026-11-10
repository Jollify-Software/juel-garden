// A Draco-compressed model in a sandboxed frame with no origin of its own (`self.origin` is "null"), as the
// Jollify editor's preview is. The frame loads juel-garden.js from the page's server, which, like a static host,
// sends no CORS headers, so the decoder's .wasm can't be fetched from there; juel-garden uses Draco's plain
// JavaScript decoder in such a frame instead. The model comes as a data: URL, as the editor hands files over.
// The same model on the page itself (a real origin) still decodes with the .wasm.
// A real local server, not the harness's routes: the decoder runs in a worker, and Playwright's routes don't reach
// workers. Run after a build: npm run test:draco-opaque-origin. Control: run it on a dist built before Decoders.ts
// looked at the origin: the sandboxed line must FAIL, with a CORS error on draco_decoder_gltf.wasm.
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const glb = fs.readFileSync(path.join(ROOT, "examples", "assets", "block-draco.glb")).toString("base64");
const model = `<garden-mesh-model id="m" extension="glb" src="data:model/gltf-binary;base64,${glb}"></garden-mesh-model>`;
const scene = `<garden-scene><garden-camera position="0 1 -4"></garden-camera><garden-light></garden-light>${model}</garden-scene>`;

// Reports whether #m has drawn (or gave up after 25 s), to the parent if there is one.
const reporter = `<script>
const started = Date.now();
const look = setInterval(() => {
    const m = document.getElementById("m")?.mesh;
    const drawn = !!m && [m, ...m.getChildMeshes()].some(x => x.getTotalVertices() > 0);
    if (drawn || Date.now() - started > 25000) {
        clearInterval(look);
        window.result = { origin: self.origin, drawn };
        if (parent != window) parent.postMessage({ from: "sandboxed", ...window.result }, "*");
    }
}, 200);
</script>`;

const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/dist/juel-garden.js"></script></head><body>${scene}${reporter}
<iframe id="sandboxed" sandbox="allow-scripts" style="width: 400px; height: 300px"></iframe>
<script>addEventListener("message", e => { if (e.data?.from == "sandboxed") window.framed = e.data; });</script></body></html>`;
/** The frame's page: juel-garden.js named in full from the server, as the editor's preview names the app's copy. */
const framePage = origin => `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="${origin}/dist/juel-garden.js"></script></head><body>${scene}${reporter}</body></html>`;

const results = [];
const check = (name, ok, info = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`); };

(async () => {
    // No CORS headers, as a static host may send none.
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, "http://x");
        if (url.pathname == "/test.html") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(page); }
        const f = path.join(ROOT, decodeURIComponent(url.pathname));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "Content-Type": { ".js": "text/javascript", ".wasm": "application/wasm" }[path.extname(f)] || "application/octet-stream" });
        res.end(fs.readFileSync(f));
    });
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [...require("./gpu").GPU_ARGS] });
    try {
        const tab = await browser.newPage();
        const cors = [], errors = [];
        tab.on("console", m => { if (/CORS/i.test(m.text())) cors.push(m.text().slice(0, 160)); });
        tab.on("pageerror", e => errors.push(e.message));
        await tab.goto(`http://127.0.0.1:${server.address().port}/test.html`, { waitUntil: "load" });
        await tab.evaluate(html => { document.getElementById("sandboxed").srcdoc = html; }, framePage(`http://127.0.0.1:${server.address().port}`));
        await tab.waitForFunction(() => window.result && window.framed, null, { timeout: 40000 }).catch(() => {});
        const { own, framed } = await tab.evaluate(() => ({ own: window.result, framed: window.framed }));
        check("on a page with an origin, the Draco model decodes (with the .wasm)", own?.drawn, JSON.stringify(own));
        check("the frame really has no origin", framed?.origin == "null", framed?.origin);
        check("in a sandboxed frame with no origin, the Draco model decodes (with the JavaScript decoder)", framed?.drawn, cors.join(" | "));
        check("no page errors", errors.length == 0, errors.join(" | "));
    } finally {
        await browser.close();
        server.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
