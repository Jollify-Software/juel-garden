// Browser test of <garden-material vertex fragment>: a ShaderMaterial from GLSL in a child
// <script>, a <script> by #id, or a URL; its uniforms read from the source and set by
// `uniform-<name>` attributes (live, without a rebuild) and setUniform(); `time` fed every frame;
// a <garden-material> child on a model dressing the model's parts. Pixels are read back to see
// the shaders draw. Run after a build: npm run test:shader-material.
const { run } = require("./harness");

run(`
<script type="x-shader/x-fragment" id="green-shader">
  precision highp float;
  void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }
</script>
<garden-scene>
  <garden-camera type="free" position="0 0 -10" target="0 0 0"></garden-camera>
  <garden-light type="hemi" position="0 1 0"></garden-light>
  <garden-box id="tinted" size="2" position="-3 0 0">
    <garden-material id="tint" uniform-strength="0.5" uniform-main-colour="#ff0000">
      <script type="x-shader/x-fragment">
        precision highp float;
        varying vec2 vUV;          // from the default vertex shader
        uniform vec3 mainColour;
        uniform float strength;
        uniform float time;
        void main() { gl_FragColor = vec4(mainColour * strength, 1.0); }
      </script>
    </garden-material>
  </garden-box>
  <garden-box id="by-id" size="2" position="0 0 0"><garden-material fragment="#green-shader"></garden-material></garden-box>
  <garden-box id="by-url" size="2" position="3 0 0">
    <garden-material fragment="/tests/fixtures/blue.frag">
      <script type="x-shader/x-vertex">
        precision highp float;
        attribute vec3 position;
        uniform mat4 worldViewProjection;
        void main() { gl_Position = worldViewProjection * vec4(position, 1.0); }
      </script>
    </garden-material>
  </garden-box>
  <garden-mesh-model id="model" src="/examples/assets/characters/Fox.glb" position="0 -20 0">
    <garden-material fragment="#green-shader"></garden-material>
  </garden-mesh-model>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => ["tint", "by-id", "by-url"].every(id => document.getElementById(id).material?.getClassName?.() == "ShaderMaterial"
        || document.querySelector("#" + id + " garden-material")?.material?.getClassName?.() == "ShaderMaterial"), null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector("garden-scene").scene.isReady());
    await frames(10);
    // The canvas pixel at fractions (fx, fy) from the top-left, read straight after a frame.
    const pixel = (fx, fy) => page.evaluate(([fx, fy]) => new Promise(resolve => {
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        scene.onAfterRenderObservable.addOnce(() => {
            const gl = engine._gl, out = new Uint8Array(4);
            gl.readPixels(Math.floor(engine.getRenderWidth() * fx), Math.floor(engine.getRenderHeight() * (1 - fy)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
            resolve(Array.from(out));
        });
    }), [fx, fy]);
    const near = (p, rgb) => rgb.every((c, i) => Math.abs(p[i] - c) < 12);

    const info = await page.evaluate(() => {
        const m = document.getElementById("tint");
        return { cls: m.material.getClassName(), uniforms: m.uniforms.map(u => u.name + ":" + u.type).sort(),
                 strength: m.material._floats.strength, colour: m.material._vectors3.mainColour?.asArray(),
                 bound: m.material.getBindedMeshes().map(x => x.id) };
    });
    check("a child <script type=\"x-shader/x-fragment\"> makes a ShaderMaterial on its mesh", info.cls == "ShaderMaterial" && info.bound.length == 1, JSON.stringify(info));
    check("its uniforms are read from the source (the default vertex shader's too)", JSON.stringify(info.uniforms) == '["mainColour:vec3","strength:float","time:float","world:mat4","worldViewProjection:mat4"]', JSON.stringify(info.uniforms));
    check("uniform-<name> sets them: a number, a #hex colour for a vec3 (uniform-main-colour is mainColour)",
        info.strength == 0.5 && JSON.stringify(info.colour) == "[1,0,0]", JSON.stringify(info));

    let left = await pixel(0.5 - 0.17, 0.5), mid = await pixel(0.5, 0.5), right = await pixel(0.5 + 0.17, 0.5);
    check("it draws: half red (strength 0.5)", near(left, [128, 0, 0]), JSON.stringify(left));
    check("fragment=\"#id\" takes a <script> in the page (green)", near(mid, [0, 255, 0]), JSON.stringify(mid));
    check("fragment=\"url\" loads one, with a child vertex shader (blue)", near(right, [0, 0, 255]), JSON.stringify(right));

    const t0 = await page.evaluate(() => document.getElementById("tint").material._floats.time);
    await frames(20);
    const t1 = await page.evaluate(() => document.getElementById("tint").material._floats.time);
    check("uniform float time counts seconds", t1 > t0 && t1 < 60, `${t0} -> ${t1}`);

    const before = await page.evaluate(() => { window.__tintMaterial = document.getElementById("tint").material; return true; });
    await page.evaluate(() => document.getElementById("tint").setAttribute("uniform-strength", "1"));
    await frames(3);
    left = await pixel(0.5 - 0.17, 0.5);
    const same = await page.evaluate(() => document.getElementById("tint").material == window.__tintMaterial);
    check("changing a uniform- attribute applies at once, on the same material", before && same && near(left, [255, 0, 0]), JSON.stringify(left));

    await page.evaluate(() => document.getElementById("tint").setUniform("mainColour", [0, 0, 1]));
    await frames(2);
    left = await pixel(0.5 - 0.17, 0.5);
    check("setUniform() from a game: numbers for a vec3", near(left, [0, 0, 255]), JSON.stringify(left));

    await page.evaluate(() => document.getElementById("tint").setAttribute("opacity", "0.5"));
    await page.waitForFunction(() => document.getElementById("tint").material != window.__tintMaterial && document.getElementById("tint").material?.needAlphaBlending?.());
    await frames(3);
    const rebuilt = await page.evaluate(() => {
        const m = document.getElementById("tint");
        return { blend: m.material.needAlphaBlending(), colour: m.material._vectors3.mainColour?.asArray(), on: document.getElementById("tinted").mesh.material == m.material };
    });
    check("any other change rebuilds it; the mesh wears the new one and setUniform values stay",
        rebuilt.blend && rebuilt.on && JSON.stringify(rebuilt.colour) == "[0,0,1]", JSON.stringify(rebuilt));

    await page.waitForFunction(() => document.getElementById("model").mesh, null, { timeout: 20000 });
    await frames(5);
    const model = await page.evaluate(() => {
        const el = document.getElementById("model"), mat = el.querySelector("garden-material").material;
        const parts = el.mesh.getChildMeshes().filter(m => m.getTotalVertices() > 0);
        return { parts: parts.length, dressed: parts.every(m => m.material == mat) };
    });
    check("a <garden-material> in a <garden-mesh-model> dresses every part", model.parts > 0 && model.dressed, JSON.stringify(model));
});
