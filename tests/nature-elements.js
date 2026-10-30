// Browser test of the nature elements, the markup side of src/Nature: <garden-water> (a still
// pool at its position and radius, with ripples, and a mirror only when `reflect` says, holding
// just what its selector names); <garden-rocks> (merged into one mesh, inside its area, sitting
// on its ground, the same for a seed and different for another); <garden-trees> (instances of a
// few hidden shapes, kept apart, standing on the ground, drawn); <garden-stone-wall> (a ring with
// its gateway where `gate` says, a wall along `points` following a slope, capstones sharing the
// wall's material); <garden-sky panorama> (one or two photographs cross-faded by `blend`, live,
// and by `duration`; tinted; hidden by fog; lit by <garden-lightning>); a water removed with an
// update still queued (no page error). Run after a build: node tests/nature-elements.js.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 30 -0.01"></garden-camera>
  <garden-light></garden-light>
  <garden-ground id="g" width="30" height="30"></garden-ground>
  <garden-box id="tower" position="0 2 8"></garden-box>
  <garden-box id="shed" position="6 1 8"></garden-box>
  <garden-water id="pond" position="2 0.05 -3" radius="4" colour="#203040" ripples="0.5"></garden-water>
  <garden-water id="lake" position="-8 0.05 5" radius="3" reflect="#tower"></garden-water>
  <garden-water id="mere" position="8 0.05 -8" radius="2" reflect></garden-water>
  <garden-water id="tarn" position="-12 0.05 -3" radius="1" reflect></garden-water>
  <garden-water id="ma" position="12 0.05 3" radius="1" reflect="#mb"></garden-water>
  <garden-water id="mb" position="14 0.05 3" radius="1" reflect="#ma"></garden-water>
  <garden-box id="hold" position="16 1 -6"></garden-box>
  <garden-water id="twice" position="16 0.05 -3" radius="1"></garden-water>
  <garden-rocks id="r1" position="-10 0 -10" width="6" depth="4" count="20" size="0.2 0.6" seed="3"></garden-rocks>
  <garden-rocks id="r2" position="-10 0 -10" width="6" depth="4" count="20" size="0.2 0.6" seed="3"></garden-rocks>
  <garden-rocks id="r3" position="-10 0 -10" width="6" depth="4" count="20" size="0.2 0.6" seed="4" colour="#aa4422"></garden-rocks>
  <garden-rocks id="r4" ground="#g" count="30" seed="2"></garden-rocks>
  <garden-rocks id="r5" position="10 0 10" count="0"></garden-rocks>
  <garden-box id="rhold" position="5 0 5" size="0.1" parent><garden-rocks id="r7" ground="#g" count="30" seed="2"></garden-rocks></garden-box>
  <garden-trees id="t1" ground="#g" count="12" spacing="3" seed="5" variants="2" size="1 1.2" bark-colour="#604020" leaf-colours="#336633 #447744"></garden-trees>
  <garden-trees id="t2" position="0 0 0" width="4" depth="4" count="50" spacing="3"></garden-trees>
  <garden-stone-wall id="w1" position="20 0 20" radius="5" gate="90" gate-width="1.5" height="1.2"></garden-stone-wall>
  <garden-stone-wall id="w2" position="20 0 -20" radius="3"></garden-stone-wall>
  <garden-stone-wall id="w3" position="-20 0 20" points="0 0 0, 6 0 0" cap-every="0" colour="#704030"></garden-stone-wall>
