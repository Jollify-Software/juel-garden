// Browser test (IMPROVEMENTS-PLAN 3.1): removing a scene gives back what it took from the page. A
// scene with drive, walk and a follow camera is added and removed 20 times (the app's layout
// editor opening and closing), and the window's listeners return to where they started, whether
// they went through removeEventListener or an aborted `signal`. Also that no engine stays alive.
// Run after a build: npm run test:dispose-baseline.
const { run } = require("./harness");

const SCENE = `<garden-scene id="s">
  <garden-camera type="follow" target="#p" radius="6" height-offset="3"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="p" position="0 0.9 0" walk></garden-box>
  <garden-box id="car" position="4 0.5 0" drive></garden-box>
</garden-scene>`;

run('<garden-scene><garden-camera type="arc" position="0 5 -10"></garden-camera><garden-light></garden-light></garden-scene>', async ({ page, check, open }) => {
    // CONTROL=1: aborting does nothing, so the listeners stay: the two "back to where they started" checks fail.
    if (process.env.CONTROL === "1") await page.addInitScript(() => { AbortController.prototype.abort = function () {}; });
    // Before the bundle loads: counts every window listener still in place, by type.
    await page.addInitScript(() => {
        const live = new Map();
        const key = (type, fn, options) => `${type}|${typeof options == "boolean" ? options : !!options?.capture}`;
        const add = window.addEventListener, remove = window.removeEventListener;
        window.addEventListener = function (type, fn, options) {
            if (fn && !options?.signal?.aborted) {
                const k = key(type, fn, options);
                const held = live.get(k) ?? new Set();
                if (!held.has(fn)) {
                    held.add(fn);
                    live.set(k, held);
                    options?.signal?.addEventListener("abort", () => held.delete(fn), { once: true });
                }
            }
            return add.call(this, type, fn, options);
        };
        window.removeEventListener = function (type, fn, options) {
            live.get(key(type, fn, options))?.delete(fn);
            return remove.call(this, type, fn, options);
        };
        window.__listeners = () => Object.fromEntries([...live].map(([k, s]) => [k, s.size]).filter(([, n]) => n));
    });
    await open('<div id="host"></div><garden-scene id="keep"><garden-camera type="arc" position="0 5 -10"></garden-camera><garden-light></garden-light></garden-scene>');

    const cycle = html => page.evaluate(async html => {
        const host = document.getElementById("host");
        host.innerHTML = html;
        const scene = host.querySelector("garden-scene");
        const t0 = performance.now();
        while (!(scene.scene?.getFrameId() > 5) && performance.now() - t0 < 15000) await new Promise(r => setTimeout(r, 25));
        const ready = scene.scene?.getFrameId() > 5;
        const during = window.__listeners();
        const babylon = scene.scene;
        const engine = babylon?.getEngine();
        scene.remove();
        await new Promise(r => setTimeout(r, 100));
        return { ready, during, sceneGone: !!babylon?.isDisposed, engineGone: !!engine?.isDisposed };
    }, html);

    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const before = await page.evaluate(() => window.__listeners());
    const first = await cycle(SCENE);
    check("the scene came up", first.ready);
    check("the spy sees its listeners while it runs (keydown)", Object.keys(first.during).some(k => k.startsWith("keydown")) && sum(first.during) > sum(before),
        JSON.stringify({ before, during: first.during }));
    check("removing it disposes the scene and the engine", first.sceneGone && first.engineGone, JSON.stringify(first));
    const afterOne = await page.evaluate(() => window.__listeners());
    check("one removal: window listeners back to where they started", JSON.stringify(afterOne) == JSON.stringify(before), JSON.stringify({ before, afterOne }));

    let allReady = true;
    for (let i = 0; i < 19; i++) allReady = (await cycle(SCENE)).ready && allReady;
    check("19 more came up", allReady);
    const after = await page.evaluate(() => window.__listeners());
    check("20 add-and-removes: window listeners don't grow", JSON.stringify(after) == JSON.stringify(before), JSON.stringify({ before, after }));
});
