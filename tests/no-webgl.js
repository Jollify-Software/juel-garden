// Browser test of <garden-model-viewer> where WebGL can't start (Chrome launched with WebGL and
// WebGL 2 switched off): the viewer shows its `poster`, or the page's own `slot="fallback"`
// content (with both, the poster above the content, neither covering the other), or a short
// message, instead of a blank box; `loaded` resolves false; it fires `garden-model-error` (from
// the viewer, after the page's later scripts have run); and nothing throws. Then, as a control, the
// same page in Chrome with WebGL: the fallback content stays hidden, no error fires and the scene
// is built. Run after a build (with --viewer, on dist/juel-garden-viewer.js).
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
<garden-model-viewer id="poster" src="/examples/assets/hinged-box.glb" poster="/examples/assets/dunes.png"></garden-model-viewer>
<garden-model-viewer id="fallback" src="/examples/assets/hinged-box.glb"><p slot="fallback">A box with a lid.</p></garden-model-viewer>
<garden-model-viewer id="bare" src="/examples/assets/hinged-box.glb"></garden-model-viewer>
<garden-model-viewer id="both" src="/examples/assets/hinged-box.glb" poster="/examples/assets/dunes.png" style="width: 400px; height: 300px">
    <p slot="fallback">A box with a lid. <a href="/examples/assets/hinged-box.glb">Download</a></p>
</garden-model-viewer>
<script>
    // Added after the viewers, as a page's own script would be.
    window.errors = [];
    document.addEventListener("garden-model-error", e => errors.push(e.target.id + ": " + e.detail?.error?.message));
    window.loaded = {};
    for (const v of document.querySelectorAll("garden-model-viewer"))
        v.loaded.then(ok => loaded[v.id] = ok);
