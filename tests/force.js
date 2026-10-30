// Browser test of <garden-force>: an explosion throws bodies outwards, a gravity field pulls
// them in, an updraft lifts them, a vortex spins them round; event="load" with delay and
// duration, the garden-force event, show, and stop(). Run after a build: npm run test:force.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-physics></garden-physics>
  <garden-camera type="arc" position="0 20 -60"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="100" height="100" physics="static"></garden-ground>

  <garden-box id="near" physics size="1" position="2 0.5 0"></garden-box>
  <garden-box id="far" physics size="1" position="-12 0.5 0"></garden-box>
  <garden-force id="blast" type="explosion" position="0 0 0" radius="6" strength="20" falloff="linear" show></garden-force>

  <garden-box id="pulled" physics size="1" position="24 0.5 0"></garden-box>
  <garden-force id="pull" type="gravity" position="20 3 0" radius="8" strength="20"></garden-force>

  <garden-box id="lifted" physics size="1" position="0 0.5 25"></garden-box>
  <garden-force id="lift" type="updraft" position="0 0 25" radius="4" strength="20" height="20" event="load" delay="300" duration="1500" show></garden-force>

  <garden-box id="spun" physics size="1" position="-25 0.5 -3"></garden-box>
  <garden-force id="whirl" type="vortex" position="-25 0 0" radius="8" strength="40" height="10"></garden-force>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => [...document.querySelectorAll("garden-box")].every(b => b.physicsAggregate), null, { timeout: 20000 });
    await page.evaluate(() => {
        window.__forces = [];
        document.querySelector("garden-scene").addEventListener("garden-force", e => window.__forces.push(e.target.id + ":" + e.detail.type));
    });
    // event="load" with a delay: the updraft comes on by itself, and goes off after its duration.
    await page.waitForFunction(() => document.getElementById("lift").active, null, { timeout: 5000 });
    const shown = await page.evaluate(() => document.querySelector("garden-scene").scene.meshes.filter(m => m.name == "force").length);
    check("event=\"load\" sets a field off by itself, and show draws where it reaches", shown == 1, String(shown));

    await page.evaluate(() => { blast.fire(); pull.fire(); whirl.fire(); });
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
        const p = id => document.getElementById(id).mesh.getAbsolutePosition();
        const v = id => document.getElementById(id).physicsAggregate.body.getLinearVelocity();
        return {
            nearX: p("near").x, farX: p("far").x,
            pulledX: p("pulled").x, liftedY: p("lifted").y,
            spun: v("spun").x, spunAt: p("spun").asArray().map(n => +n.toFixed(2)),
            forces: window.__forces,
        };
    });
    check("an explosion throws a body in reach outwards", s.nearX > 3, JSON.stringify(s));
    check("an explosion leaves a body out of reach alone", Math.abs(s.farX + 12) < 0.01, JSON.stringify(s));
    check("a gravity field pulls a body towards its centre", s.pulledX < 23.5, JSON.stringify(s));
    check("an updraft lifts a body", s.liftedY > 2, JSON.stringify(s));
    check("a vortex moves a body round its axis", Math.abs(s.spunAt[0] + 25) > 0.3, JSON.stringify(s));
    check("each fires garden-force", ["lift:updraft", "blast:explosion", "pull:gravity", "whirl:vortex"].every(f => s.forces.includes(f)), JSON.stringify(s.forces));

    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => ({ lift: lift.active, pull: pull.active, meshes: document.querySelector("garden-scene").scene.meshes.filter(m => m.name == "force").length }));
    check("a field goes off after its duration (and its show with it); one without stays on", !after.lift && after.pull && after.meshes == 0, JSON.stringify(after));
    await page.evaluate(() => { pull.stop(); whirl.stop(); });
    const stopped = await page.evaluate(() => pull.active || whirl.active);
    check("stop() turns a field off", !stopped);

    // event="load" waits for a frame after its build: one added and left in goes off once; one
    // removed in that wait doesn't (and its field isn't left on with nothing to stop it).
    const late = await page.evaluate(async () => {
        const scene = document.querySelector("garden-scene"), out = {};
        for (const remove of [false, true]) {
            const f = document.createElement("garden-force");
            for (const [k, v] of Object.entries({ type: "updraft", position: "40 0 40", radius: "2", event: "load", show: "" }))
                f.setAttribute(k, v);
            let fired = 0;
            f.addEventListener("garden-force", () => fired++);
            scene.appendChild(f);
            await f.updateComplete;
            await f.whenReady;
            const frame = scene.scene.getFrameId();
            if (remove) f.remove();
            const sameFrame = scene.scene.getFrameId() == frame;
            await new Promise(r => setTimeout(r, 500));
            out[remove ? "removed" : "kept"] = { fired, sameFrame, active: f.active };
            if (!remove) f.remove();
        }
        out.shown = scene.scene.meshes.filter(m => m.name == "force").length;
        return out;
    });
    check("an event=\"load\" force added later goes off once", late.kept.fired == 1 && late.kept.active, JSON.stringify(late));
    check("one removed before its first frame doesn't go off", late.removed.sameFrame && late.removed.fired == 0 &&
        !late.removed.active && late.shown == 0, JSON.stringify(late));

    // A change after an event="load" force went off: a field that's on stays on with the new
    // values (no second garden-force); an explosion, or a field whose duration ran out, isn't
    // set off again.
    const changed = await page.evaluate(async () => {
        const scene = document.querySelector("garden-scene"), wait = ms => new Promise(r => setTimeout(r, ms));
        const make = attrs => {
            const f = document.createElement("garden-force");
            for (const [k, v] of Object.entries({ position: "40 0 -40", radius: "2", event: "load", ...attrs }))
                f.setAttribute(k, v);
            f.fired = 0;
            f.addEventListener("garden-force", () => f.fired++);
            scene.appendChild(f);
            return f;
        };
        const field = make({ type: "updraft" }), blast = make({ type: "explosion" }), brief = make({ type: "vortex", duration: "200" });
        await wait(600);
        const before = { field: field.active, briefActive: brief.active };
        for (const f of [field, blast, brief]) f.setAttribute("radius", "3");
        await wait(300);
        const out = {
            before,
            field: { fired: field.fired, active: field.active },
            blast: { fired: blast.fired },
            brief: { fired: brief.fired, active: brief.active },
        };
        for (const f of [field, blast, brief]) f.remove();

        // A field on for a duration keeps what's left of it after a change, not a fresh one.
        const timed = make({ type: "gravity", duration: "1000" });
        await new Promise(r => timed.addEventListener("garden-force", r, { once: true }));
        const start = performance.now();
        await wait(500);
        timed.setAttribute("strength", "5");
        await wait(250);
        out.timed = { at750: timed.active };
        await wait(1000 - (performance.now() - start) + 250);
        out.timed.after = timed.active;
        out.timed.ms = Math.round(performance.now() - start);
        timed.remove();
        return out;
    });
    check("a change keeps an on field on with the new values, without going off again",
        changed.before.field && changed.field.active && changed.field.fired == 1, JSON.stringify(changed));
    check("a change doesn't set off an explosion again, or a field whose duration ran out",
        changed.blast.fired == 1 && changed.brief.fired == 1 && !changed.before.briefActive && !changed.brief.active, JSON.stringify(changed));
    check("a field changed part-way through its duration goes off when the first duration ends",
        changed.timed.at750 && !changed.timed.after, JSON.stringify(changed.timed));
});
