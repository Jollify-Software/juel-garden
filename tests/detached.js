// Browser test of elements added and removed in the same task, before their first build ran
// (scripts that build a scene and then change their mind): no page error, nothing built into
// the scene, and the same element added back later builds as usual. Control: an element left
// in builds its mesh. Run after a build: node tests/detached.js.
const { run } = require("./harness");

const TAGS = ["garden-box", "garden-sphere", "garden-plane", "garden-line", "garden-mesh-model", "garden-rocks",
    "garden-trees", "garden-stone-wall", "garden-water", "garden-light", "garden-marker", "garden-sprite", "garden-text",
    "garden-waypoint"];

run(`<garden-scene><garden-camera type="arc"></garden-camera><garden-ground width="20" depth="20"></garden-ground></garden-scene>`,
async ({ page, check, errors, frames }) => {
    const settle = () => page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    for (const tag of TAGS) {
        const before = errors.length;
        const meshes = await page.evaluate(tag => {
            const e = document.createElement(tag);
            e.id = "gone-" + tag;
            if (tag == "garden-stone-wall") e.setAttribute("points", "0 0, 2 0");
            if (tag == "garden-line") e.setAttribute("points", "0 0 0, 1 1 1");
            if (tag == "garden-mesh-model") e.setAttribute("src", "/examples/assets/missing.glb");
            document.querySelector("garden-scene").appendChild(e);
            e.remove();
            return document.querySelector("garden-scene").scene.meshes.length;
        }, tag);
        await settle(); await frames(3);
        const after = await page.evaluate(() => document.querySelector("garden-scene").scene.meshes.length);
        check(`<${tag}> added and removed in one task: no page error, nothing built`, errors.length == before && after == meshes,
            `${meshes} → ${after} meshes ${errors.slice(before).join(" | ")}`);
    }

    // Added back, it builds; a box left in from the start builds too (the control).
    const back = await page.evaluate(async () => {
        const scene = document.querySelector("garden-scene");
        const kept = document.createElement("garden-box");
        scene.appendChild(kept);
        const box = document.createElement("garden-box");
        scene.appendChild(box);
        box.remove();
        await new Promise(r => setTimeout(r, 300));
        const removedMesh = !!box.mesh;
        scene.appendChild(box);
        await new Promise(r => setTimeout(r, 300));
        return { kept: !!kept.mesh && !kept.mesh.isDisposed(), removedMesh, readded: !!box.mesh && box.mesh.getScene() == scene.scene };
    });
    check("a box left in builds (control)", back.kept, JSON.stringify(back));
    check("a box removed before building has no mesh, and builds once added back", !back.removedMesh && back.readded, JSON.stringify(back));
});
