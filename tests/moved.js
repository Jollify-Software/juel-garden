// Browser test of moving a built element and removing one for good (QUESTIONS.md §15). A move
// (removed and added back in one task) keeps the build: the same mesh, water or light, not
// disposed. Moved into a `parent`-tagged element, the mesh follows its node; moved out, it leaves.
// Removed for good, its Babylon objects and its behaviours' per-frame observers leave the
// scene; added back later, it builds again. A moved <garden-scene> keeps its engine and goes on
// drawing; removed for good, its engine is disposed; added back after that, it builds again and
// so do its children, its physics too. A <garden-info> rebuilt for a change keeps its rows,
// and a mesh with a <garden-link> inside stays clickable when it is built again. A <garden-duplicate-vertices>,
// a <garden-action> and a <garden-lightning> mid-flash leave no per-frame work behind. Run after a build: node tests/moved.js.
const { run } = require("./harness");

run(`<garden-scene>
    <garden-camera type="arc"></garden-camera>
    <garden-light type="hemispheric" id="sun"></garden-light>
    <garden-ground id="floor" width="20" depth="20"></garden-ground>
    <garden-box id="box" position="1 0.5 0"></garden-box>
    <garden-box id="spinner" position="-2 0.5 0" track="0 0.5 -3"></garden-box>
    <garden-water id="pond" position="4 0 4" radius="2"></garden-water>
    <garden-light id="lamp" type="point" position="0 3 0"></garden-light>
    <garden-rocks id="rocks" ground="#floor" count="5" width="2" depth="2"></garden-rocks>
    <garden-element id="group" parent position="0 2 0"></garden-element>
    <garden-element id="elsewhere"></garden-element>
</garden-scene>`,
async ({ page, check, frames, open }) => {
    const settle = () => page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    await settle(); await frames(3);

    // A move keeps everything.
    const moved = await page.evaluate(() => {
        const sceneEl = document.querySelector("garden-scene"), $ = id => document.getElementById(id);
        const box = $("box"), pond = $("pond"), lamp = $("lamp");
        const before = { mesh: box.mesh, water: pond.water, light: lamp.light };
        sceneEl.appendChild(box); sceneEl.appendChild(pond); sceneEl.appendChild(lamp);
        return new Promise(r => setTimeout(() => r({
            mesh: box.mesh === before.mesh && !box.mesh.isDisposed(),
            water: pond.water === before.water && !pond.water.mesh.isDisposed(),
            light: lamp.light === before.light && sceneEl.scene.lights.includes(lamp.light),
        }), 100));
    });
    check("a moved box keeps its mesh", moved.mesh, JSON.stringify(moved));
    check("a moved water keeps its water", moved.water, JSON.stringify(moved));
    check("a moved light keeps its light", moved.light, JSON.stringify(moved));

    // Into a parent-tagged element and out again.
    const parented = await page.evaluate(async () => {
        const $ = id => document.getElementById(id), box = $("box");
        $("group").appendChild(box);
        await new Promise(r => setTimeout(r, 50));
        const inGroup = box.mesh.parent === $("group").getNode();
        const y = box.mesh.getAbsolutePosition().y;
        $("elsewhere").appendChild(box);
        await new Promise(r => setTimeout(r, 50));
        return { inGroup, y, out: box.mesh.parent === null, outY: box.mesh.getAbsolutePosition().y };
    });
    check("moved into a parent element, the mesh follows its node", parented.inGroup && Math.abs(parented.y - 2.5) < 1e-3,
        JSON.stringify(parented));
    check("moved out again, it leaves that node", parented.out && Math.abs(parented.outY - 0.5) < 1e-3, JSON.stringify(parented));

    // Rocks are sat on the ground where they are: a new parent builds them again.
    const rocks = await page.evaluate(async () => {
        const $ = id => document.getElementById(id), el = $("rocks");
        await el.whenReady;
        const before = el.mesh;
        $("group").appendChild(el);
        await new Promise(r => setTimeout(r, 300));
        await el.whenReady;
        return { rebuilt: el.mesh !== before && !el.mesh.isDisposed(), oldGone: before.isDisposed() };
    });
    check("rocks moved to a new parent are built again", rocks.rebuilt && rocks.oldGone, JSON.stringify(rocks));

    // Removed for good: everything leaves the scene, behaviour observers included.
    const gone = await page.evaluate(async () => {
        const s = document.querySelector("garden-scene").scene, $ = id => document.getElementById(id);
        const box = $("box"), spinner = $("spinner"), pond = $("pond"), lamp = $("lamp");
        const kept = { box: box.mesh, spinner: spinner.mesh, water: pond.water.mesh, light: lamp.light };
        const observers = s.onBeforeRenderObservable.observers.length;
        box.remove(); spinner.remove(); pond.remove(); lamp.remove();
        await new Promise(r => setTimeout(r, 100));
        return {
            box: kept.box.isDisposed() && !s.meshes.includes(kept.box),
            spinner: kept.spinner.isDisposed(),
            water: kept.water.isDisposed() && !s.meshes.includes(kept.water),
            light: !s.lights.includes(kept.light),
            observersBefore: observers,
            observersAfter: s.onBeforeRenderObservable.observers.length,
        };
    });
    check("a box removed for good leaves the scene", gone.box, JSON.stringify(gone));
    check("so do water and light", gone.water && gone.light, JSON.stringify(gone));
    check("a removed element's behaviour stops (its observer goes)", gone.spinner && gone.observersAfter < gone.observersBefore,
        JSON.stringify(gone));

    // Added back later: it builds again.
    const rebuilt = await page.evaluate(async () => {
        const sceneEl = document.querySelector("garden-scene"), s = sceneEl.scene;
        const box = document.createElement("garden-box");
        box.setAttribute("position", "0 0.5 2");
        sceneEl.appendChild(box);
        await new Promise(r => setTimeout(r, 100));
        const first = box.mesh;
        box.remove();
        await new Promise(r => setTimeout(r, 100));
        const disposed = first.isDisposed();
        sceneEl.appendChild(box);
        await new Promise(r => setTimeout(r, 100));
        const lamp = document.createElement("garden-light");
        lamp.setAttribute("type", "point");
        sceneEl.appendChild(lamp);
        await new Promise(r => setTimeout(r, 100));
        const firstLight = lamp.light;
        lamp.remove();
        await new Promise(r => setTimeout(r, 100));
        sceneEl.appendChild(lamp);
        await new Promise(r => setTimeout(r, 300));
        const pond = document.createElement("garden-water");
        sceneEl.appendChild(pond);
        await new Promise(r => setTimeout(r, 100));
        pond.remove();
        await new Promise(r => setTimeout(r, 100));
        sceneEl.appendChild(pond);
        await new Promise(r => setTimeout(r, 100));
        return {
            disposed, box: !!box.mesh && box.mesh !== first && s.meshes.includes(box.mesh),
            light: !!lamp.light && lamp.light !== firstLight && s.lights.includes(lamp.light),
            water: !!pond.water && s.meshes.includes(pond.water.mesh),
        };
    });
    check("a box added back after removal builds again", rebuilt.disposed && rebuilt.box, JSON.stringify(rebuilt));
    check("so do a light and a water", rebuilt.light && rebuilt.water, JSON.stringify(rebuilt));

    // The scene itself moved (for example into another part of the page) keeps its engine and
    // goes on drawing; removed for good, its engine is disposed.
    const sceneMove = await page.evaluate(async () => {
        const sceneEl = document.querySelector("garden-scene"), engine = sceneEl.engine, holder = document.createElement("div");
        document.body.appendChild(holder);
        holder.appendChild(sceneEl);
        await new Promise(r => setTimeout(r, 100));
        const f0 = sceneEl.scene.getFrameId();
        await new Promise(r => setTimeout(r, 300));
        const kept = { same: sceneEl.engine === engine, disposed: engine.isDisposed, drawn: sceneEl.scene.getFrameId() - f0 };
        sceneEl.remove();
        window.removedScene = sceneEl;
        await new Promise(r => setTimeout(r, 100));
        return { ...kept, removed: engine.isDisposed };
    });
    check("a moved scene keeps its engine and goes on drawing",
        sceneMove.same && !sceneMove.disposed && sceneMove.drawn > 0, JSON.stringify(sceneMove));
    check("a scene removed for good disposes its engine", sceneMove.removed, JSON.stringify(sceneMove));

    // Added back after that, the scene builds again, as an element does: a new engine that
    // draws, and its children built into the new scene.
    const sceneBack = await page.evaluate(async () => {
        const sceneEl = window.removedScene, old = sceneEl.engine;
        document.body.appendChild(sceneEl);
        await new Promise(r => setTimeout(r, 500));
        const s = sceneEl.scene, f0 = s.getFrameId();
        const box = sceneEl.querySelector("garden-box"), lamp = sceneEl.querySelector("garden-light[type=point]");
        await new Promise(r => setTimeout(r, 300));
        return {
            newEngine: sceneEl.engine !== old && !sceneEl.engine.isDisposed, drawn: s.getFrameId() - f0,
            canvases: sceneEl.querySelectorAll(":scope > canvas").length,
            box: !!box?.mesh && !box.mesh.isDisposed() && s.meshes.includes(box.mesh),
            light: !!lamp?.light && s.lights.includes(lamp.light), camera: !!s.activeCamera, live: !s.isDisposed,
        };
    });
    check("a scene added back after removal for good builds again and draws",
        sceneBack.newEngine && sceneBack.drawn > 0 && sceneBack.canvases == 1 && sceneBack.camera, JSON.stringify(sceneBack));
    check("its children build into the new scene", sceneBack.live && sceneBack.box && sceneBack.light, JSON.stringify(sceneBack));

    // With <garden-physics>: added back, the physics starts again in the new scene, and the bodies
    // of meshes before and after it in the page join it. A <garden-physics> moved on its own
    // keeps its plugin.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-light type="hemi"></garden-light>
        <garden-box id="early" position="-1 4 0" physics></garden-box>
        <garden-physics></garden-physics>
        <garden-ground width="20" depth="20" physics="static"></garden-ground>
        <garden-box id="late" position="1 4 0" physics></garden-box>
    </garden-scene>`);
    await page.waitForFunction(() => !!document.getElementById("late").physicsAggregate, null, { timeout: 20000 });
    const physicsBack = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const sceneEl = document.querySelector("garden-scene"), physicsEl = sceneEl.querySelector("garden-physics");
        const plugin = physicsEl.plugin;
        sceneEl.appendChild(physicsEl);
        await wait(100);
        const movedKeeps = physicsEl.plugin === plugin && !!sceneEl.scene.getPhysicsEngine();
        const old = sceneEl.scene;
        sceneEl.remove();
        await wait(200);
        document.body.appendChild(sceneEl);
        await wait(2500);
        const s = sceneEl.scene, body = id => {
            const el = document.getElementById(id), b = el.physicsAggregate?.body;
            return !!b && !b.isDisposed && el.mesh.getScene() === s && el.mesh.position.y < 3;
        };
        return { movedKeeps, newScene: s !== old, physics: !!s.getPhysicsEngine(),
            newPlugin: !!physicsEl.plugin && physicsEl.plugin !== plugin, early: body("early"), late: body("late") };
    });
    check("a moved <garden-physics> keeps its plugin", physicsBack.movedKeeps, JSON.stringify(physicsBack));
    check("a scene added back starts its physics again", physicsBack.newScene && physicsBack.physics && physicsBack.newPlugin,
        JSON.stringify(physicsBack));
    check("bodies before and after <garden-physics> fall in the new scene", physicsBack.early && physicsBack.late,
        JSON.stringify(physicsBack));

    // A <garden-text> and a <garden-button> each keep one row in their <garden-info> card: after a
    // change, removed for good (none), and added back.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-light type="hemi"></garden-light>
        <garden-box><garden-info title="Card"><garden-text id="t">Hello</garden-text><garden-button id="go">Go</garden-button></garden-info></garden-box>
    </garden-scene>`);
    const rows = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const info = document.querySelector("garden-info"), t = document.getElementById("t"), go = document.getElementById("go");
        const count = () => {
            const divs = [...info.container.children].filter(e => e.tagName == "DIV");
            return [divs.length, info.container.querySelectorAll("button").length, divs[0]?.style.color ?? ""].join(",");
        };
        await wait(500);
        const first = count();
        t.setAttribute("color", "red"); go.setAttribute("color", "blue");
        await wait(300);
        const changed = count();
        t.remove(); go.remove();
        await wait(300);
        const removed = count();
        info.append(t, go);
        await wait(500);
        return { first, changed, removed, back: count() };
    });
    check("<garden-info> rows: one each after a change, none removed, one each added back",
        rows.first == "1,1," && rows.changed == "1,1,red" && rows.removed == "0,0," && rows.back == "1,1,red", JSON.stringify(rows));

    // A <garden-info> rebuilt for its own change (a new title) builds a new card: its text, button and
    // link rows build into it again and an open card stays open. A <garden-link> in a card removed for
    // good takes its button; added back, it is there once. The card removed and added back has each once.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-light type="hemi"></garden-light>
        <garden-box id="cardbox"><garden-info title="Card"><garden-text>Hello</garden-text><garden-button>Go</garden-button><garden-link id="lk" href="#cardbox">There</garden-link></garden-info></garden-box>
    </garden-scene>`);
    const card = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const box = document.getElementById("cardbox"), link = document.getElementById("lk");
        const read = () => {
            const info = box.querySelector("garden-info"), c = info.container;
            const panels = [...document.body.children].filter(e => e.tagName == "DIV" && e.style.zIndex == "1000").length;
            return [info.panel.querySelector("span").textContent, [...c.children].filter(e => e.tagName == "DIV").map(e => e.textContent),
                [...c.querySelectorAll("button")].map(b => b.textContent), document.body.contains(c), panels, info.visible].join("|");
        };
        await wait(500);
        const first = read();
        const info = box.querySelector("garden-info");
        info.show();
        info.setAttribute("title", "New title");
        await wait(400);
        const retitled = read();
        link.remove();
        await wait(300);
        const linkGone = read();
        info.appendChild(link);
        await wait(400);
        const linkBack = read();
        info.remove();
        await wait(300);
        box.appendChild(info);
        await wait(500);
        return { first, retitled, linkGone, linkBack, back: read() };
    });
    check("<garden-info> rebuilt for a new title keeps its text, button and link rows and stays open",
        card.first == "Card|Hello|Go,There|true|1|false" && card.retitled == "New title|Hello|Go,There|true|1|true", JSON.stringify(card));
    check("a <garden-link> in a card: removed for good its button goes, added back it is there once",
        card.linkGone == "New title|Hello|Go|true|1|true" && card.linkBack == "New title|Hello|Go,There|true|1|true", JSON.stringify(card));
    check("the card removed for good and added back has each row once, in one panel",
        card.back.startsWith("New title|Hello|Go,There|true|1|"), JSON.stringify(card));

    // A <garden-link> inside a mesh makes that mesh clickable: the mesh's new mesh after a change, and after
    // it is removed for good and added back, is clickable too, with the link's 3 actions once; a change on
    // the link itself swaps its actions rather than adding more.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-light type="hemi"></garden-light>
        <garden-box id="lb" colour="red"><garden-link id="ll" href="#lt"></garden-link></garden-box>
        <garden-box id="lt" position="5 0 0"></garden-box>
    </garden-scene>`);
    const clickable = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const box = document.getElementById("lb"), link = document.getElementById("ll");
        const read = () => (box.mesh?.actionManager?.actions ?? []).length;
        await wait(500);
        const first = read(), firstMesh = box.mesh, firstAction = box.mesh.actionManager.actions[0];
        box.setAttribute("colour", "blue");
        await wait(400);
        const recoloured = read(), newMesh = box.mesh != firstMesh, recolouredAction = box.mesh.actionManager.actions[0];
        link.setAttribute("highlighted-colour", "#ff0000");
        await wait(400);
        const linkChanged = read(), swapped = box.mesh.actionManager.actions[0] != recolouredAction;
        box.remove();
        await wait(300);
        document.querySelector("garden-scene").appendChild(box);
        await wait(600);
        return { first, newMesh, recoloured, linkChanged, swapped, back: read(), backLive: !box.mesh.isDisposed(), differs: firstAction != recolouredAction };
    });
    check("a link inside a mesh: the mesh rebuilt for a change is clickable, its actions once",
        clickable.first == 3 && clickable.newMesh && clickable.recoloured == 3 && clickable.differs, JSON.stringify(clickable));
    check("a change on the link itself swaps its actions (still 3)", clickable.linkChanged == 3 && clickable.swapped, JSON.stringify(clickable));
    check("the mesh removed for good and added back is clickable, its actions once", clickable.back == 3 && clickable.backLive,
        JSON.stringify(clickable));
    // A <garden-link> portal rebuilt for a change replaces its ring and title with their materials and the
    // title's texture, rather than leaving the old ones in the scene (nor the material `colour` makes for the bare
    // disc); removed for good it leaves nothing, and added back it is as first built.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-light type="hemi"></garden-light>
        <garden-link id="pl" href="#pt" title="Go" colour="#ffffff"></garden-link>
        <garden-box id="pt" position="5 0 0"></garden-box>
    </garden-scene>`);
    const portal = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const link = document.getElementById("pl");
        const scene = document.querySelector("garden-scene").scene;
        const read = () => {
            const meshes = scene.meshes.filter(m => m.name.startsWith("pl-") && !m.isDisposed());
            return [meshes.map(m => m.name).sort().join(","), meshes.map(m => m.actionManager?.actions?.length ?? 0).join(","),
                scene.materials.filter(m => m.name.startsWith("pl-")).length, scene.textures.filter(t => t.name.startsWith("pl-")).length,
                scene.materials.length].join("|");
        };
        await wait(500);
        const first = read();
        link.setAttribute("colour", "red");
        await wait(400);
        const changed = read();
        link.remove();
        await wait(300);
        const gone = read();
        document.querySelector("garden-scene").appendChild(link);
        await wait(500);
        return { first, changed, gone, back: read() };
    });
    check("a portal rebuilt for a change keeps 3 parts, 3 materials and 1 title texture, not the old ones too",
        portal.first.startsWith("pl-portal,pl-ring,pl-title|3,3,3|3|1|") && portal.changed == portal.first, JSON.stringify(portal));
    check("a portal removed for good leaves nothing; added back it is as first built",
        portal.gone.startsWith("||0|0|") && portal.back == portal.first, JSON.stringify(portal));
    // A <garden-duplicate-vertices> wobbles its parent's mesh from one per-frame observer and a hidden
    // reference sphere. The parent rebuilt for a change, the wobble moves to the new mesh; removed for
    // good, the observer and the sphere leave the scene; added back, it wobbles again.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-light type="hemi"></garden-light>
        <garden-sphere id="blob" segments="32" diameter="2.5" colour="#6680b3">
            <garden-duplicate-vertices id="wob"></garden-duplicate-vertices>
        </garden-sphere>
    </garden-scene>`);
    const wobble = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const blob = document.getElementById("blob"), wob = document.getElementById("wob");
        const scene = document.querySelector("garden-scene").scene;
        const read = async () => {
            const mesh = blob.mesh, x = () => mesh.getVerticesData("position")[0];
            const a = x();
            await wait(200);
            return [scene.onBeforeRenderObservable.observers.length,
                scene.meshes.filter(m => m.name == "sphere1" && !m.isDisposed()).length, x() != a].join("|");
        };
        await wait(500);
        const first = await read();
        const firstMesh = blob.mesh;
        blob.setAttribute("colour", "#b36680");
        await wait(400);
        const recoloured = await read();
        const newMesh = blob.mesh != firstMesh;
        wob.remove();
        await wait(300);
        const gone = await read();
        blob.appendChild(wob);
        await wait(500);
        return { first, recoloured, newMesh, gone, back: await read() };
    });
    const [obs] = wobble.first.split("|").map(Number);
    check("a wobble moves to its parent's new mesh when the parent is rebuilt for a change, one loop and one sphere",
        wobble.first.endsWith("|1|true") && wobble.newMesh && wobble.recoloured == wobble.first, JSON.stringify(wobble));
    check("a wobble removed for good stops its loop and disposes its sphere; added back it wobbles again",
        wobble.gone == `${obs - 1}|0|false` && wobble.back == wobble.first, JSON.stringify(wobble));
    // A <garden-action> rebuilt for a change replaces what it added, rather than adding it again: its
    // parent mesh's action and its before-render loop. Removed for good, both go; added back, both return.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-light type="hemi"></garden-light>
        <garden-box id="ab">
            <garden-action id="pick" type="set" trigger="pick" parameter="#ab" property="visibility" value="0.5"></garden-action>
        </garden-box>
        <garden-box id="mover" position="2 0 0"></garden-box>
        <garden-action id="loop" type="beforeRender" parameter="#mover" property="position" value="2 0 0" increment="0"></garden-action>
    </garden-scene>`);
    const actions = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const box = document.getElementById("ab"), pick = document.getElementById("pick"), loop = document.getElementById("loop");
        const scene = document.querySelector("garden-scene").scene;
        const read = () => [box.mesh.actionManager?.actions?.length ?? 0, scene.onBeforeRenderObservable.observers.length].join("|");
        await wait(500);
        const first = read();
        pick.setAttribute("value", "0.25"); loop.setAttribute("value", "3 0 0");
        await wait(400);
        const changed = read();
        pick.remove(); loop.remove();
        await wait(300);
        const gone = read();
        box.appendChild(pick); scene && document.querySelector("garden-scene").appendChild(loop);
        await wait(500);
        return { first, changed, gone, back: read() };
    });
    const [acts, loops] = actions.first.split("|").map(Number);
    check("a <garden-action> changed replaces its mesh action and its loop, not adds them again",
        acts == 1 && actions.changed == actions.first, JSON.stringify(actions));
    check("a <garden-action> removed for good takes its mesh action and loop; added back they return",
        actions.gone == `0|${loops - 1}` && actions.back == actions.first, JSON.stringify(actions));
    // A <garden-lightning> removed for good in the middle of a flash ends the flash: its frame
    // observer goes and the sky colour is put back, with no page error from the disposed light.
    await open(`<garden-scene>
        <garden-camera type="arc" radius="10"></garden-camera>
        <garden-lightning id="bolt" intensity="4"></garden-lightning>
    </garden-scene>`);
    const flash = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const bolt = document.getElementById("bolt");
        const scene = document.querySelector("garden-scene").scene;
        await wait(400);
        const read = () => [scene.onBeforeRenderObservable.observers.length, scene.clearColor.toHexString()].join("|");
        const before = read();
        bolt.strike();
        await wait(100);
        const during = read();
        bolt.remove();
        await wait(400);
        return { before, during, after: read() };
    });
    check("a <garden-lightning> removed mid-flash ends the flash: its observer gone, the sky put back",
        flash.during != flash.before && flash.after == flash.before, JSON.stringify(flash));
});
