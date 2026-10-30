// Browser test of <garden-model-viewer>: one tag showing a model in the middle of a page that
// scrolls (examples/assets/hinged-box.glb, Tools/make-hinged-box.py). The model is seen from the
// front (also when it loads before the first frame) and framed at two aspect ratios (its
// projected bounding box inside the canvas with a margin); the background is transparent; the
// wheel scrolls the page unless Ctrl is held (then it zooms), and wheel="zoom" zooms without it;
// playOnce("Open") resolves and the lid holds; the near plane is closer than the model. Run after
// a build; with --viewer it runs on dist/juel-garden-viewer.js instead
// (`npm run test:model-viewer:viewer`), and checks that it did. auto-rotate turns, stops when
// touched, and stays still while the page prefers reduced motion. A poster covers the viewer
// while the model is held back, and is gone once it's drawn. The model's load, progress and
// error events pass through the viewer, and a two-finger pinch zooms. A new src after load swaps
// the model and frames the new one. Removed for good and added back, it draws again, set up as before.
const { run } = require("./harness");

const filler = "<p style='height: 900px'>Text above and below the viewer.</p>";

run(`<style>body { background: rgb(20, 200, 40); }</style>
${filler}
<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" style="width: 600px; height: 300px"></garden-model-viewer>
${filler}`, async ({ page, check, errors, frames, open }) => {
    await page.waitForFunction(() => document.getElementById("viewer").animationNames.length == 2);
    await frames(5);
    await page.evaluate(() => {
        const v = document.getElementById("viewer");
        // The model's bounding box corners projected to the canvas, as fractions (0..1).
        window.projected = () => {
            const camera = v.camera, scene = v.scene, holder = v.model.mesh;
            const V = camera.position.constructor;
            holder.computeWorldMatrix(true);
            const { min, max } = holder.getHierarchyBoundingVectors(true);
            const m = scene.getTransformMatrix();
            let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
            for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
                const p = V.TransformCoordinates(new V(x, y, z), m);
                const fx = (p.x + 1) / 2, fy = (1 - p.y) / 2;
                x0 = Math.min(x0, fx); x1 = Math.max(x1, fx); y0 = Math.min(y0, fy); y1 = Math.max(y1, fy);
            }
            return { x0: +x0.toFixed(3), x1: +x1.toFixed(3), y0: +y0.toFixed(3), y1: +y1.toFixed(3) };
        };
        window.inside = b => b.x0 > 0.02 && b.y0 > 0.02 && b.x1 < 0.98 && b.y1 < 0.98;
        // The canvas's corner pixel, read straight after a frame is drawn.
        window.cornerAlpha = () => new Promise(resolve => {
            const scene = v.scene, gl = scene.getEngine()._gl;
            scene.onAfterRenderObservable.addOnce(() => {
                const px = new Uint8Array(4);
                gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                resolve(px[3]);
            });
        });
        const lid = v.scene.getTransformNodeByName("Lid");
        window.lidAngle = () => +(2 * Math.acos(Math.min(1, Math.abs(lid.rotationQuaternion.w))) * 180 / Math.PI).toFixed(1);
    });

    const bundle = await page.evaluate(() => ({ babylon: typeof BABYLON, viewer: typeof JuelGarden?.GardenModelViewer }));
    check(`running on ${process.argv.includes("--viewer") ? "the viewer bundle (no window.BABYLON)" : "the full bundle (window.BABYLON)"}`,
        bundle.viewer == "function" && (bundle.babylon == "undefined") == process.argv.includes("--viewer"), JSON.stringify(bundle));
    check("the viewer has the model's animations", (await page.evaluate(() => document.getElementById("viewer").animationNames.join())) == "Close,Open");
    // Seen from the front: the box's front faces +z, and the lid's hinge is on its back edge.
    const frontView = () => page.evaluate(() => {
        const c = document.getElementById("viewer").camera, lid = c.getScene().getTransformNodeByName("Lid");
        lid.computeWorldMatrix(true);
        return { alpha: +c.alpha.toFixed(4), camera: +(c.position.z - c.target.z).toFixed(3), hinge: +(lid.getAbsolutePosition().z - c.target.z).toFixed(3) };
    });
    const isFront = f => Math.abs(f.alpha - Math.PI / 2) < 1e-3 && f.camera > 0 && f.hinge < 0;
    const front = await frontView();
    check("seen from the front by default (alpha pi/2, the camera across from the hinge)", isFront(front), JSON.stringify(front));
    const wide = await page.evaluate(() => projected());
    check("wide (2:1): the model's bounding box is inside the canvas with a margin", await page.evaluate(b => inside(b), wide), JSON.stringify(wide));
    check("canvas is the viewer's size", (await page.evaluate(() => {
        const c = document.querySelector("#viewer canvas");
        return c.clientWidth + "x" + c.clientHeight;
    })) == "600x300");

    // A tall viewer: framed again on resize (nobody has touched it yet).
    await page.evaluate(() => Object.assign(document.getElementById("viewer").style, { width: "240px", height: "420px" }));
    await frames(10);
    const tall = await page.evaluate(() => projected());
    check("tall (4:7): framed again, the bounding box is inside with a margin", await page.evaluate(b => inside(b), tall), JSON.stringify(tall));

    const background = await page.evaluate(async () => ({ a: document.getElementById("viewer").scene.clearColor.a, corner: await cornerAlpha(),
        alpha: document.getElementById("viewer").scene.getEngine()._gl.getContextAttributes().alpha }));
    check("background transparent by default: clear alpha 0, the drawn corner alpha 0", background.a == 0 && background.corner == 0 && background.alpha,
        JSON.stringify(background));

    const near = await page.evaluate(() => {
        const v = document.getElementById("viewer"), c = v.camera, holder = v.model.mesh;
        const { min, max } = holder.getHierarchyBoundingVectors(true), p = c.position;
        const clamp = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
        const d = Math.hypot(p.x - clamp(p.x, min.x, max.x), p.y - clamp(p.y, min.y, max.y), p.z - clamp(p.z, min.z, max.z));
        return { minZ: c.minZ, nearest: d };
    });
    check("near plane is closer than the model's nearest point", near.minZ < near.nearest && near.minZ > 0, JSON.stringify(near));

    // The page scrolls; the wheel over the viewer scrolls it and leaves the camera alone.
    check("the page is taller than the window", await page.evaluate(() => document.scrollingElement.scrollHeight > innerHeight));
    await page.evaluate(() => document.getElementById("viewer").scrollIntoView({ block: "center" }));
    await frames(3);
    const centre = await page.evaluate(() => {
        const r = document.getElementById("viewer").getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const state = () => page.evaluate(() => ({ scroll: scrollY, radius: document.getElementById("viewer").camera.radius }));
    await page.mouse.move(centre.x, centre.y);
    let before = await state();
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);
    await frames(3);
    let after = await state();
    check("wheel without Ctrl: the page scrolls and the radius stays", after.scroll > before.scroll && after.radius == before.radius,
        JSON.stringify({ before, after }));

    await page.evaluate(() => document.getElementById("viewer").scrollIntoView({ block: "center" }));
    await frames(3);
    before = await state();
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");
    await page.waitForTimeout(300);
    await frames(10);
    after = await state();
    check("wheel with Ctrl: zooms (radius changes), the page stays", after.radius != before.radius && after.scroll == before.scroll,
        JSON.stringify({ before, after }));

    // A zoom counts as a touch: resizing the viewer afterwards keeps the zoomed radius.
    const kept = await page.evaluate(async () => {
        const v = document.getElementById("viewer"), r = v.camera.radius;
        v.style.width = "260px";
        await new Promise(res => setTimeout(res, 300));
        return { before: r, after: v.camera.radius };
    });
    check("after a Ctrl-wheel zoom, a resize doesn't frame over it", kept.after == kept.before, JSON.stringify(kept));

    // Control: wheel="zoom" zooms without Ctrl.
    await page.evaluate(() => document.getElementById("viewer").setAttribute("wheel", "zoom"));
    await frames(3);
    before = await state();
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);
    await frames(10);
    after = await state();
    check("control: wheel=\"zoom\" zooms without Ctrl, the page stays", after.radius != before.radius && after.scroll == before.scroll,
        JSON.stringify({ before, after }));

    const opened = await page.evaluate(async () => {
        const v = document.getElementById("viewer");
        const ok = await v.playOnce("Open");
        await new Promise(r => setTimeout(r, 800));
        return { ok, angle: lidAngle() };
    });
    check("playOnce(\"Open\") resolves true and the lid holds open", opened.ok === true && opened.angle > 100, JSON.stringify(opened));
    const close = await page.evaluate(async () => {
        const ok = await document.getElementById("viewer").playOnce("Close");
        await new Promise(r => setTimeout(r, 500));
        return { ok, angle: lidAngle() };
    });
    check("playOnce(\"Close\") resolves and holds closed", close.ok === true && close.angle < 0.5, JSON.stringify(close));
    // A second page: a poster until the first frame, a coloured background, auto-rotate that
    // stops when touched. The model is held back until the poster has been seen.
    let release;
    const held = new Promise(r => release = r);
    await page.route(url => url.search == "?held", async route => { await held; await route.fallback(); });
    await open(`<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb?held" poster="/examples/assets/dunes.png"
        background="#336699" auto-rotate="90" style="width: 400px; height: 300px"></garden-model-viewer>`);
    await page.waitForFunction(() => document.querySelector(".garden-model-viewer-poster")?.complete ?? true);
    const loading = await page.evaluate(() => {
        const v = document.getElementById("viewer"), img = v.querySelector(".garden-model-viewer-poster");
        const a = v.getBoundingClientRect(), b = img?.getBoundingClientRect();
        return { loaded: v.animationNames.length, poster: !!img, drawn: img?.naturalWidth > 0 && getComputedStyle(img).visibility != "hidden",
            covers: !!b && b.width >= a.width - 1 && b.height >= a.height - 1 };
    });
    check("poster shown, covering the viewer, while the model loads", loading.loaded == 0 && loading.poster && loading.drawn && loading.covers,
        JSON.stringify(loading));
    release();
    await page.waitForFunction(() => document.getElementById("viewer").animationNames.length == 2);
    await frames(5);
    const second = await page.evaluate(async () => {
        const v = document.getElementById("viewer"), c = v.scene.clearColor;
        const a0 = v.camera.alpha;
        await new Promise(r => setTimeout(r, 500));
        return { poster: !!v.querySelector(".garden-model-viewer-poster"), clear: [c.r, c.g, c.b, c.a].map(x => +x.toFixed(2)).join(),
            turned: v.camera.alpha - a0 };
    });
    check("poster gone once the model is drawn", !second.poster, JSON.stringify(second));
    check("background=\"#336699\" clears to that colour, opaque", second.clear == "0.2,0.4,0.6,1", second.clear);
    check("auto-rotate=\"90\" turns the camera", second.turned > 0.3, String(second.turned));
    const box = await page.evaluate(() => { const r = document.getElementById("viewer").getBoundingClientRect(); return { x: r.x + 200, y: r.y + 150 }; });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.up();
    const stopped = await page.evaluate(async () => {
        const v = document.getElementById("viewer"), a0 = v.camera.alpha;
        await new Promise(r => setTimeout(r, 500));
        return v.camera.alpha - a0;
    });
    check("auto-rotate stops once touched", Math.abs(stopped) < 1e-6, String(stopped));
    // A third page that prefers reduced motion: auto-rotate stays still, and turns once the
    // preference is lifted.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(`<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" auto-rotate="90"
        style="width: 400px; height: 300px"></garden-model-viewer>`);
    await page.waitForFunction(() => document.getElementById("viewer").animationNames.length == 2);
    await frames(5);
    const turnedFor = () => page.evaluate(async () => {
        const v = document.getElementById("viewer"), a0 = v.camera.alpha;
        await new Promise(r => setTimeout(r, 500));
        return v.camera.alpha - a0;
    });
    const still = await turnedFor();
    check("auto-rotate doesn't turn when the page prefers reduced motion", Math.abs(still) < 1e-6, String(still));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const lifted = await turnedFor();
    check("…and turns once reduced motion is no longer preferred", lifted > 0.3, String(lifted));
    check("aria-label defaults to the model's file name", await page.evaluate(() =>
        document.getElementById("viewer").getAttribute("aria-label")) == "hinged-box.glb");
    // A fourth page: the keyboard. Tab focuses the viewer (with a focus ring), arrows turn, +/- zoom.
    await open(`<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" label="A box with a lid"
        style="width: 400px; height: 300px"></garden-model-viewer>`);
    await page.waitForFunction(() => document.getElementById("viewer").animationNames.length == 2);
    await frames(5);
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
        const v = document.getElementById("viewer"), s = getComputedStyle(v);
        return { focused: document.activeElement == v, outline: s.outlineStyle, label: v.getAttribute("aria-label"),
            role: v.getAttribute("role"), alpha: v.camera.alpha, beta: v.camera.beta, radius: v.camera.radius };
    });
    check("Tab focuses the viewer, with a focus ring", focus.focused && focus.outline != "none", JSON.stringify(focus));
    check("label sets aria-label (role img)", focus.label == "A box with a lid" && focus.role == "img", JSON.stringify(focus));
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("+");
    const keyed = await page.evaluate(() => { const c = document.getElementById("viewer").camera; return { alpha: c.alpha, beta: c.beta, radius: c.radius }; });
    check("ArrowLeft turns 10°", Math.abs(keyed.alpha - focus.alpha - Math.PI / 18) < 1e-6, JSON.stringify(keyed));
    check("ArrowDown tilts 10°", Math.abs(keyed.beta - focus.beta - Math.PI / 18) < 1e-6, JSON.stringify(keyed));
    check("+ zooms in", keyed.radius < focus.radius * 0.95, JSON.stringify(keyed));
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    const out = await page.evaluate(() => document.getElementById("viewer").camera.radius);
    check("- zooms out", out > keyed.radius * 1.15, String(out));
    check("no page take-over styles", await page.evaluate(() => !document.getElementById("garden-garden-page-styles")
        && getComputedStyle(document.documentElement).overflow != "hidden"));
    // alpha, beta and radius set after the model has loaded apply to the camera, as on <garden-camera>.
    const live = await page.evaluate(async () => {
        const v = document.getElementById("viewer");
        v.setAttribute("alpha", "1");
        v.setAttribute("beta", "0.8");
        v.setAttribute("radius", "2");
        await v.updateComplete;
        const c = v.camera;
        return { alpha: c.alpha, beta: c.beta, radius: c.radius, lower: c.lowerRadiusLimit, upper: c.upperRadiusLimit };
    });
    check("alpha, beta and radius changed after load apply to the camera",
        Math.abs(live.alpha - 1) < 1e-6 && Math.abs(live.beta - 0.8) < 1e-6 && Math.abs(live.radius - 2) < 1e-6
        && live.lower <= 2 && live.upper >= 2, JSON.stringify(live));

    // A fifth page: the model's events pass through the viewer (they bubble out of the
    // <garden-mesh-model> it builds inside), for a model that loads and one that doesn't. The
    // listener is on the document, added before the viewers: a script after a viewer can run
    // after its model has loaded (seen here, with the files served at once).
    await open(`<script>
    window.heard = [];
    for (const type of ["garden-model-progress", "garden-model-load", "garden-model-error"])
        document.addEventListener(type, e => heard.push({ id: e.composedPath().find(n => n.localName == "garden-model-viewer")?.id,
            type, from: e.target.localName, groups: e.detail?.animationGroups?.length, error: !!e.detail?.error }));
</script>
<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" style="width: 300px; height: 200px"></garden-model-viewer>
<garden-model-viewer id="missing" src="/examples/assets/no-such-model.glb" style="width: 300px; height: 200px"></garden-model-viewer>`);
    await page.waitForFunction(() => heard.some(h => h.id == "viewer" && h.type == "garden-model-load")
        && heard.some(h => h.id == "missing" && h.type == "garden-model-error"));
    const heard = await page.evaluate(() => heard);
    const of = (id, type) => heard.filter(h => h.id == id && h.type == type);
    check("events: garden-model-load reaches the viewer, with the model's animation groups",
        of("viewer", "garden-model-load").length == 1 && of("viewer", "garden-model-load")[0].groups == 2
        && of("viewer", "garden-model-load")[0].from == "garden-mesh-model", JSON.stringify(of("viewer", "garden-model-load")));
    check("events: garden-model-progress reaches the viewer", of("viewer", "garden-model-progress").length > 0,
        JSON.stringify(of("viewer", "garden-model-progress").length));
    check("events: a model that can't load fires garden-model-error at the viewer (and no load)",
        of("missing", "garden-model-error").length == 1 && of("missing", "garden-model-error")[0].error
        && of("missing", "garden-model-load").length == 0 && of("viewer", "garden-model-error").length == 0, JSON.stringify(heard));
    // A viewer at the top of a page loads its model before a frame has moved the camera to
    // its start view: it's still seen from the front.
    await frames(5);
    const topFront = await frontView();
    check("a viewer at the top of the page is seen from the front too", isFront(topFront), JSON.stringify(topFront));
    // The missing model's own console error is expected; anything else still fails the run.
    for (let i = errors.length - 1; i >= 0; i--)
        if (errors[i].includes("no-such-model.glb")) errors.splice(i, 1);

    // A sixth page: a two-finger pinch outwards zooms in. Playwright's emulated touch screen
    // reports navigator.maxTouchPoints 1, so Babylon would follow only one finger
    // (webDeviceInputSystem.js): the page reports 5, as a phone does.
    await open(`<script>Object.defineProperty(Navigator.prototype, "maxTouchPoints", { get: () => 5 });</script>
<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" style="width: 400px; height: 300px"></garden-model-viewer>`);
    await page.waitForFunction(() => document.getElementById("viewer").animationNames.length == 2);
    await frames(5);
    const mid = await page.evaluate(() => {
        const r = document.querySelector("#viewer canvas").getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, radius: document.getElementById("viewer").camera.radius };
    });
    const cdp = await page.context().newCDPSession(page);
    const fingers = d => [{ x: mid.x - d, y: mid.y, id: 1 }, { x: mid.x + d, y: mid.y, id: 2 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(20) });
    for (let d = 25; d <= 120; d += 5) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingers(d) });
        await frames(1);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await frames(30);
    const pinched = await page.evaluate(() => { const c = document.getElementById("viewer").camera; return { radius: c.radius, lower: c.lowerRadiusLimit }; });
    check("a two-finger pinch outwards zooms in, no closer than the zoom limit",
        pinched.radius < mid.radius * 0.95 && pinched.radius >= pinched.lower - 1e-9, JSON.stringify({ before: mid.radius, ...pinched }));

    // A seventh page: a new src after the model has loaded swaps the model (and its
    // animations) and frames the new one, which is far bigger (the CC0 fox).
    await open(`<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" style="width: 600px; height: 300px"></garden-model-viewer>`);
    await page.waitForFunction(() => document.getElementById("viewer").animationNames.length == 2);
    await frames(5);
    const viewed = () => page.evaluate(() => {
        const v = document.getElementById("viewer"), c = v.camera, holder = v.model.mesh;
        holder.computeWorldMatrix(true);
        const { min, max } = holder.getHierarchyBoundingVectors(true);
        const m = v.scene.getTransformMatrix(), V = c.position.constructor;
        let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
        for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
            const p = V.TransformCoordinates(new V(x, y, z), m);
            x0 = Math.min(x0, (p.x + 1) / 2); x1 = Math.max(x1, (p.x + 1) / 2);
            y0 = Math.min(y0, (1 - p.y) / 2); y1 = Math.max(y1, (1 - p.y) / 2);
        }
        return { names: v.animationNames.join(), lid: !!v.scene.getTransformNodeByName("Lid"), radius: +c.radius.toFixed(3),
            minZ: +c.minZ.toFixed(4), inside: x0 > 0.02 && y0 > 0.02 && x1 < 0.98 && y1 < 0.98 };
    });
    const small = await viewed();
    // `loaded`: true for the first model; a new src makes a new Promise, true once the new one has
    // loaded (the fox's animations there by then); a missing file's resolves false.
    const promises = await page.evaluate(async () => {
        const v = document.getElementById("viewer"), first = v.loaded;
        const firstOk = await first;
        v.setAttribute("src", "/examples/assets/characters/Fox.glb");
        await v.updateComplete;
        const second = v.loaded;
        const secondOk = await second;
        return { firstOk, renewed: second !== first, secondOk, foxNames: v.animationNames.length };
    });
    check("loaded resolves true; a new src makes a new Promise that resolves once the new model has loaded",
        promises.firstOk === true && promises.renewed && promises.secondOk === true && promises.foxNames > 0, JSON.stringify(promises));
    await page.waitForFunction(() => { const n = document.getElementById("viewer").animationNames; return n.length > 0 && !n.includes("Open"); });
    await frames(10);
    const big = await viewed();
    check("a new src swaps the model: its animations, and the old model's nodes gone",
        big.names.length > 0 && !big.names.includes("Open") && !big.lid, JSON.stringify(big));
    check("a new src frames the new model (further away, near plane further out, inside the canvas)",
        big.radius > small.radius * 10 && big.minZ > small.minZ && big.inside, JSON.stringify({ small, big }));
    const missing = await page.evaluate(async () => {
        const v = document.getElementById("viewer");
        v.setAttribute("src", "/examples/assets/no-such-model.glb");
        await v.updateComplete;
        return await Promise.race([v.loaded, new Promise(r => setTimeout(() => r("still waiting after 10 s"), 10000))]);
    });
    check("loaded resolves false for a model that fails to load", missing === false, JSON.stringify(missing));
    for (let i = errors.length - 1; i >= 0; i--)
        if (errors[i].includes("no-such-model.glb")) errors.splice(i, 1);

    // An eighth page: a viewer removed for good and added back draws again, set up as before
    // (transparent, its canvas out of the tab order, zoom steps, turning on its own).
    await open(`<garden-model-viewer id="viewer" src="/examples/assets/hinged-box.glb" auto-rotate="90"
        style="width: 400px; height: 300px"></garden-model-viewer>`);
    await page.waitForFunction(() => document.getElementById("viewer").animationNames.length == 2);
    await frames(5);
    const readded = await page.evaluate(async () => {
        const v = document.getElementById("viewer"), old = v.scene.getEngine(), parent = v.parentElement;
        v.remove();
        await new Promise(r => setTimeout(r, 100));
        const disposed = old.isDisposed;
        parent.appendChild(v);
        for (let i = 0; i < 100 && !(v.scene && !v.scene.isDisposed && v.animationNames.length == 2); i++)
            await new Promise(r => setTimeout(r, 50));
        await new Promise(r => setTimeout(r, 300));
        const s = v.scene, c = v.camera, f0 = s.getFrameId(), a0 = c.alpha;
        await new Promise(r => setTimeout(r, 300));
        return { disposed, newEngine: s.getEngine() !== old, drawn: s.getFrameId() - f0, names: v.animationNames.join(),
            clearAlpha: s.clearColor.a, tabindex: v.querySelector("canvas")?.getAttribute("tabindex"),
            wheelStep: c.wheelDeltaPercentage, turned: +(c.alpha - a0).toFixed(3) };
    });
    check("a viewer added back after removal for good draws its model again",
        readded.disposed && readded.newEngine && readded.drawn > 0 && readded.names == "Close,Open", JSON.stringify(readded));
    check("and is set up as before: transparent, canvas out of the tab order, zoom steps, auto-rotate",
        readded.clearAlpha == 0 && readded.tabindex == "-1" && readded.wheelStep == 0.01 && readded.turned > 0, JSON.stringify(readded));
});
