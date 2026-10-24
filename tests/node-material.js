// Browser test of <garden-material node>: a node material from a JSON file (here
// Babylon's default node material, serialised in the page) on a mesh, its opacity,
// input-<name> setting an input block, a <garden-texture block> filling a texture block,
// and a bad URL warning instead of throwing; and <garden-node-geometry> (a box graph
// made in the page) with an input-<name>. Run after a build: npm run test:node-material.
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
        const scene = document.querySelector("garden-scene").scene;
        // A minimal graph made here: position through world and view-projection to the
        // vertex output; a colour input times a texture block to the fragment output.
        const nm = new BABYLON.NodeMaterial("made-here", scene);
        const position = new BABYLON.InputBlock("position"); position.setAsAttribute("position");
        const world = new BABYLON.InputBlock("world"); world.setAsSystemValue(BABYLON.NodeMaterialSystemValues.World);
        const viewProjection = new BABYLON.InputBlock("viewProjection"); viewProjection.setAsSystemValue(BABYLON.NodeMaterialSystemValues.ViewProjection);
        const toWorld = new BABYLON.TransformBlock("toWorld"); toWorld.complementZ = 0; toWorld.complementW = 1;
        position.output.connectTo(toWorld.vector); world.output.connectTo(toWorld.transform);
        const toClip = new BABYLON.TransformBlock("toClip");
        toWorld.output.connectTo(toClip.vector); viewProjection.output.connectTo(toClip.transform);
        const vertexOut = new BABYLON.VertexOutputBlock("vertexOut"); toClip.output.connectTo(vertexOut.vector);
        const uv = new BABYLON.InputBlock("uv"); uv.setAsAttribute("uv");
        const tex = new BABYLON.TextureBlock("tex"); uv.output.connectTo(tex.uv);
        const colour = new BABYLON.InputBlock("tint"); colour.value = new BABYLON.Color4(1, 1, 1, 1);
        const times = new BABYLON.MultiplyBlock("times"); tex.rgba.connectTo(times.left); colour.output.connectTo(times.right);
        const fragmentOut = new BABYLON.FragmentOutputBlock("fragmentOut"); times.output.connectTo(fragmentOut.rgba);
        nm.addOutputNode(vertexOut); nm.addOutputNode(fragmentOut);
        nm.build();
        const url = URL.createObjectURL(new Blob([JSON.stringify(nm.serialize())], { type: "application/json" }));
        nm.dispose();
        // A node geometry: a box whose size is an input block.
        const ng = new BABYLON.NodeGeometry("made-here");
        const size = new BABYLON.GeometryInputBlock("boxSize", BABYLON.NodeGeometryBlockConnectionPointTypes.Float);
        size.value = 1;
        const box = new BABYLON.BoxBlock("box");
        size.output.connectTo(box.size);
        const out = new BABYLON.GeometryOutputBlock("out");
        box.geometry.connectTo(out.geometry);
        ng.outputBlock = out;
        ng.build(); // registers its blocks, which serialize() writes
        window.__geometryUrl = URL.createObjectURL(new Blob([JSON.stringify(ng.serialize())], { type: "application/json" }));
        const pixel = document.createElement("canvas"); pixel.width = pixel.height = 1;
        pixel.getContext("2d").fillStyle = "#ff0000"; pixel.getContext("2d").fillRect(0, 0, 1, 1);
        window.__redUrl = pixel.toDataURL();
        const add = (id, attrs) => {
            const box = document.createElement("garden-box");
            box.id = id; box.setAttribute("position", id == "noded" ? "2 0 0" : "-2 0 0");
            const mat = document.createElement("garden-material");
            for (const [k, v] of Object.entries(attrs)) mat.setAttribute(k, v);
            box.appendChild(mat);
            document.querySelector("garden-scene").appendChild(box);
        };
        add("noded", { node: url, opacity: "0.5", "input-tint": "0 1 0 1" });
        const t = document.createElement("garden-texture");
        t.setAttribute("block", "tex"); t.setAttribute("src", window.__redUrl);
        document.querySelector("#noded garden-material").appendChild(t);
        const g = document.createElement("garden-node-geometry");
        g.id = "made"; g.setAttribute("src", window.__geometryUrl); g.setAttribute("input-boxsize", "4"); g.setAttribute("position", "0 3 0");
        document.querySelector("garden-scene").appendChild(g);
        add("broken", { node: "/no-such-material.json" });
    });
    await page.waitForFunction(() => document.getElementById("noded").mesh?.material?.getClassName() == "NodeMaterial" && document.getElementById("made")?.mesh, null, { timeout: 15000 })
        .catch(async e => { console.log("waiting:", JSON.stringify(warnings), await page.evaluate(() => ({ noded: document.getElementById("noded")?.mesh?.material?.getClassName(), made: !!document.getElementById("made")?.mesh }))); throw e; });
    await frames(10);
    const r = await page.evaluate(() => {
        const m = document.getElementById("noded").mesh.material;
        const made = document.getElementById("made").mesh;
        return { cls: m.getClassName(), alpha: m.alpha, ready: m.isReady(document.getElementById("noded").mesh),
                 colour: m.getBlockByName("tint")?.value?.asArray?.(), tex: !!m.getBlockByName("tex")?.texture,
                 made: made ? +made.getBoundingInfo().boundingBox.extendSize.x.toFixed(2) * 2 : null,
                 broken: document.getElementById("broken").mesh?.material?.getClassName() ?? null };
    });
    check("node=\"<json url>\": a NodeMaterial on the mesh", r.cls == "NodeMaterial" && r.ready, JSON.stringify(r));
    check("…with its opacity", r.alpha == 0.5, String(r.alpha));
    check("input-tint sets its colour input block", JSON.stringify(r.colour) == "[0,1,0,1]", JSON.stringify(r.colour));
    check("<garden-texture block=\"tex\"> fills the texture block", r.tex, JSON.stringify(r));
    check("<garden-node-geometry> builds its mesh, with input-boxsize=\"4\"", r.made == 4, String(r.made));
    check("a node material that won't load warns, and the mesh keeps its own", warnings.some(w => w.includes("no-such-material")) && r.broken != "NodeMaterial", JSON.stringify({ warnings, broken: r.broken }));
});
