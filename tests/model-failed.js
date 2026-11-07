// Browser test of <garden-model-viewer> when its model can't load, with WebGL working: the page's own
// `slot="fallback"` content takes the empty scene's place, with `load-failed` on the viewer; a viewer with
// no such content keeps its scene as it did; `loaded` resolves false; and a viewer whose model loads shows
// no fallback. Run after a build (with --viewer, on dist/juel-garden-viewer.js).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { ROOT, ORIGIN } = require("./harness");

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BUNDLE = process.argv.includes("--viewer") ? "juel-garden-viewer.js" : "juel-garden.js";
const results = [];
const check = (name, ok, info = "") => {
    results.push(!!ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
};

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/dist/juel-garden.js"></script></head><body>
<garden-model-viewer id="words" src="/examples/assets/no-such-model.glb" style="width: 400px; height: 200px"><p slot="fallback">A box with a lid.</p></garden-model-viewer>
<garden-model-viewer id="bare" src="/examples/assets/no-such-model.glb" style="width: 400px; height: 200px"></garden-model-viewer>
<garden-model-viewer id="good" src="/examples/assets/hinged-box.glb" style="width: 400px; height: 200px"><p slot="fallback">Not this.</p></garden-model-viewer>
<script>
    window.loaded = {};
    for (const v of document.querySelectorAll("garden-model-viewer")) v.loaded.then(ok => loaded[v.id] = ok);
</script>
</body></html>`;

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [...require("./gpu").GPU_ARGS] });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        page.setDefaultTimeout(30000);
        const pageErrors = [];
        page.on("pageerror", e => pageErrors.push(e.message));
        await page.route(ORIGIN + "/**", route => {
            const url = new globalThis.URL(route.request().url());
            if (url.pathname == "/test.html") return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
            let f = path.join(ROOT, decodeURIComponent(url.pathname));
            if (f == path.join(ROOT, "dist", "juel-garden.js")) f = path.join(ROOT, "dist", BUNDLE);
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
            route.fulfill({ status: 200, body: fs.readFileSync(f) });
        });
        await page.goto(ORIGIN + "/test.html", { waitUntil: "load" });
        await page.waitForFunction(() => ["words", "bare", "good"].every(id => window.loaded[id] !== undefined));
        const s = await page.evaluate(() => {
            const shown = el => !!el && getComputedStyle(el).display != "none" && el.getBoundingClientRect().height > 0;
            const read = id => {
                const v = document.getElementById(id);
                return { failed: v.hasAttribute("load-failed"), scene: shown(v.querySelector("garden-scene")), words: shown(v.querySelector('[slot="fallback"]')) };
            };
            return { loaded: window.loaded, words: read("words"), bare: read("bare"), good: read("good") };
        });
        check("a model that can't load: loaded resolves false, and true for one that can", s.loaded.words === false && s.loaded.bare === false && s.loaded.good === true, JSON.stringify(s.loaded));
        check("a model that can't load: the page's words show, in the scene's place", s.words.failed && s.words.words && !s.words.scene, JSON.stringify(s.words));
        check("with no words of the page's own: the scene stays, as it did", !s.bare.failed && s.bare.scene, JSON.stringify(s.bare));
        check("a model that loads: its scene shows and the words stay hidden", !s.good.failed && s.good.scene && !s.good.words, JSON.stringify(s.good));
        check("nothing throws", pageErrors.length == 0, pageErrors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
