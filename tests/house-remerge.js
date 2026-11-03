// Browser test: changing an attribute on an element inside a <garden-house> or
// <garden-semi-house> (the box or the roof the house merges) rebuilds the merged house, instead
// of leaving the merged mesh as it was and a loose copy of the child beside it. Run after a build.
const { run } = require("./harness");

run(`<garden-scene>
    <garden-camera type="arc" position="0 2 -6"></garden-camera>
    <garden-light type="hemi"></garden-light>
    <garden-house id="house" position="-2 0 0"></garden-house>
    <garden-semi-house id="semi" position="2 0 0"></garden-semi-house>
</garden-scene>`, async ({ page, check, frames }) => {
    await frames(20);
    const read = () => page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        const out = { meshes: scene.meshes.filter(m => !m.isDisposed()).length };
        for (const id of ["house", "semi"]) {
            const mesh = document.getElementById(id).mesh;
            const { min, max } = mesh.getHierarchyBoundingVectors(true);
            out[id] = { disposed: mesh.isDisposed(), width: +(max.x - min.x).toFixed(2), uid: mesh.uniqueId };
        }
        return out;
    });
    const before = await read();
    await page.evaluate(() => {
        document.querySelector("#house > garden-box").setAttribute("width", "3");
        document.querySelector("#semi > garden-box").setAttribute("width", "4");
    });
    await frames(20);
    const after = await read();
    const info = JSON.stringify({ before, after });
    check("house: a change inside rebuilds the merged mesh (a new mesh, wider)",
        !after.house.disposed && after.house.uid != before.house.uid && after.house.width > before.house.width + 1, info);
    check("semi-house: a change inside rebuilds the merged mesh (a new mesh, wider)",
        !after.semi.disposed && after.semi.uid != before.semi.uid && after.semi.width > before.semi.width + 1, info);
    check("no loose copies: the scene has as many meshes as before", after.meshes == before.meshes, info);
    await frames(30);
    const later = await read();
    check("the rebuild settles (no rebuild loop: the same mesh 30 frames on)",
        later.house.uid == after.house.uid && later.semi.uid == after.semi.uid, JSON.stringify(later));
    // A transform-only change of the roof (moved in place on a mesh of its own) re-merges too.
    await page.evaluate(() => document.querySelector("#house garden-cylinder").setAttribute("position", "0 2 0"));
    await frames(20);
    const moved = await page.evaluate(() => {
        const mesh = document.getElementById("house").mesh;
        const { max } = mesh.getHierarchyBoundingVectors(true);
        return { uid: mesh.uniqueId, top: +max.y.toFixed(2), meshes: document.querySelector("garden-scene").scene.meshes.length };
    });
    check("a roof moved in place: the house re-merges with the roof higher, no loose copy",
        moved.uid != later.house.uid && moved.top > 2 && moved.meshes == before.meshes, JSON.stringify(moved));
});
