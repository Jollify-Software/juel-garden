// Browser test of <garden-material node>: a node material from a JSON file (here
// Babylon's default node material, serialised in the page) on a mesh, its opacity, and
// a bad URL warning instead of throwing. Run after a build: npm run test:node-material.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" radius="6"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="plain"></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("plain").mesh);
    const warnings = [];
    page.on("console", m => { if (m.type() == "warning") warnings.push(m.text()); });
    await page.evaluate(() => {
        const nm = new BABYLON.NodeMaterial("made-here", document.querySelector("garden-scene").scene);
        nm.setToDefault();
        const url = URL.createObjectURL(new Blob([JSON.stringify(nm.serialize())], { type: "application/json" }));
        nm.dispose();
        const add = (id, attrs) => {
            const box = document.createElement("garden-box");
            box.id = id; box.setAttribute("position", id == "noded" ? "2 0 0" : "-2 0 0");
            const mat = document.createElement("garden-material");
            for (const [k, v] of Object.entries(attrs)) mat.setAttribute(k, v);
            box.appendChild(mat);
            document.querySelector("garden-scene").appendChild(box);
        };
        add("noded", { node: url, opacity: "0.5" });
        add("broken", { node: "/no-such-material.json" });
    });
    await page.waitForFunction(() => document.getElementById("noded").mesh?.material?.getClassName() == "NodeMaterial", null, { timeout: 15000 });
    await frames(10);
    const r = await page.evaluate(() => {
        const m = document.getElementById("noded").mesh.material;
        return { cls: m.getClassName(), alpha: m.alpha, ready: m.isReady(document.getElementById("noded").mesh),
                 broken: document.getElementById("broken").mesh?.material?.getClassName() ?? null };
    });
    check("node=\"<json url>\": a NodeMaterial on the mesh", r.cls == "NodeMaterial" && r.ready, JSON.stringify(r));
    check("…with its opacity", r.alpha == 0.5, String(r.alpha));
    check("a node material that won't load warns, and the mesh keeps its own", warnings.some(w => w.includes("no-such-material")) && r.broken != "NodeMaterial", JSON.stringify({ warnings, broken: r.broken }));
});
