// Browser test of one-shot animations that stay where they end, on a model with no looping
// or motion animation (examples/assets/hinged-box.glb: "Open" and "Close", each one turn of
// the lid; Tools/make-hinged-box.py). With animation="none": play(name, { loop: false })
// holds its last frame; the next one-shot starts from the held pose without a jump; and what
// a group started directly with group.start() does. Run after a build.
const { run } = require("./harness");

run(`<garden-scene>
    <garden-camera type="arc" radius="1" near="0.01" target="0 0.15 0"></garden-camera>
    <garden-light type="hemispheric"></garden-light>
    <garden-mesh-model id="box" src="/examples/assets/hinged-box.glb" animation="none" loading-screen="false"></garden-mesh-model>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("box").animationGroups?.length == 2);
    await page.evaluate(() => {
        const s = document.querySelector("garden-scene").scene, el = document.getElementById("box");
        const lid = s.getTransformNodeByName("Lid");
        // The lid's angle from closed, in degrees, and from a group's last key.
        window.lidAngle = () => +(2 * Math.acos(Math.min(1, Math.abs(lid.rotationQuaternion.w))) * 180 / Math.PI).toFixed(1);
        window.lastKey = name => {
            const q = el.animationGroups.find(g => g.name == name).targetedAnimations[0].animation.getKeys().at(-1).value;
            return +(2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI).toFixed(1);
        };
        window.ended = name => new Promise(resolve => el.addEventListener("garden-animation-end",
            e => e.detail.name == name && resolve(), { once: true }));
    });
    check("the box has Open and Close", (await page.evaluate(() => document.getElementById("box").animationNames.join())) == "Close,Open");
    check("it rests closed", (await page.evaluate(() => lidAngle())) < 0.5);

    // (c) A page starting a group itself: the mixer (made at load, as any animated model's is)
    // has every weight at 0, so nothing moves; with group.weight = 1 it does.
    const direct = await page.evaluate(async () => {
        const g = document.getElementById("box").animationGroups.find(g => g.name == "Open");
        const weight = g.weight;
        g.start(false);
        await new Promise(r => setTimeout(r, 1500));
        const still = lidAngle();
        g.stop(); g.reset();
        g.weight = 1;
        g.start(false);
        await new Promise(r => setTimeout(r, 1500));
        const moved = lidAngle();
        g.stop(); g.reset(); g.weight = 0;
        return { weight, still, moved };
    });
    check("(c) group.start() alone after load moves nothing (weight 0)", direct.weight == 0 && direct.still < 0.5, JSON.stringify(direct));
    check("(c) with group.weight = 1 it moves", direct.moved > 100, JSON.stringify(direct));
    // (a) A one-shot holds its last frame.
    const held = await page.evaluate(async () => {
        const el = document.getElementById("box"), done = ended("Open");
        el.play("Open", { loop: false, blend: 0 });
        await done;
        const atEnd = lidAngle();
        await new Promise(r => setTimeout(r, 1000));
        const g = el.mixer.group("Open");
        return { atEnd, later: lidAngle(), key: lastKey("Open"), weight: g.weight, current: el.mixer.current };
    });
    check("(a) after Open ends the lid holds the last key, 1 s later too",
        Math.abs(held.later - held.key) < 0.5 && Math.abs(held.atEnd - held.key) < 0.5, JSON.stringify(held));

    // Close runs and holds closed.
    const closed = await page.evaluate(async () => {
        const el = document.getElementById("box"), done = ended("Close");
        el.play("Close", { loop: false, blend: 0 });
        await done;
        await new Promise(r => setTimeout(r, 1000));
        return { angle: lidAngle(), key: lastKey("Close") };
    });
    check("Close runs and holds closed", closed.angle < 0.5 && closed.key < 0.5, JSON.stringify(closed));

    // (b) Open again from the held Close: the first frames start near closed, no jump.
    const restart = await page.evaluate(() => new Promise(resolve => {
        const el = document.getElementById("box"), s = document.querySelector("garden-scene").scene, angles = [];
        el.play("Open", { loop: false, blend: 0 });
        const o = s.onAfterRenderObservable.add(() => {
            angles.push(lidAngle());
            if (angles.length == 4) { s.onAfterRenderObservable.remove(o); resolve(angles); }
        });
    }));
    check("(b) Open from the held Close starts from closed, without a jump", restart[0] < 15 && restart.every((a, i) => i == 0 || a >= restart[i - 1]),
        restart.join(", "));
    await page.evaluate(() => ended("Open"));

    // playOnce(): a Promise for the one-shot's end, false when something takes over.
    const once = await page.evaluate(async () => {
        const el = document.getElementById("box");
        const close = await el.playOnce("Close", { blend: 0 });
        const closedAt = lidAngle();
        const first = el.playOnce("Open", { blend: 0 });
        await new Promise(r => setTimeout(r, 200));
        el.play("Close", { loop: false, blend: 0 });
        const superseded = await first;
        await ended("Close");
        const missing = await el.playOnce("Nothing");
        const open = await el.playOnce("Open", { blend: 0 });
        await new Promise(r => setTimeout(r, 500));
        return { close, closedAt, superseded, missing, open, openAt: lidAngle() };
    });
    check("playOnce resolves true when the one-shot ends, and the pose holds", once.close === true && once.closedAt < 0.5 && once.open === true && Math.abs(once.openAt - 110) < 0.5, JSON.stringify(once));
    check("playOnce resolves false when another play takes over, or there's no such animation", once.superseded === false && once.missing === false, JSON.stringify(once));

    // A one-shot played again while it plays starts over: the lid goes back to Close's first
    // frame (open), the first playOnce resolves false and the second true, holding closed.
    const replay = await page.evaluate(async () => {
        const el = document.getElementById("box"), s = document.querySelector("garden-scene").scene;
        const first = el.playOnce("Close", { blend: 0 });
        await new Promise(r => setTimeout(r, 300));
        const mid = lidAngle();
        const second = el.playOnce("Close", { blend: 0 });
        const after = await new Promise(resolve => s.onAfterRenderObservable.addOnce(() => resolve(lidAngle())));
        const results = await Promise.all([first, second]);
        return { mid, after, first: results[0], second: results[1], end: lidAngle() };
    });
    check("a one-shot played again mid-play starts over; the first playOnce resolves false, the second true",
        replay.mid > 10 && replay.mid < 100 && replay.after > replay.mid + 15 && replay.first === false && replay.second === true && replay.end < 0.5,
        JSON.stringify(replay));

    // Last, as it removes the model: a one-shot cut short by the model going away still
    // settles (false), so a page awaiting it (a button kept disabled) isn't left waiting.
    const removed = await page.evaluate(async () => {
        const el = document.getElementById("box");
        const pending = el.playOnce("Close", { blend: 0 });
        await new Promise(r => setTimeout(r, 100));
        el.remove();
        return await Promise.race([pending, new Promise(r => setTimeout(() => r("still waiting after 3 s"), 3000))]);
    });
    check("playOnce resolves false when the model is removed mid-play", removed === false, JSON.stringify(removed));
});
