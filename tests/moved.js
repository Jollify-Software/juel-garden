// Browser test of moving a built element and removing one for good (QUESTIONS.md §15). A move
// (removed and added back in one task) keeps the build: the same mesh, water or light, not
// disposed. Moved into a `parent`-tagged element, the mesh follows its node; moved out, it leaves.
// Removed for good, its Babylon objects and its behaviours' per-frame observers leave the
// scene; added back later, it builds again. Run after a build: node tests/moved.js.
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
async ({ page, check, frames }) => {
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
});
