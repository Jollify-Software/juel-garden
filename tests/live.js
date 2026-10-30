// Browser test of attributes changed after an element has built (TODO "most elements still
// build once"). position/rotation/scale move a mesh in place (the same mesh; a physics body is
// teleported); any other attribute -- a Lit property like `width` or a plain one like `colour`
// or `track` -- rebuilds it without leaving the old mesh, material or behaviour behind; a child
// <garden-material>'s change reaches the mesh; trees, cameras and houses rebuild; a light still
// changes in place; a change made while an element is out of the document applies when it's back;
// nodes a game hung on a mesh after its build survive its rebuild.
// Run after a build: node tests/live.js.
const { run } = require("./harness");

run(`<garden-scene>
    <garden-camera id="cam" type="arc"></garden-camera>
    <garden-light type="hemispheric"></garden-light>
    <garden-physics gravity="0 0 0"></garden-physics>
    <garden-box id="box" position="0 0.5 0" colour="#ff0000">
    </garden-box>
    <garden-box id="holder" parent position="4 0 0"><garden-sphere id="ball" position="0 2 0" diameter="0.5"></garden-sphere></garden-box>
    <garden-line points="-3 0.5 0, -3 0.5 -6"><garden-box id="spinner" track track-step="0.05"></garden-box></garden-line>
    <garden-box id="worn" position="0 0.5 3"><garden-material colour="#0000ff"></garden-material></garden-box>
    <garden-sphere id="body" position="6 1 6" physics="dynamic"></garden-sphere>
    <garden-light id="lamp" type="point" position="0 3 0" intensity="1"></garden-light>
    <garden-trees id="trees" count="3"></garden-trees>
    <garden-house id="house" position="-6 0 -6"></garden-house>
    <garden-box id="coded" position="-8 0.5 8"><garden-sphere id="kid" position="0 1 0" diameter="0.3"></garden-sphere></garden-box>
    <garden-box id="sun" position="10 1 10"><garden-cylinder id="orb" orbit orbit-angle="0.02" position="13 0.1 10" diameter="1" height="0.2"></garden-cylinder></garden-box>
</garden-scene>`,
async ({ page, check, frames }) => {
    const settle = (ms = 300) => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms);
    await settle(800); await frames(3);
    const stat = () => page.evaluate(() => {
        const s = document.querySelector("garden-scene").scene;
        return { meshes: s.meshes.length, materials: s.materials.length, before: s.onBeforeRenderObservable.observers.length };
    });

    // position in place: the same mesh moves.
    const moved = await page.evaluate(async () => {
        const box = document.getElementById("box"), mesh = box.mesh;
        box.setAttribute("position", "1 2 3");
        await new Promise(r => setTimeout(r, 50));
        const p = box.mesh.position;
        box.setAttribute("rotation", "0 90 0");
        await new Promise(r => setTimeout(r, 50));
        return { same: box.mesh === mesh, at: [p.x, p.y, p.z], turned: +box.mesh.rotation.y.toFixed(3) };
    });
    check("a position change moves the same mesh", moved.same && moved.at.join() == "1,2,3", JSON.stringify(moved));
    check("a rotation change turns it (degrees)", Math.abs(moved.turned - Math.PI / 2) < 1e-3, JSON.stringify(moved));

    // The same through the properties, set from code: the mesh moves (a parent element's share
    // included) and the attribute follows; applyTransform() right after applies it at once.
    const coded = await page.evaluate(async () => {
        const box = document.getElementById("coded"), kid = document.getElementById("kid"), mesh = box.mesh;
        const V = mesh.position.constructor, xyz = v => [v.x, v.y, v.z].map(n => +n.toFixed(3)).join();
        box.position = new V(-7, 0.5, 9);
        box.rotation = new V(0, 180, 0);
        await new Promise(r => setTimeout(r, 50));
        const at = xyz(box.mesh.position), turned = +box.mesh.rotation.y.toFixed(3), attr = box.getAttribute("position");
        kid.position = new V(0, 2, 0);
        kid.applyTransform();
        const kidNow = xyz(kid.mesh.position);
        await new Promise(r => setTimeout(r, 50));
        return { same: box.mesh === mesh, at, turned, attr, kidNow, kidLater: xyz(kid.mesh.position) };
    });
    check("a position property set from code moves the same mesh", coded.same && coded.at == "-7,0.5,9" && coded.attr == "-7 0.5 9",
        JSON.stringify(coded));
    check("a rotation property set from code turns it (degrees, as the attribute)", Math.abs(coded.turned - Math.PI) < 1e-3, JSON.stringify(coded));
    check("a child's position property adds its parent element's share, at once with applyTransform()",
        coded.kidNow == "-7,2.5,9" && coded.kidLater == "-7,2.5,9", JSON.stringify(coded));

    // Other attributes rebuild, without leaving anything behind.
    const base = await stat();
    const rebuilt = await page.evaluate(async () => {
        const box = document.getElementById("box"), first = box.mesh;
        box.setAttribute("width", "3");
        await new Promise(r => setTimeout(r, 100));
        const second = box.mesh;
        box.setAttribute("colour", "#00ff00");
        await new Promise(r => setTimeout(r, 100));
        const c = box.mesh.material.diffuseColor;
        const size = box.mesh.getBoundingInfo().boundingBox.extendSize.x * 2;
        return { rebuilt: second !== first && first.isDisposed(), size: +size.toFixed(3), green: c.g > 0.9 && c.r < 0.1,
            at: [box.mesh.position.x, box.mesh.position.y, box.mesh.position.z].join() };
    });
    const after = await stat();
    check("a width change (a Lit property) rebuilds the mesh", rebuilt.rebuilt && rebuilt.size == 3, JSON.stringify(rebuilt));
    check("a colour change (a plain attribute) applies", rebuilt.green, JSON.stringify(rebuilt));
    check("the rebuilt mesh keeps its place", rebuilt.at == "1,2,3", JSON.stringify(rebuilt));
    check("rebuilding leaves no mesh or material behind", after.meshes == base.meshes && after.materials == base.materials,
        JSON.stringify({ base, after }));

    // A child element's mesh stays with its parent's new mesh.
    const child = await page.evaluate(async () => {
        const holder = document.getElementById("holder"), ball = document.getElementById("ball");
        holder.setAttribute("height", "2");
        await new Promise(r => setTimeout(r, 100));
        return { parent: ball.mesh.parent === holder.mesh, alive: !ball.mesh.isDisposed() };
    });
    check("a rebuilt parent keeps its child element's mesh", child.parent && child.alive, JSON.stringify(child));

    // A node a page or game hung on the mesh after the build (a character's model on an
    // invisible walking box, a carried light) moves onto the rebuilt mesh, not disposed with it.
    const hung = await page.evaluate(async () => {
        const box = document.getElementById("box"), scene = box.mesh.getScene();
        const model = box.mesh.clone("hung-model", box.mesh, true);
        model.element = undefined;
        const light = new (document.getElementById("lamp").light.constructor)("hung-light", box.mesh.position.clone(), scene);
        light.parent = box.mesh;
        box.setAttribute("height", "2");
        await new Promise(r => setTimeout(r, 100));
        const result = { model: !model.isDisposed() && model.parent === box.mesh, light: !light.isDisposed() && light.parent === box.mesh && scene.lights.includes(light) };
        model.dispose(); light.dispose();
        box.setAttribute("height", "1");
        await new Promise(r => setTimeout(r, 100));
        return result;
    });
    check("nodes hung on a mesh after its build move onto the rebuilt mesh", hung.model && hung.light, JSON.stringify(hung));

    // A behaviour changed: the old one stops, the new one runs.
    const track = await page.evaluate(async () => {
        const s = document.querySelector("garden-scene").scene, spinner = document.getElementById("spinner");
        const before = s.onBeforeRenderObservable.observers.length;
        spinner.setAttribute("track-step", "0.1");
        await new Promise(r => setTimeout(r, 100));
        spinner.setAttribute("track-step", "0.2");
        await new Promise(r => setTimeout(r, 100));
        const z1 = spinner.mesh.position.z;
        await new Promise(r => setTimeout(r, 200));
        return { before, after: s.onBeforeRenderObservable.observers.length, moving: spinner.mesh.position.z != z1 };
    });
    check("changing a behaviour doesn't stack another (and it still runs)", track.before > 0 && track.after == track.before && track.moving,
        JSON.stringify(track));

    // A child <garden-material>'s change reaches the mesh, and the old material goes.
    const material = await page.evaluate(async () => {
        const worn = document.getElementById("worn"), matEl = worn.querySelector("garden-material");
        await matEl.whenReady; await new Promise(r => setTimeout(r, 100));
        const old = worn.mesh.material;
        matEl.setAttribute("colour", "#ffff00");
        await new Promise(r => setTimeout(r, 200)); await matEl.whenReady;
        const c = worn.mesh.material.diffuseColor;
        return { swapped: worn.mesh.material === matEl.material && worn.mesh.material !== old,
            yellow: c.r > 0.9 && c.g > 0.9 && c.b < 0.1, oldGone: !document.querySelector("garden-scene").scene.materials.includes(old) };
    });
    check("a <garden-material> colour change reaches its mesh", material.swapped && material.yellow, JSON.stringify(material));
    check("…and its old material is disposed", material.oldGone, JSON.stringify(material));

    // A physics body is teleported, not rebuilt.
    const body = await page.evaluate(async () => {
        const el = document.getElementById("body");
        await new Promise(r => setTimeout(r, 300));
        const aggregate = el.physicsAggregate;
        el.setAttribute("position", "6 1 -6");
        await new Promise(r => setTimeout(r, 300));
        const p = el.mesh.getAbsolutePosition();
        return { has: !!aggregate, same: el.physicsAggregate === aggregate, at: [p.x, p.y, p.z].map(v => +v.toFixed(2)).join() };
    });
    check("a physics body is teleported by a position change", body.has && body.same && body.at == "6,1,-6", JSON.stringify(body));

    // Elements that change in place still do.
    const lamp = await page.evaluate(async () => {
        const el = document.getElementById("lamp"), light = el.light;
        el.setAttribute("intensity", "2.5");
        await new Promise(r => setTimeout(r, 100));
        return { same: el.light === light, intensity: el.light.intensity };
    });
    check("a light's intensity still changes in place", lamp.same && lamp.intensity == 2.5, JSON.stringify(lamp));

    // Trees, a camera and a house rebuild.
    const more = await page.evaluate(async () => {
        const s = document.querySelector("garden-scene").scene, $ = id => document.getElementById(id);
        const trees = $("trees");
        trees.setAttribute("count", "5");
        await new Promise(r => setTimeout(r, 300)); await trees.whenReady;
        const cam = $("cam"), camera = cam.camera;
        cam.setAttribute("position", "0 5 -10");
        await new Promise(r => setTimeout(r, 100));
        const movedSame = cam.camera === camera;
        cam.setAttribute("type", "free");
        await new Promise(r => setTimeout(r, 300));
        const house = $("house"), houseMesh = house.mesh;
        house.setAttribute("colour", "#884422");
        await new Promise(r => setTimeout(r, 500));
        return {
            trees: trees.trees.length, movedSame,
            camera: cam.camera !== camera && s.activeCamera === cam.camera && s.cameras.length == 1,
            house: !!house.mesh && house.mesh !== houseMesh && !house.mesh.isDisposed(),
        };
    });
    check("a trees count change replants them", more.trees == 5, JSON.stringify(more));
    check("a camera position change moves the same camera", more.movedSame, JSON.stringify(more));
    check("a camera type change builds a new one, still active, the old one gone", more.camera, JSON.stringify(more));
    check("a house rebuilds", more.house, JSON.stringify(more));

    // An orbiting mesh sits in its pivot's frame: a new position re-places the orbit.
    const orb = await page.evaluate(async () => {
        const el = document.getElementById("orb");
        el.setAttribute("position", "14 0.1 10");
        await new Promise(r => setTimeout(r, 500));
        const p = el.mesh.getAbsolutePosition();
        return { radius: +Math.hypot(p.x - 10, p.z - 10).toFixed(2), y: +p.y.toFixed(2) };
    });
    check("an orbiting mesh's new position keeps it orbiting at its new radius and height", orb.radius == 4 && orb.y == 0.1,
        JSON.stringify(orb));

    // Changed while it's out of the document (being moved): applied when it's back.
    const away = await page.evaluate(async () => {
        const sceneEl = document.querySelector("garden-scene"), box = document.getElementById("box");
        box.remove();
        box.setAttribute("position", "-1 0.5 -1");
        sceneEl.appendChild(box);
        await new Promise(r => setTimeout(r, 100));
        const p = box.mesh.position;
        return [p.x, p.y, p.z].join();
    });
    check("a change made mid-move applies once it's back", away == "-1,0.5,-1", away);
});
