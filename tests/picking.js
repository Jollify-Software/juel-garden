// Browser test of picking: <garden-scene>.pick()/pickRay() (meshes, a model's parts and
// pickable sprites, the nearest), garden-pick on pressing something, <garden-sprite>'s
// per-sprite cell and angle lists and `pickable`, <garden-action> on a DOM event
// (trigger="garden-pick" turning the sprite picked), the `ray` behaviour (rayHit,
// garden-ray-hit / garden-ray-miss, ray-show) and face-pointer / at-pointer.
// Run after a build: npm run test:picking.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" alpha="-1.5707963" beta="1.5707963" radius="10" target="0 0 0"></garden-camera>
  <garden-light></garden-light>
  <garden-sprite id="players" url="/examples/assets/dunes.png" width="32" height="32" count="1"
      positions="0 0 0, -2 0 0, 2 0 0" cell="0 3 5" angle="0 90" pickable>
    <garden-action trigger="garden-pick" type="increment" property="angle" value="0.5"></garden-action>
  </garden-sprite>
  <garden-box id="behind" size="3" position="0 0 4"></garden-box>
  <garden-element id="holder" parent position="0 -3 0"><garden-box id="part" size="1"></garden-box></garden-element>
  <garden-box id="turret" size="1" position="6 0 0" ray="0 0 1" ray-length="20" ray-show="#ff0000" face-pointer></garden-box>
  <garden-box id="target" size="1" position="6 0 5"></garden-box>
  <garden-sphere id="cursor" diameter="0.2" position="0 -10 0" at-pointer="0 0.1 0"></garden-sphere>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("players").sprites.length == 3 && document.getElementById("target").mesh);
    await frames(10);

    // The ray: straight ahead it meets #target; turned away, it misses.
    const ray = await page.evaluate(() => {
        const t = document.getElementById("turret");
        window.__ray = [];
        t.addEventListener("garden-ray-hit", e => __ray.push("hit " + e.detail.element.id));
        t.addEventListener("garden-ray-miss", e => __ray.push("miss " + e.detail.element.id));
        const scene = document.querySelector("garden-scene").scene;
        return { hit: t.rayHit?.element?.id, distance: t.rayHit && +t.rayHit.distance.toFixed(2),
            line: scene.meshes.some(m => m.name == "ray" && m.color?.toHexString() == "#FF0000") };
    });
    check("ray: rayHit is the first thing ahead (not itself)", ray.hit == "target" && ray.distance == 4.5, JSON.stringify(ray));
    check("ray-show draws the ray in its colour", ray.line, JSON.stringify(ray));

    const s = await page.evaluate(() => {
        const sp = document.getElementById("players").sprites;
        return { cells: sp.map(x => x.cellIndex), angles: sp.map(x => +x.angle.toFixed(3)), pickable: sp.every(x => x.isPickable) };
    });
    check("cell=\"0 3 5\" gives each sprite its own cell", s.cells.join() == "0,3,5", JSON.stringify(s));
    check("angle (degrees) is taken in turn", s.angles.join() == "0,1.571,0", JSON.stringify(s));
    check("pickable makes the sprites pickable", s.pickable, JSON.stringify(s));

    // The screen point of a world point, in page pixels.
    const screen = (x, y, z) => page.evaluate(([x, y, z]) => {
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        const p = BABYLON.Vector3.Project(new BABYLON.Vector3(x, y, z), BABYLON.Matrix.Identity(), scene.getTransformMatrix(),
            scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
        const r = engine.getRenderingCanvas().getBoundingClientRect(), k = r.width / engine.getRenderWidth();
        return { px: p.x, py: p.y, x: r.left + p.x * k, y: r.top + p.y * k };
    }, [x, y, z]);

    const left = await screen(-2, 0, 0), part = await screen(0, -3, 0);
    const picks = await page.evaluate(([a, b]) => {
        const sceneEl = document.querySelector("garden-scene");
        const sprite = sceneEl.pick(a.px, a.py), mesh = sceneEl.pick(b.px, b.py);
        const through = sceneEl.pick(a.px, a.py, { sprites: false });
        const ray = sceneEl.pickRay(new BABYLON.Vector3(0, 0, -5), new BABYLON.Vector3(0, 0, 1));
        const ignored = sceneEl.pickRay(new BABYLON.Vector3(0, 0, -5), new BABYLON.Vector3(0, 0, 1), 100, { ignore: "#players", sprites: true });
        return { sprite: sprite?.element?.id, index: sprite?.index, mesh: mesh?.element?.id, through: through?.element?.id ?? null,
            ray: ray?.element?.id, rayIndex: ray?.index, ignored: ignored?.element?.id, ignoredPoint: ignored && +ignored.point.z.toFixed(2) };
    }, [left, part]);
    check("pick() finds a sprite, and which one", picks.sprite == "players" && picks.index == 1, JSON.stringify(picks));
    check("pick() gives a part's element (a box inside a parent element)", picks.mesh == "part", JSON.stringify(picks));
    check("sprites: false looks past the sprites", picks.through == null, JSON.stringify(picks));
    check("pickRay() meets the nearest sprite first", picks.ray == "players" && picks.rayIndex == 0, JSON.stringify(picks));
    check("ignore leaves an element out", picks.ignored == "behind" && picks.ignoredPoint == 2.5, JSON.stringify(picks));

    // Pressing on the left sprite: garden-pick, and the action turns that sprite only.
    await page.evaluate(() => { window.__picks = []; document.querySelector("garden-scene").addEventListener("garden-pick", e => __picks.push([e.target.id, e.detail.index])); });
    await page.mouse.click(left.x, left.y);
    await frames(3);
    const after = await page.evaluate(() => ({ picks: __picks, angles: document.getElementById("players").sprites.map(x => +x.angle.toFixed(3)) }));
    check("pressing a sprite fires garden-pick with its index", JSON.stringify(after.picks) == JSON.stringify([["players", 1]]), JSON.stringify(after));
    check("<garden-action trigger=\"garden-pick\" type=\"increment\"> turns the sprite picked", after.angles.join() == "0,2.071,0", JSON.stringify(after));
    await page.mouse.click(part.x, part.y);
    await frames(3);
    const meshPick = await page.evaluate(() => __picks.at(-1));
    check("pressing a mesh fires garden-pick on its element", meshPick[0] == "part", JSON.stringify(meshPick));

    // face-pointer: the pointer over (0, 0, 4)'s box turns the turret to face it; it then misses.
    const behind = await screen(0, 1.4, 2.5);
    await page.mouse.move(behind.x, behind.y);
    await frames(3);
    const turned = await page.evaluate(() => {
        const t = document.getElementById("turret"), c = document.getElementById("cursor");
        const p = c.pointerHit?.point;
        return { yaw: +t.mesh.rotation.y.toFixed(2), want: p ? +Math.atan2(p.x - 6, p.z).toFixed(2) : null, hit: t.rayHit?.element?.id ?? null, events: __ray,
            cursor: c.mesh.position.asArray().map(v => +v.toFixed(1)), pointer: c.pointerHit?.element?.id };
    });
    check("face-pointer turns it about y to face the point", turned.want != null && Math.abs(turned.yaw - turned.want) < 0.02 && turned.yaw < -1, JSON.stringify(turned));
    check("turned away from #target: garden-ray-miss, then garden-ray-hit on what it meets now",
        turned.events[0] == "miss target" && turned.events.length <= 2, JSON.stringify(turned));
    check("at-pointer puts it where the pointer meets the scene (plus its offset)",
        turned.pointer == "behind" && Math.abs(turned.cursor[2] - 2.5) < 0.05 && turned.cursor[1] > 1, JSON.stringify(turned));
});
