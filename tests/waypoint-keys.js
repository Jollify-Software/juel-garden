// Browser test of next/previous keys on <garden-waypoint> (`keys`, on by default): PageDown and
// ArrowRight fly to the next stop, PageUp and ArrowLeft to the previous one (what presentation
// clickers send). Controls: a key typed into an <input> doesn't move, Ctrl+ArrowRight doesn't
// move, `keys="false"` doesn't move, and keys the waypoint doesn't use aren't preventDefault()ed.
// Run after a build: node tests/waypoint-keys.js.
const { run } = require("./harness");

const scene = keys => `
<input id="field">
<garden-scene>
  <garden-camera position="0 1.6 -8">
    <garden-waypoint waypoints="#a #b #c" offset="0 1.6 0" speed="8" dwell="0"${keys}></garden-waypoint>
  </garden-camera>
  <garden-light></garden-light>
  <garden-ground width="80" height="80"></garden-ground>
  <garden-cylinder id="a" height="0.2" diameter="1.5" position="0 0.1 -8"></garden-cylinder>
  <garden-cylinder id="b" height="0.2" diameter="1.5" position="8 0.1 4"></garden-cylinder>
  <garden-cylinder id="c" height="0.2" diameter="1.5" position="-8 0.1 4"></garden-cylinder>
</garden-scene>`;

run(scene(""), async ({ page, check, open }) => {
    const ready = () => page.waitForFunction(() => Array.isArray(document.querySelector("garden-waypoint").waypoints), null, { timeout: 30000 });
    const index = () => page.evaluate(() => document.querySelector("garden-waypoint").index);
    const camAt = () => page.evaluate(() => { const c = document.querySelector("garden-scene").scene.activeCamera.position; return [c.x, c.z].map(Math.round); });
    // Focus the page body (not the input) and press a key, as a clicker would.
    const press = async key => {
        await page.evaluate(() => document.activeElement?.blur());
        await page.keyboard.press(key);
        await page.waitForTimeout(100);
    };
    await ready();
    check("starts at the first stop", await index() === 0);

    await press("PageDown");
    check("PageDown: next stop (b)", await index() === 1);
    await page.waitForTimeout(1200);
    check("…and the camera flew there", JSON.stringify(await camAt()) === JSON.stringify([8, 4]), JSON.stringify(await camAt()));
    await press("ArrowRight");
    check("ArrowRight: next stop (c)", await index() === 2);
    await press("ArrowRight");
    check("ArrowRight after the last wraps to the first (a)", await index() === 0);
    await press("PageUp");
    check("PageUp: previous stop (before the first, the last: c)", await index() === 2);
    await press("ArrowLeft");
    check("ArrowLeft: previous stop (b)", await index() === 1);
    await page.waitForTimeout(1200);
    check("…and the camera flew back to b", JSON.stringify(await camAt()) === JSON.stringify([8, 4]), JSON.stringify(await camAt()));

    // The keys it acts on are preventDefault()ed (no page scroll); others aren't.
    const prevented = await page.evaluate(() => {
        const out = {};
        for (const key of ["PageDown", "ArrowUp", "a"]) {
            const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
            document.body.dispatchEvent(e);
            out[key] = e.defaultPrevented;
        }
        return out;
    });
    check("a key it acts on is preventDefault()ed, others aren't", prevented.PageDown && !prevented.ArrowUp && !prevented.a, JSON.stringify(prevented));
    check("(that PageDown moved on to c)", await index() === 2);

    // Control: typing in an input doesn't move.
    await page.focus("#field");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("PageUp");
    await page.keyboard.type("hello");
    await page.waitForTimeout(100);
    check("control: keys typed into an <input> don't move", await index() === 2);
    // Control: with a modifier held, nothing moves.
    await page.evaluate(() => document.activeElement?.blur());
    for (const k of ["Control+ArrowRight", "Alt+ArrowLeft", "Meta+PageDown"]) await page.keyboard.press(k);
    await page.waitForTimeout(100);
    check("control: Ctrl/Alt/Meta + key don't move", await index() === 2);

    // Taken out of the page, its listener goes (a key doesn't move it); put back, it returns.
    // (Out and back within one task, so no frame renders while it's detached.)
    const detached = await page.evaluate(() => {
        const w = document.querySelector("garden-waypoint"), parent = w.parentElement;
        w.remove();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true, cancelable: true }));
        const index = w.index;
        parent.appendChild(w);
        return index;
    });
    check("disconnected: the key listener is gone", detached === 2, String(detached));
    await press("PageUp");
    check("reconnected: keys work again (b)", await index() === 1);

    // Control: keys="false" doesn't move.
    await open(scene(' keys="false"'));
    await ready();
    check('keys="false" is read as off', await page.evaluate(() => document.querySelector("garden-waypoint").keys) === false);
    await press("PageDown");
    await press("ArrowRight");
    check('control: with keys="false" PageDown/ArrowRight don\'t move', await index() === 0);
    const notPrevented = await page.evaluate(() => {
        const e = new KeyboardEvent("keydown", { key: "PageDown", bubbles: true, cancelable: true });
        document.body.dispatchEvent(e);
        return !e.defaultPrevented;
    });
    check('…and with keys="false" PageDown isn\'t preventDefault()ed', notPrevented);
});