</script>
</body></html>`;

async function open(args) {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args });
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.setDefaultTimeout(15000);
    const pageErrors = [];
    page.on("pageerror", e => pageErrors.push(e.message));
    await page.route(ORIGIN + "/**", route => {
        const url = new globalThis.URL(route.request().url());
        if (url.pathname == "/test.html")
            return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
        let f = path.join(ROOT, decodeURIComponent(url.pathname));
        if (f == path.join(ROOT, "dist", "juel-garden.js")) f = path.join(ROOT, "dist", BUNDLE);
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
            return route.fulfill({ status: 404, body: "" });
        route.fulfill({ status: 200, body: fs.readFileSync(f) });
    });
    await page.goto(ORIGIN + "/test.html", { waitUntil: "load" });
    return { browser, page, pageErrors };
}

const IDS = ["poster", "fallback", "bare", "both"];

const state = page => page.evaluate(ids => {
    const shown = el => !!el && el.isConnected && getComputedStyle(el).display != "none" && el.getBoundingClientRect().height > 0;
    const out = { errors: window.errors.slice(), loaded: { ...window.loaded } };
    for (const id of ids) {
        const v = document.getElementById(id);
        const img = v.querySelector("img.garden-model-viewer-poster");
        out[id] = {
            scene: !!v.querySelector("garden-scene"),
            poster: shown(img) && img.complete && img.naturalWidth > 0,
            fallback: shown(v.querySelector('[slot="fallback"]')),
            message: shown(v.querySelector(".garden-model-viewer-message")) ? v.querySelector(".garden-model-viewer-message").textContent.trim() : "",
            height: Math.round(v.getBoundingClientRect().height),
            role: v.getAttribute("role"),
        };
    }
    // With both: the poster's box ends where the fallback's begins, inside the viewer, and the
    // link is what a click at its centre reaches.
    const both = document.getElementById("both"), img = both.querySelector("img.garden-model-viewer-poster");
    const p = both.querySelector('[slot="fallback"]'), a = p.querySelector("a");
    const r = el => el.getBoundingClientRect(), v = r(both);
    if (img && img.isConnected) {
        both.scrollIntoView({ block: "center" }); // elementFromPoint sees only the viewport
        const v = r(both), ar = r(a);
        out.stack = {
            posterBottom: Math.round(r(img).bottom), fallbackTop: Math.round(r(p).top), fallbackBottom: Math.round(r(p).bottom),
            viewerBottom: Math.round(v.bottom), posterHeight: Math.round(r(img).height),
            linkOnTop: document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2) == a,
        };
    }
    return out;
}, IDS);

(async () => {
    // WebGL off.
    let { browser, page, pageErrors } = await open(["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"]);
    try {
        check("WebGL really is off in this browser", await page.evaluate(() => {
            const c = document.createElement("canvas");
            return !c.getContext("webgl2") && !c.getContext("webgl");
        }));
        await page.waitForFunction(() => window.errors.length >= 4, null, { timeout: 5000 }).catch(() => {});
        await page.waitForFunction(() => document.querySelector("#poster img")?.complete, null, { timeout: 5000 }).catch(() => {});
        const s = await state(page);
        check("no WebGL: no scene is built", IDS.every(id => !s[id].scene), JSON.stringify(s));
        check("no WebGL: the poster shows", s.poster.poster && !s.poster.message, JSON.stringify(s.poster));
        check("no WebGL: the page's fallback content shows (no message beside it)", s.fallback.fallback && !s.fallback.message, JSON.stringify(s.fallback));
        check("no WebGL: a bare viewer shows a message, not a blank box", /WebGL/.test(s.bare.message) && s.bare.height > 0, JSON.stringify(s.bare));
        check("no WebGL: with a poster and fallback content, both show, the poster above, neither covering the other",
            s.both.poster && s.both.fallback && !s.both.message && s.stack && s.stack.posterHeight > 50 &&
            s.stack.posterBottom <= s.stack.fallbackTop + 1 && s.stack.fallbackBottom <= s.stack.viewerBottom + 1 && s.stack.linkOnTop,
            JSON.stringify({ both: s.both, stack: s.stack }));
        check("no WebGL: a viewer with fallback content drops role=\"img\" (its link reachable); one without keeps it",
            s.both.role == null && s.fallback.role == null && s.poster.role == "img" && s.bare.role == "img",
            JSON.stringify(IDS.map(id => id + ":" + s[id].role)));
        check("no WebGL: loaded resolves false for each viewer, heard by a later script",
            IDS.every(id => s.loaded[id] === false), JSON.stringify(s.loaded));
        check("no WebGL: garden-model-error fires from each viewer, heard by a later script",
            IDS.every(id => s.errors.some(e => e.startsWith(id + ": ") && /WebGL/.test(e))), JSON.stringify(s.errors));
        check("no WebGL: one error per viewer", s.errors.length == IDS.length, JSON.stringify(s.errors));
        check("no WebGL: nothing throws", pageErrors.length == 0, pageErrors.join(" | "));
    } finally {
        await browser.close();
    }

    // Control: WebGL on.
    ({ browser, page, pageErrors } = await open([...require("./gpu").GPU_ARGS]));
    try {
        await page.waitForFunction(ids => ids.every(id => document.getElementById(id).animationNames.length == 2), IDS, { timeout: 30000 });
        await page.waitForFunction(ids => ids.every(id => window.loaded[id] !== undefined), IDS, { timeout: 5000 }).catch(() => {});
        const s = await state(page);
        check("WebGL: every viewer builds its scene", IDS.every(id => s[id].scene), JSON.stringify(s));
        check("WebGL: loaded resolves true for each viewer", IDS.every(id => s.loaded[id] === true), JSON.stringify(s.loaded));
        check("WebGL: the fallback content stays hidden and there's no message", !s.fallback.fallback && !s.both.fallback && !s.bare.message, JSON.stringify(s.fallback));
        check("WebGL: no garden-model-error", s.errors.length == 0, JSON.stringify(s.errors));
        check("WebGL: nothing throws", pageErrors.length == 0, pageErrors.join(" | "));
    } finally {
        await browser.close();
    }
    const failed = results.filter(r => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