</garden-scene>`, async ({ page, check, errors }) => {
    await page.waitForFunction(() => document.querySelector("garden-scene").scene?.getFrameId() > 10, null, { timeout: 30000 });
    const water = await page.evaluate(async () => {
        const els = ["pond", "lake", "mere"].map(id => document.getElementById(id));
        await Promise.all(els.map(e => e.whenReady));
        const info = (el) => {
            const m = el.getNode(), b = m.getBoundingInfo().boundingBox, mat = m.material, r = mat.reflectionTexture;
            return { x: +m.position.x.toFixed(2), y: +m.position.y.toFixed(2), z: +m.position.z.toFixed(2),
                width: +(b.maximumWorld.x - b.minimumWorld.x).toFixed(2), flat: +(b.maximumWorld.y - b.minimumWorld.y).toFixed(3),
                colour: mat.diffuseColor.toHexString(), ripples: mat.bumpTexture?.level, mirror: !!r,
                list: r ? r.renderList.map(x => x.element?.id || x.name) : null };
        };
        const before = els.map(info);
        // Waters that reflect each other (both bare, or naming each other) mustn't wait on each other.
        const pairs = ["tarn", "ma", "mb"].map(id => document.getElementById(id));
        const paired = await Promise.race([Promise.all(pairs.map(e => e.whenReady)).then(() => pairs.map(info)), new Promise(r => setTimeout(() => r(null), 5000))]);
        // Turning the mirror on later, from code.
        els[0].setAttribute("reflect", "#shed");
        await new Promise(r => setTimeout(r, 300));
        await els[0].whenReady;
        // Changing `reflect` again while the first mirror is still waiting (on #hold).
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const twice = document.getElementById("twice"), hold = document.getElementById("hold");
        hold.beginBuild();
        twice.setAttribute("reflect", "#hold");
        await sleep(150);
        const first = twice.whenReady;
        twice.setAttribute("reflect", "#hold, #tower");
        await sleep(150);
        hold.endBuild();
        const again = await Promise.race([first.then(() => info(twice)), sleep(3000).then(() => null)]);
        const after = info(els[0]), same = els[0].getNode() == els[0].water.mesh;
        // Once the mirror is made: another selector remakes it, and removing `reflect` turns it off.
        const lake = els[1];
        lake.setAttribute("reflect", "#shed"); await sleep(300); await lake.whenReady;
        const changed = info(lake).list;
        lake.removeAttribute("reflect"); await sleep(300); await lake.whenReady;
        const off = info(lake).mirror;
        lake.setAttribute("reflect", "#tower"); await sleep(300); await lake.whenReady;
        const relit = info(lake).list, mirrors = lake.getScene().textures.filter(t => t.name == "water-mirror").length;
        return { before, paired, again, after, same, live: { changed, off, relit, mirrors } };
    });
    const [pond, lake, mere] = water.before;
    check("<garden-water> lies flat at its position, its radius across", pond.x == 2 && pond.y == 0.05 && pond.z == -3 && pond.width == 8 && pond.flat < 0.01, JSON.stringify(pond));
    check("…in its colour, with its ripples", pond.colour == "#203040" && pond.ripples == 0.5, JSON.stringify(pond));
    check("…and no mirror without `reflect`", !pond.mirror && pond.list == null, JSON.stringify(pond));
    check("reflect=\"#tower\" mirrors the tower only", lake.mirror && lake.list.length == 1 && lake.list[0] == "tower", JSON.stringify(lake));
    check("bare reflect mirrors the scene but the water itself", mere.mirror && mere.list.includes("tower") && mere.list.includes("shed") && !mere.list.includes("mere"), JSON.stringify(mere.list));
    check("waters reflecting each other, bare or by name, don't wait on each other for ever", water.paired && water.paired.every(w => w.mirror) && water.paired[0].list.includes("mere") && water.paired[1].list.join() == "mb" && water.paired[2].list.join() == "ma", JSON.stringify(water.paired?.map(w => w.list)));
    check("changing reflect while its mirror waits: the newer selector, and every whenReady resolves", water.again && water.again.list.sort().join() == "hold,tower", JSON.stringify(water.again));
    check("setting reflect from code turns the mirror on then", water.after.mirror && water.after.list.join() == "shed" && water.same, JSON.stringify(water.after));
    check("changing reflect after the mirror is made remakes it; removing it turns the mirror off", water.live.changed?.join() == "shed" && water.live.off === false && water.live.relit?.join() == "tower", JSON.stringify(water.live));

    // <garden-rocks>
    const rocks = await page.evaluate(async () => {
        const els = ["r1", "r2", "r3", "r4", "r5", "r7"].map(id => document.getElementById(id));
        await Promise.all(els.map(e => e.whenReady));
        const info = (el) => {
            const m = el.mesh; m.computeWorldMatrix(true);
            const b = m.getBoundingInfo().boundingBox;
            const p = m.getVerticesData("position");
            return { meshes: el.querySelectorAll("*").length, verts: m.getTotalVertices(), first: p ? +p[0].toFixed(4) : null,
                min: [b.minimumWorld.x, b.minimumWorld.y, b.minimumWorld.z].map(v => +v.toFixed(2)),
                max: [b.maximumWorld.x, b.maximumWorld.y, b.maximumWorld.z].map(v => +v.toFixed(2)),
                colour: m.material?.diffuseColor?.toHexString() };
        };
        const all = els.map(info);
        const merged = scene => scene.meshes.filter(m => m.name == "rock").length;
        return { all, loose: merged(document.querySelector("garden-scene").scene) };
    });
    const [r1, r2, r3, r4, r5, r7] = rocks.all;
    check("<garden-rocks> merges its rocks into one mesh, leaving none loose", r1.verts > 20 * 100 && rocks.loose == 0, JSON.stringify({ verts: r1.verts, loose: rocks.loose }));
    check("…inside its area (6 by 4 round -10 0 -10, give or take a rock)", r1.min[0] > -13.7 && r1.max[0] < -6.3 && r1.min[2] > -12.7 && r1.max[2] < -7.3 && r1.min[1] < 0 && r1.min[1] > -0.3, JSON.stringify(r1));
    check("…the same for the same seed, different for another", r1.first == r2.first && r1.first != r3.first, `${r1.first} ${r2.first} ${r3.first}`);
    check("…plain grey by default, `colour` when given", r1.colour == "#8A8580" && r3.colour == "#AA4422", `${r1.colour} ${r3.colour}`);
    check("ground=\"#g\" scatters over the whole ground", r4.min[0] < -10 && r4.max[0] > 10 && r4.min[2] < -10 && r4.max[2] > 10 && r4.max[0] < 16.5, JSON.stringify(r4));
    check("count=\"0\" gives no rocks, and no error", r5.verts == 0, JSON.stringify(r5));
    check("…and over the same ground from inside a moved `parent`-tagged element", r7.min.join() == r4.min.join() && r7.max.join() == r4.max.join(), JSON.stringify({ r4: [r4.min, r4.max], r7: [r7.min, r7.max] }));

    // On a slope: rocks on a sloped height map sit on it.
    const slope = await page.evaluate(async () => {
        const c = document.createElement("canvas"); c.width = c.height = 64;
        const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, "#000"); g.addColorStop(1, "#fff");
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        const hill = document.createElement("garden-height-map");
        hill.id = "hill"; hill.setAttribute("url", c.toDataURL("image/png"));
        hill.setAttribute("width", "20"); hill.setAttribute("height", "20"); hill.setAttribute("maxheight", "6"); hill.setAttribute("subdivisions", "40");
        hill.setAttribute("position", "40 0 0");
        const rocks = document.createElement("garden-rocks");
        rocks.id = "r6"; rocks.setAttribute("ground", "#hill"); rocks.setAttribute("count", "25"); rocks.setAttribute("size", "0.3 0.3");
        const sceneEl = document.querySelector("garden-scene");
        sceneEl.appendChild(hill); sceneEl.appendChild(rocks);
        await new Promise(r => setTimeout(r, 50));
        await hill.whenReady; await rocks.whenReady;
        // Each rock's lowest point against the ground under it: split the merged mesh's vertices by rock.
        const m = rocks.mesh; m.computeWorldMatrix(true);
        const p = m.getVerticesData("position"), per = p.length / 3 / 25, wm = m.getWorldMatrix();
        const gaps = [];
        for (let k = 0; k < 25; k++) {
            let low = null;
            for (let i = k * per; i < (k + 1) * per; i++) {
                const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), wm);
                if (!low || v.y < low.y) low = v;
            }
            gaps.push(+(low.y - hill.mesh.getHeightAtCoordinates(low.x, low.z)).toFixed(2));
        }
        return { gaps, span: [Math.min(...gaps), Math.max(...gaps)] };
    });
    check("on a sloped height map each rock sits on the ground under it", slope.span[0] > -0.35 && slope.span[1] < 0.15, JSON.stringify(slope.span));

    // <garden-trees>
    const trees = await page.evaluate(async () => {
        const t1 = document.getElementById("t1"), t2 = document.getElementById("t2");
        await t1.whenReady; await t2.whenReady;
        const scene = document.querySelector("garden-scene").scene;
        await new Promise(r => scene.onAfterRenderObservable.addOnce(() => r()));
        const active = new Set(scene.getActiveMeshes().data.filter(Boolean));
        const ground = document.getElementById("g").mesh;
        const pos = t1.trees.map(t => t.trunk.getAbsolutePosition());
        let closest = 99;
        for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) closest = Math.min(closest, Math.hypot(pos[i].x - pos[j].x, pos[i].z - pos[j].z));
        return {
            n1: t1.trees.length, n2: t2.trees.length, shapes: t1.shapes.length,
            instances: t1.trees.every(t => t.trunk.sourceMesh && t.leaves.sourceMesh && t1.shapes.some(s => s.trunk == t.trunk.sourceMesh)),
            hiddenShapes: t1.shapes.every(s => !s.trunk.isVisible && !s.leaves.isVisible),
            drawn: t1.trees.filter(t => active.has(t.trunk) || active.has(t.leaves)).length,
            closest: +closest.toFixed(2),
            onGround: Math.max(...pos.map(p => Math.abs(p.y - ground.getHeightAtCoordinates(p.x, p.z)))),
            inside: pos.every(p => Math.abs(p.x) <= 15 && Math.abs(p.z) <= 15),
            scales: t1.trees.map(t => t.trunk.scaling.x),
            bark: t1.shapes[0].trunk.material.diffuseColor.toHexString(), alphaTest: t1.shapes[0].leaves.material.transparencyMode,
        };
    });
    check("<garden-trees> plants `count` instances of its shapes, the shapes hidden", trees.n1 == 12 && trees.shapes == 2 && trees.instances && trees.hiddenShapes, JSON.stringify(trees));
    check("…and the trees themselves are drawn", trees.drawn > 0, `${trees.drawn} of ${trees.n1} in the active meshes`);
    check("…at least `spacing` apart, on the ground, within it, sized by `size`", trees.closest >= 3 && trees.onGround < 0.01 && trees.inside && trees.scales.every(s => s >= 1 && s <= 1.2), JSON.stringify(trees));
    check("…with its bark colour and cut-out leaves", trees.bark == "#604020" && trees.alphaTest == 1, `${trees.bark} ${trees.alphaTest}`);
    check("an area too small for `count` at `spacing` gets fewer trees, not crowded ones", trees.n2 > 0 && trees.n2 < 10, String(trees.n2));

    // <garden-stone-wall>
    const walls = await page.evaluate(async () => {
        const [w1, w2, w3] = ["w1", "w2", "w3"].map(id => document.getElementById(id));
        await Promise.all([w1, w2, w3].map(w => w.whenReady));
        // World-space vertices near the ring's line, in a narrow band in each direction.
        const near = (w, dx, dz) => {
            const m = w.mesh; m.computeWorldMatrix(true);
            const p = m.getVerticesData("position"), wm = m.getWorldMatrix(), c = m.getAbsolutePosition();
            let n = 0;
            for (let i = 0; i < p.length; i += 3) {
                const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(p[i], p[i + 1], p[i + 2]), wm);
                const x = v.x - c.x, z = v.z - c.z;
                if (Math.abs(dx ? z : x) < 0.5 && (dx ? x * dx : z * dz) > 3) n++;
            }
            return n;
        };
        const b1 = w1.mesh.getBoundingInfo().boundingBox, b3 = w3.mesh.getBoundingInfo().boundingBox;
        // A wall on a slope: added now on a sloped height map.
        const c = document.createElement("canvas"); c.width = c.height = 64;
        const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, "#000"); g.addColorStop(1, "#fff");
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        const sceneEl = document.querySelector("garden-scene");
        const hill = document.createElement("garden-height-map");
        hill.id = "hill2"; hill.setAttribute("url", c.toDataURL("image/png"));
        for (const [k, v] of [["width", "20"], ["height", "20"], ["maxheight", "6"], ["subdivisions", "40"], ["position", "0 0 60"]]) hill.setAttribute(k, v);
        const w4 = document.createElement("garden-stone-wall");
        w4.id = "w4"; w4.setAttribute("ground", "#hill2"); w4.setAttribute("points", "-8 0 60, 8 0 60"); w4.setAttribute("cap-every", "0");
        // The same wall turned 45 degrees (`rotation` turns it after it's built, so it must sample the ground turned).
        const w5 = document.createElement("garden-stone-wall");
        w5.id = "w5"; w5.setAttribute("ground", "#hill2"); w5.setAttribute("position", "0 0 60"); w5.setAttribute("points", "-6 0 0, 6 0 0");
        w5.setAttribute("rotation", "0 45 0"); w5.setAttribute("cap-every", "0");
        // A wall with its own `rotation` inside a turned element: the parent's turn is added to it, so it must sample with that too.
        const turner = document.createElement("garden-box");
        turner.setAttribute("size", "0.1"); turner.setAttribute("position", "0 -5 0"); turner.setAttribute("rotation", "0 90 0");
        const w6 = document.createElement("garden-stone-wall");
        w6.id = "w6"; w6.setAttribute("ground", "#hill2"); w6.setAttribute("position", "0 5 60"); w6.setAttribute("points", "-6 0 0, 6 0 0");
        w6.setAttribute("rotation", "0 0 0"); w6.setAttribute("cap-every", "0");
        turner.appendChild(w6);
        // A wall inside a moved, turned `parent`-tagged element: its mesh is really parented there, so it must sample in the parent's frame.
        const holder = document.createElement("garden-box");
        holder.setAttribute("size", "0.1"); holder.setAttribute("position", "2 0 60"); holder.setAttribute("rotation", "0 45 0"); holder.setAttribute("parent", "");
        const w7 = document.createElement("garden-stone-wall");
        w7.id = "w7"; w7.setAttribute("ground", "#hill2"); w7.setAttribute("points", "-4 0 0, 4 0 0"); w7.setAttribute("cap-every", "0");
        holder.appendChild(w7);
        sceneEl.appendChild(hill); sceneEl.appendChild(w4); sceneEl.appendChild(w5); sceneEl.appendChild(turner); sceneEl.appendChild(holder);
        await new Promise(r => setTimeout(r, 50));
        await hill.whenReady; await w4.whenReady; await w5.whenReady; await turner.whenReady; await w6.whenReady; await holder.whenReady; await w7.whenReady;
        const m7 = w7.mesh; m7.computeWorldMatrix(true);
        const p7 = m7.getVerticesData("position"), wm7 = m7.getWorldMatrix();
        let worst7 = 0;
        for (let i = 0; i < p7.length; i += 3) {
            if (Math.abs(p7[i]) > 3.5) continue;
            const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(p7[i], p7[i + 1], p7[i + 2]), wm7);
            const above = v.y - hill.mesh.getHeightAtCoordinates(v.x, v.z);
            worst7 = Math.max(worst7, Math.min(Math.abs(above + 0.05), Math.abs(above - 1.0)));
        }
        const m6 = w6.mesh; m6.computeWorldMatrix(true);
        const p6 = m6.getVerticesData("position"), wm6 = m6.getWorldMatrix();
        let worst6 = 0;
        for (let i = 0; i < p6.length; i += 3) {
            if (Math.abs(p6[i]) > 5.5) continue;
            const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(p6[i], p6[i + 1], p6[i + 2]), wm6);
            const above = v.y - hill.mesh.getHeightAtCoordinates(v.x, v.z);
            worst6 = Math.max(worst6, Math.min(Math.abs(above + 0.05), Math.abs(above - 1.0)));
        }
        const m5 = w5.mesh; m5.computeWorldMatrix(true);
        const p5 = m5.getVerticesData("position"), wm5 = m5.getWorldMatrix();
        let worst5 = 0;
        for (let i = 0; i < p5.length; i += 3) {
            if (Math.abs(p5[i]) > 5.5) continue;
            const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(p5[i], p5[i + 1], p5[i + 2]), wm5);
            const above = v.y - hill.mesh.getHeightAtCoordinates(v.x, v.z);
            worst5 = Math.max(worst5, Math.min(Math.abs(above + 0.05), Math.abs(above - 1.0)));
        }
        const m4 = w4.mesh; m4.computeWorldMatrix(true);
        const p4 = m4.getVerticesData("position"), wm4 = m4.getWorldMatrix();
        let worst = 0;
        for (let i = 0; i < p4.length; i += 3) {
            const v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(p4[i], p4[i + 1], p4[i + 2]), wm4);
            if (Math.abs(v.x) > 7.5) continue;
            const h = hill.mesh.getHeightAtCoordinates(v.x, v.z), above = v.y - h;
            // Every vertex is at the foot (just below the ground) or the top (a wall's height above).
            worst = Math.max(worst, Math.min(Math.abs(above + 0.05), Math.abs(above - 1.0)));
        }
        return {
            gateX: near(w1, 1, 0), otherSides: [near(w1, -1, 0), near(w1, 0, 1), near(w1, 0, -1)], ringW2: [near(w2, 1, 0) + near(w2, -1, 0), near(w2, 0, 1)],
            top1: +b1.maximumWorld.y.toFixed(2), capsTop: +(w1.caps.computeWorldMatrix(true), w1.caps.getBoundingInfo().boundingBox.maximumWorld.y).toFixed(2), caps1: !!w1.caps && w1.caps.parent == w1.mesh && w1.caps.material == w1.mesh.material,
            len3: +(b3.maximumWorld.x - b3.minimumWorld.x).toFixed(2), caps3: w3.caps, colour3: w3.mesh.material.diffuseColor.toHexString(),
            rise: +(m4.getBoundingInfo().boundingBox.maximumWorld.y - m4.getBoundingInfo().boundingBox.minimumWorld.y).toFixed(2), worst: +worst.toFixed(2),
            turned: +(m5.getBoundingInfo().boundingBox.maximumWorld.y - m5.getBoundingInfo().boundingBox.minimumWorld.y).toFixed(2), worst5: +worst5.toFixed(2),
            turn6: +m6.rotation.y.toFixed(2), worst6: +worst6.toFixed(2), y6: +m6.getAbsolutePosition().y.toFixed(2),
            parent7: m7.parent == holder.mesh, worst7: +worst7.toFixed(2),
        };
    });
    check("<garden-stone-wall radius gate=\"90\"> leaves its gateway open at +x, and only there", walls.gateX == 0 && walls.otherSides.every(n => n > 0), JSON.stringify(walls));
    check("…stands its height (sunk 5 cm), with capstones on top sharing its material", walls.top1 == 1.15 && walls.capsTop > 1.2 && walls.capsTop < 1.9 && walls.caps1, JSON.stringify(walls));
    check("without `gate` a ring is closed", walls.ringW2.every(n => n > 0) && walls.ringW2[0] > 0, JSON.stringify(walls.ringW2));
    check("`points` gives a wall along them, `cap-every=\"0\"` no capstones, `colour` its colour", walls.len3 > 5.9 && walls.len3 < 6.4 && walls.caps3 == null && walls.colour3 == "#704030", JSON.stringify(walls));
    check("with `ground` the wall follows a slope, its foot and top keeping to the ground", walls.rise > 4 && walls.worst < 0.25, JSON.stringify({ rise: walls.rise, worst: walls.worst }));
    check("…and still does when `rotation` turns it", walls.turned > 2.5 && walls.worst5 < 0.25, JSON.stringify({ turned: walls.turned, worst: walls.worst5 }));
    check("…and when a turned parent element adds its turn", walls.turn6 == 1.57 && walls.worst6 < 0.25, JSON.stringify({ turn: walls.turn6, worst: walls.worst6 }));
    check("…and its position, as any mesh element's does (parent at y -5, wall at 5: 0)", walls.y6 == 0, JSON.stringify({ y: walls.y6 }));
    check("…and inside a moved, turned `parent`-tagged element", walls.parent7 && walls.worst7 < 0.25, JSON.stringify({ parented: walls.parent7, worst: walls.worst7 }));

    // <garden-sky panorama>
    const sky = await page.evaluate(async () => {
        const wide = (colour) => { const c = document.createElement("canvas"); c.width = 64; c.height = 32; const x = c.getContext("2d"); x.fillStyle = colour; x.fillRect(0, 0, 64, 32); return c.toDataURL("image/png"); };
        const sceneEl = document.querySelector("garden-scene"), scene = sceneEl.scene;
        const step = () => new Promise(r => setTimeout(r, 150));
        const add = (attrs) => { const el = document.createElement("garden-sky"); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); sceneEl.appendChild(el); return el; };
        const one = add({ id: "sky1", panorama: wide("#556"), tint: "#808090" });
        await step();
        const vis = (el) => el.panoramaSky.domes.map(d => +d.mesh.visibility.toFixed(2));
        const single = { domes: one.panoramaSky.domes.length, vis: vis(one), tint: one.panoramaSky.domes[0].material.emissiveColor.toHexString(), mesh: one.mesh == one.panoramaSky.domes[0].mesh };
        one.panoramaSky.dispose();
        const two = add({ id: "sky2", panorama: wide("#556"), tint: "#404040", "panorama-to": wide("#d96") });
        await step();
        const start = vis(two);
        two.setAttribute("blend", "1"); await step();
        const end = vis(two);
        two.setAttribute("blend", "0.5"); await step();
        const half = vis(two);
        await two.blendTo(0, 0.3); await step();
        const back = vis(two);
        const unlit = two.panoramaSky.domes[0].material.emissiveColor.r;
        // <garden-lightning> striking lights the first panorama up.
        const bolt = document.createElement("garden-lightning"); bolt.setAttribute("interval", "1000 2000"); sceneEl.appendChild(bolt);
        await step();
        bolt.strike?.(); await step();
        const flashed = two.panoramaSky.domes[0].material.emissiveColor.r;
        // Thick fog hides it.
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.2; scene.fogColor = new BABYLON.Color3(0.4, 0.3, 0.2);
        await step();
        const fogged = vis(two);
        scene.fogMode = 0;
        two.panoramaSky.dispose();
        // `duration` cross-fades once it's built.
        const timed = add({ id: "sky3", panorama: wide("#556"), "panorama-to": wide("#d96"), duration: "0.4" });
        await step();
        const during = timed.panoramaSky.blend;
        await new Promise(r => setTimeout(r, 600));
        const after = timed.panoramaSky.blend;
        timed.panoramaSky.dispose();
        // Removing the element takes both domes with it.
        const gone = add({ id: "sky4", panorama: wide("#556"), "panorama-to": wide("#d96") });
        await step();
        const goneDomes = gone.panoramaSky.domes.map(d => d.mesh);
        const keptBefore = goneDomes.map(m => m.isDisposed());
        gone.remove(); await step();
        const removed = { before: keptBefore, after: goneDomes.map(m => m.isDisposed()), skyGone: gone.panoramaSky == null };
        return { single, start, end, half, back, unlit, flashed, fogged, strike: typeof bolt.strike, during: +during.toFixed(2), after, removed };
    });
    // Each panorama build listens on the scene for `garden-lightning`; a rebuild or removal takes it back.
    const cdp = await page.context().newCDPSession(page);
    const flashListeners = async () => {
        const { result } = await cdp.send("Runtime.evaluate", { expression: "document.querySelector('garden-scene')" });
        const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId });
        return listeners.filter(l => l.type == "garden-lightning").length;
    };
    const skyBase = await flashListeners();
    await page.evaluate(() => { const el = document.createElement("garden-sky"); el.id = "sky5"; const c = document.createElement("canvas"); c.width = 64; c.height = 32; el.setAttribute("panorama", c.toDataURL("image/png")); document.querySelector("garden-scene").appendChild(el); });
    await page.waitForTimeout(300);
    const skyAdded = await flashListeners();
    for (const tint of ["#808080", "#909090"]) {
        await page.evaluate(t => document.getElementById("sky5").setAttribute("tint", t), tint);
        await page.waitForTimeout(300);
    }
    const skyChanged = await flashListeners();
    await page.evaluate(() => document.getElementById("sky5").remove());
    await page.waitForTimeout(300);
    const skyRemoved = await flashListeners();
    check("<garden-sky panorama>: one lightning listener per sky, through rebuilds; none after removal", skyAdded == skyBase + 1 && skyChanged == skyAdded && skyRemoved == skyBase,
        `listeners ${skyBase} -> ${skyAdded} added -> ${skyChanged} after two changes -> ${skyRemoved} removed`);
    check("<garden-sky panorama> puts one photograph on a dome, tinted", sky.single.domes == 1 && sky.single.vis[0] == 1 && sky.single.tint == "#808090" && sky.single.mesh, JSON.stringify(sky.single));
    check("panorama-to adds a second; `blend` cross-fades them, live", sky.start.join() == "1,0" && sky.end.join() == "0,1" && sky.half.join() == "0.5,0.5", JSON.stringify(sky));
    check("blendTo() fades back from code", sky.back.join() == "1,0", JSON.stringify(sky.back));
    check("<garden-lightning> striking lights the first panorama up", sky.strike == "function" && sky.unlit < 0.3 && sky.flashed > sky.unlit + 0.15, `${sky.strike} ${sky.unlit} → ${sky.flashed}`);
    check("thick fog hides the photographed sky", sky.fogged.every(v => v == 0), JSON.stringify(sky.fogged));
    check("`duration` cross-fades once the sky is built", sky.during > 0 && sky.during < 1 && sky.after == 1, JSON.stringify({ during: sky.during, after: sky.after }));
    check("removing a panorama <garden-sky> disposes both domes", sky.removed.before.join() == "false,false" && sky.removed.after.join() == "true,true" && sky.removed.skyGone, JSON.stringify(sky.removed));

    // A water given `reflect` and removed in the same task: its queued update runs with no parent.
    const errorsBefore = errors.length;
    const detached = await page.evaluate(async () => {
        const w = document.createElement("garden-water");
        w.setAttribute("radius", "1");
        document.querySelector("garden-scene").appendChild(w);
        await new Promise(r => setTimeout(r, 200));
        const built = !!w.water;
        w.setAttribute("reflect", "");
        w.remove();
        await new Promise(r => setTimeout(r, 200));
        return { built, water: w.water };
    });
    check("a <garden-water> removed with an update queued goes quietly", detached.built && detached.water == null && errors.length == errorsBefore,
        JSON.stringify(detached) + " " + errors.slice(errorsBefore).join(" | "));
});
