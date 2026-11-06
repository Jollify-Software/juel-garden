// Browser test of <garden-model-viewer deferred>: no scene and no WebGL context until the attribute is
// taken away; adding it back keeps the last frame as a still, disposes the scene and lets the context
// go at once. A poster beats a still. Twenty viewers in turn, more than a browser allows contexts,
// never make it drop one; the viewer left on show still draws. Without the attribute nothing changes
// (tests/model-viewer.js). Run after a build.
const { run } = require("./harness");

const MODEL = "/examples/assets/hinged-box.glb";
const many = Array.from({ length: 20 }, (_, i) =>
    `<garden-model-viewer class="many" id="m${i}" src="${MODEL}" deferred style="width: 80px; height: 60px"></garden-model-viewer>`).join("");

run(`<garden-model-viewer id="always" src="${MODEL}" style="width: 200px; height: 100px"></garden-model-viewer>
<garden-model-viewer id="d" src="${MODEL}" label="A box" deferred style="width: 400px; height: 300px"></garden-model-viewer>
<garden-model-viewer id="p" src="${MODEL}" poster="/examples/assets/dunes.png" deferred style="width: 400px; height: 300px"></garden-model-viewer>
${many}`, async ({ page, check, errors }) => {
    const warnings = [];
    page.on("console", m => { if (/too many active webgl|context lost/i.test(m.text())) warnings.push(m.text()); });

    const state = id => page.evaluate(id => {
        const v = document.getElementById(id);
        const poster = v.querySelector(".garden-model-viewer-poster");
        return {
            scene: !!v.querySelector("garden-scene"), canvas: !!v.querySelector("canvas"),
            still: v.still ? v.still.slice(0, 15) : null, poster: poster?.getAttribute("src")?.slice(0, 30) ?? null,
            label: v.getAttribute("aria-label"), names: v.animationNames.length,
        };
    }, id);
    const start = id => page.evaluate(async id => {
        const v = document.getElementById(id);
        v.removeAttribute("deferred");
        await v.updateComplete;
        const loaded = await v.loaded;
        await v.scene.whenReadyAsync();
        // Two drawn frames, so `framed` is set and there's a picture to keep.
        await new Promise(r => { let n = 0; const o = v.scene.onAfterRenderObservable.add(() => { if (++n >= 2) { v.scene.onAfterRenderObservable.remove(o); r(); } }); });
        return loaded;
    }, id);
    const stop = id => page.evaluate(async id => {
        const v = document.getElementById(id);
        window.lastCanvas = v.querySelector("canvas");
        v.setAttribute("deferred", "");
        await v.updateComplete;
        await Promise.resolve();
        await new Promise(r => setTimeout(r));
        return window.lastCanvas.getContext("webgl2")?.isContextLost() ?? window.lastCanvas.getContext("webgl")?.isContextLost();
    }, id);

    let s = await state("d");
    check("deferred: no scene, no canvas", !s.scene && !s.canvas, JSON.stringify(s));
    check("deferred: the label is there all the same", s.label == "A box", s.label);
    check("deferred: no poster, and no still yet", !s.poster && !s.still);
    const settled = await page.evaluate(() => Promise.race([document.getElementById("d").loaded.then(() => "settled"), new Promise(r => setTimeout(() => r("waiting"), 300))]));
    check("deferred: `loaded` waits", settled == "waiting", settled);
    s = await state("p");
    check("deferred with a poster: shows the poster", s.poster?.includes("dunes.png"), s.poster);

    check("attribute taken away: the model loads", await start("d") === true);
    s = await state("d");
    check("…with a scene, and its animations", s.scene && s.canvas && s.names == 2, JSON.stringify(s));

    check("deferred again: the context is let go at once", await stop("d") === true);
    s = await state("d");
    check("…no scene, no canvas", !s.scene && !s.canvas, JSON.stringify(s));
    check("…a still is kept", s.still?.startsWith("data:image/"), s.still);
    check("…and shown", s.poster?.startsWith("data:image/"), s.poster);
    const painted = await page.evaluate(async () => {
        // The still isn't an empty picture: some pixel in it isn't transparent.
        const img = new Image();
        img.src = document.getElementById("d").still;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 == 3 && v > 0);
    });
    check("…with the model in it", painted);

    // Stopped the moment its model has loaded, before its shaders are ready: no empty picture kept.
    const early = await page.evaluate(async () => {
        const v = document.getElementById("m1");
        v.removeAttribute("deferred");
        await v.updateComplete;
        await v.loaded;
        const ready = v.scene.isReady();
        v.setAttribute("deferred", "");
        await v.updateComplete;
        await new Promise(r => setTimeout(r));
        return { ready, still: !!v.still };
    });
    check("stopped before its shaders are ready: keeps no empty still", early.ready || !early.still, JSON.stringify(early));

    check("started again: it loads again", await start("d") === true);
    s = await state("d");
    check("…with its animations", s.names == 2, JSON.stringify(s));
    await page.waitForFunction(() => !document.querySelector("#d .garden-model-viewer-poster"));
    check("…and the still comes off once it has drawn", true);

    check("a viewer with a poster starts", await start("p") === true);
    await stop("p");
    s = await state("p");
    check("…and on stopping shows its poster, not its frame", s.poster?.includes("dunes.png"), s.poster);

    const started = await page.evaluate(async () => {
        // A play or a stop after stopping is harmless: no scene to ask.
        const v = document.getElementById("p");
        return { play: v.play("Open"), once: await v.playOnce("Open"), names: v.animationNames.length };
    });
    check("deferred: asking it to play does nothing, and doesn't throw", !started.play && !started.once && started.names == 0, JSON.stringify(started));

    // Twenty in turn: well past the browser's limit, if the contexts weren't let go.
    let good = 0, lost = 0;
    for (let i = 0; i < 20; i++) {
        if (await start(`m${i}`)) good++;
        if (await stop(`m${i}`)) lost++;
    }
    check("twenty viewers in turn all load", good == 20, `${good}`);
    check("…each lets its context go", lost == 20, `${lost}`);
    check("…and the browser never dropped a context", warnings.length == 0, warnings[0]);
    const alive = await page.evaluate(() => {
        const c = document.querySelector("#always canvas");
        return !(c.getContext("webgl2") ?? c.getContext("webgl")).isContextLost();
    });
    check("…the viewer with no attribute is untouched", alive);

    // Removed from the page while it's still deferred, and added back: no scene appears.
    const moved = await page.evaluate(async () => {
        const v = document.getElementById("m0"), parent = v.parentNode, next = v.nextSibling;
        v.remove();
        await new Promise(r => setTimeout(r));
        parent.insertBefore(v, next);
        await new Promise(r => setTimeout(r));
        return !!v.querySelector("garden-scene");
    });
    check("moved while deferred: stays without a scene", !moved);

    check("no page errors", errors.length == 0, errors.join("; "));
});
