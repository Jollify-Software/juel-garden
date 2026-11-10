// Browser test of <garden-model-viewer>'s view for another screen: `garden-view-change` fires when a
// person turns or zooms the model (a drag, the wheel, a key), at most 15 times a second, and its last
// event is where the camera came to rest; never for auto-rotate, framing or a view it was given.
// `setView` eases there (the short way round), stops auto-rotate, and waits for a deferred viewer's
// model. A second viewer that follows the first's events ends where the first did: what a presenter's
// turn on the audience's screen needs. Run after a build.
const { run } = require("./harness");

const MODEL = "/examples/assets/hinged-box.glb";
run(`<garden-model-viewer id="a" src="${MODEL}" wheel="zoom" style="width: 400px; height: 300px"></garden-model-viewer>
<garden-model-viewer id="b" src="${MODEL}" style="width: 400px; height: 300px"></garden-model-viewer>
<garden-model-viewer id="spin" src="${MODEL}" auto-rotate="90" style="width: 200px; height: 150px"></garden-model-viewer>
<garden-model-viewer id="later" src="${MODEL}" deferred style="width: 200px; height: 150px"></garden-model-viewer>`,
async ({ page, check, errors }) => {
    await page.evaluate(async () => {
        window.events = { a: [], b: [], spin: [], later: [] };
        for (const id of Object.keys(window.events))
            document.getElementById(id).addEventListener("garden-view-change", e => window.events[id].push({ t: performance.now(), ...e.detail }));
        for (const id of ["a", "b", "spin"]) {
            const v = document.getElementById(id);
            await v.loaded;
            await v.scene.whenReadyAsync();
        }
    });
    const frames = n => page.evaluate(n => new Promise(r => { let i = 0; const s = document.getElementById("a").scene;
        const o = s.onAfterRenderObservable.add(() => { if (++i >= n) { s.onAfterRenderObservable.remove(o); r(); } }); }), n);
    const view = id => page.evaluate(id => document.getElementById(id).getView(), id);
    const count = id => page.evaluate(id => window.events[id].length, id);
    await frames(5);
    await page.waitForTimeout(300);

    // Control: loading, framing and auto-rotate are nobody's move.
    check("no event for loading and framing", await count("a") == 0 && await count("b") == 0);
    const spin0 = await view("spin");
    await page.waitForTimeout(600);
    const spin1 = await view("spin");
    check("auto-rotate turns the model but fires nothing", Math.abs(spin1.alpha - spin0.alpha) > 0.3 && await count("spin") == 0,
        `alpha ${spin0.alpha.toFixed(2)} → ${spin1.alpha.toFixed(2)}, ${await count("spin")} events`);

    // A drag on a, followed live by b.
    await page.evaluate(() => {
        const b = document.getElementById("b");
        document.getElementById("a").addEventListener("garden-view-change", e => b.setView(e.detail));
    });
    const box = await page.evaluate(() => { const r = document.getElementById("a").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const start = await page.evaluate(() => performance.now());
    const a0 = await view("a");
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    for (let i = 1; i <= 30; i++) {
        await page.mouse.move(box.x + i * 5, box.y + i * 2);
        await page.waitForTimeout(16);
    }
    await page.mouse.up();
    // The camera's glide after the drag, then the trailing event, then b's ease.
    await page.waitForTimeout(1500);
    const evs = await page.evaluate(() => window.events.a);
    const a = await view("a"), b = await view("b");
    check("a drag fires garden-view-change", evs.length >= 3, `${evs.length} events`);
    const span = (evs.at(-1)?.t ?? start) - evs[0]?.t;
    const gaps = evs.slice(1).map((e, i) => e.t - evs[i].t);
    check("…at most 15 a second", Math.min(...gaps) >= 1000 / 15 - 2, `${evs.length} in ${span?.toFixed(0)} ms, shortest gap ${Math.min(...gaps).toFixed(1)} ms`);
    const last = evs.at(-1);
    check("…and the last is where the camera came to rest",
        Math.abs(last.alpha - a.alpha) < 1e-4 && Math.abs(last.beta - a.beta) < 1e-4 && Math.abs(last.radius - a.radius) < 1e-4,
        JSON.stringify({ last: [last.alpha, last.beta], a: [a.alpha, a.beta] }));
    check("the model really turned", Math.abs(a.alpha - a0.alpha) > 0.2, `alpha ${a0.alpha.toFixed(2)} → ${a.alpha.toFixed(2)}`);
    check("a viewer following the events ends where the first did",
        Math.abs(b.alpha - a.alpha) < 0.01 && Math.abs(b.beta - a.beta) < 0.01 && Math.abs(b.radius - a.radius) < 0.01 * a.radius,
        JSON.stringify({ a: [a.alpha, a.beta, a.radius].map(n => +n.toFixed(3)), b: [b.alpha, b.beta, b.radius].map(n => +n.toFixed(3)) }));
    check("…and fires nothing of its own", await count("b") == 0, `${await count("b")} events`);

    // Eased, not a jump: halfway through a 0.4 s ease b is between the two.
    const mid = await page.evaluate(async () => {
        const b = document.getElementById("b"), from = b.getView();
        b.setView({ ...from, beta: from.beta + 0.6 }, { ease: 0.4 });
        await new Promise(r => setTimeout(r, 200));
        const now = b.getView();
        await new Promise(r => setTimeout(r, 400));
        return { from: from.beta, now: now.beta, end: b.getView().beta };
    });
    check("setView eases there", mid.now > mid.from + 0.05 && mid.now < mid.end - 0.05 && Math.abs(mid.end - mid.from - 0.6) < 1e-3, JSON.stringify(mid));

    // The short way round: a view two turns away doesn't spin the model.
    const round = await page.evaluate(async () => {
        const b = document.getElementById("b"), from = b.getView();
        let most = 0;
        const o = b.scene.onAfterRenderObservable.add(() => most = Math.max(most, Math.abs(b.camera.alpha - from.alpha)));
        b.setView({ ...from, alpha: from.alpha + 4 * Math.PI + 0.3 });
        await new Promise(r => setTimeout(r, 500));
        b.scene.onAfterRenderObservable.remove(o);
        return { most, moved: b.getView().alpha - from.alpha };
    });
    check("setView turns the short way round", round.most < 0.31 && Math.abs(round.moved - 0.3) < 1e-3, JSON.stringify(round));

    // setView stops auto-rotate.
    await page.evaluate(() => { const s = document.getElementById("spin"); s.setView({ ...s.getView(), beta: 1 }, { ease: 0 }); });
    await page.waitForTimeout(100);
    const s0 = await view("spin");
    await page.waitForTimeout(500);
    const s1 = await view("spin");
    check("setView stops auto-rotate", Math.abs(s1.alpha - s0.alpha) < 1e-6 && Math.abs(s1.beta - 1) < 1e-6 && await count("spin") == 0, JSON.stringify({ s0: s0.alpha, s1: s1.alpha }));

    // A view given to a deferred viewer is kept and applied once its model is framed.
    const later = await page.evaluate(async () => {
        const v = document.getElementById("later");
        v.setView({ alpha: 0.4, beta: 0.9, radius: 2 });
        const kept = v.getView();
        v.removeAttribute("deferred");
        await v.updateComplete;
        await v.loaded;
        await v.scene.whenReadyAsync();
        await new Promise(r => setTimeout(r, 300));
        return { kept, now: v.getView() };
    });
    check("a deferred viewer keeps a view it's given", later.kept?.alpha == 0.4, JSON.stringify(later.kept));
    check("…and starts there once framed", Math.abs(later.now.alpha - 0.4) < 1e-6 && Math.abs(later.now.beta - 0.9) < 1e-6 && Math.abs(later.now.radius - 2) < 1e-6,
        JSON.stringify(later.now));
    check("…firing nothing", await count("later") == 0);

    // A view past the zoom limit: kept within it, and the clamp isn't taken for a person's move.
    const far = await page.evaluate(async () => {
        const b = document.getElementById("b"), n = window.events.b.length;
        b.setView({ ...b.getView(), radius: 1000 }, { ease: 0 });
        await new Promise(r => setTimeout(r, 400));
        return { radius: b.getView().radius, limit: b.camera.upperRadiusLimit, events: window.events.b.length - n };
    });
    check("a view past the zoom limit stops at it, firing nothing", Math.abs(far.radius - far.limit) < 1e-6 && far.events == 0, JSON.stringify(far));

    // The wheel and keys are a person's moves too.
    const n0 = await count("a");
    await page.mouse.move(box.x, box.y);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(800);
    const n1 = await count("a");
    check("a wheel zoom fires an event", n1 > n0, `${n1 - n0}`);
    await page.focus("#a");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    const n2 = await count("a");
    const afterKey = await view("a"), lastKey = await page.evaluate(() => window.events.a.at(-1));
    check("an arrow key fires an event, ending where the camera is", n2 > n1 && Math.abs(lastKey.alpha - afterKey.alpha) < 1e-4, `${n2 - n1}`);
    await frames(5);
    await page.waitForTimeout(500);
    check("nothing more once it's still", await count("a") == n2, `${await count("a") - n2} more`);

    check("no page errors", errors.length == 0, errors.join(" | "));
});
