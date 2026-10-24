// Browser test of texture="html" (src/HtmlTexture.ts): the texture is sized from html-size and
// html-resolution (a power of two), the page's CSS styles the content, html-background="transparent"
// leaves rounded corners see-through, html-unlit turns the lights off, a change to the content or
// renderHtml() draws it again, a rebuild keeps it, and removing the mesh puts the content back.
// Run after a build: npm run test:html-texture.
const { run } = require("./harness");

const html = `
<style>
  .card { box-sizing: border-box; width: 100%; height: 100%; padding: 40px; border-radius: 80px;
          background: rgb(22, 50, 79); font: 40px/1.2 sans-serif; }
  .card h1 { margin: 0; height: 200px; background: rgb(255, 0, 0); color: white; }
</style>
<garden-scene>
  <garden-camera type="free" position="0 1.5 -4"></garden-camera>
  <garden-light></garden-light>
  <garden-plane id="panel" width="3" height="2" position="0 1.5 0" texture="html"
      html-size="960 640" html-resolution="1.5" html-background="transparent" html-unlit>
    <div class="card"><h1>Title</h1><p>Body text</p></div>
  </garden-plane>
  <garden-plane id="plain" width="2" height="1" position="3 1.5 0" texture="html"><h2>Hello</h2></garden-plane>
</garden-scene>`;

run(html, async ({ page, check }) => {
    const rendered = id => page.waitForFunction(id => {
        const t = document.getElementById(id).mesh?.material?.diffuseTexture;
        return t && t.getSize().width > 4;
    }, id, { timeout: 20000 });
    await rendered("panel");
    await rendered("plain");

    // A pixel of #panel's texture at (fx, fy), fractions of its width and height from the top-left.
    const pixel = (fx, fy, id = "panel") => page.evaluate(({ fx, fy, id }) => {
        const t = document.getElementById(id).mesh.material.diffuseTexture;
        const { width, height } = t.getSize();
        return Array.from(t.getContext().getImageData(Math.floor(fx * width), Math.floor(fy * height), 1, 1).data);
    }, { fx, fy, id });

    const info = await page.evaluate(() => {
        const el = document.getElementById("panel");
        const m = el.mesh.material, t = m.diffuseTexture;
        const host = document.querySelector(".garden-html-host .card")?.parentElement;
        return {
            size: t.getSize(), hasAlpha: t.hasAlpha, alphaFromTexture: m.useAlphaFromDiffuseTexture,
            unlit: m.disableLighting, mips: !t.noMipmap, plainUnlit: document.getElementById("plain").mesh.material.disableLighting,
            childInScene: !!el.querySelector(".card"), hostInBody: host?.parentElement == document.body,
            canvasTop: document.querySelector("garden-scene canvas").getBoundingClientRect().top,
            plainSize: document.getElementById("plain").mesh.material.diffuseTexture.getSize(),
        };
    });
    check("html-size 960x640 at 1.5 -> a 2048x1024 texture", info.size.width == 2048 && info.size.height == 1024, JSON.stringify(info.size));
    check("mipmaps on", info.mips);
    check("no html-size: sized from the content, a power of two", [info.plainSize.width, info.plainSize.height].every(n => n > 4 && (n & (n - 1)) == 0), JSON.stringify(info.plainSize));
    check("content moved to a host in <body>, not left in the scene", !info.childInScene && info.hostInBody);
    check("the scene's canvas isn't pushed down", info.canvasTop == 0, String(info.canvasTop));
    check("transparent: texture has alpha, material blends it", info.hasAlpha && info.alphaFromTexture);
    check("html-unlit: lighting off; not on the plain one", info.unlit === true && !info.plainUnlit);

    const corner = await pixel(0.005, 0.01);
    check("rounded corner is see-through", corner[3] == 0, JSON.stringify(corner));
    const heading = await pixel(0.5, 0.2);
    check("page CSS styles the content (h1 red)", heading[0] > 200 && heading[1] < 60 && heading[2] < 60 && heading[3] == 255, JSON.stringify(heading));
    const body = await pixel(0.5, 0.85);
    check("card background navy", body.join() == "22,50,79,255", JSON.stringify(body));
    const plainCorner = await pixel(0.01, 0.01, "plain");
    check("default background stays white", plainCorner.join() == "255,255,255,255", JSON.stringify(plainCorner));

    // On screen: the unlit panel shows the card's own navy at the centre of the view (not darkened, not black).
    await page.waitForTimeout(300);
    const screen = await page.evaluate(() => new Promise(resolve => {
        // Read straight after a frame is drawn, while the drawing buffer still holds it.
        const scene = document.querySelector("garden-scene").scene, engine = scene.getEngine();
        scene.onAfterRenderObservable.addOnce(() => {
            const gl = engine._gl, px = new Uint8Array(4);
            gl.readPixels(Math.floor(engine.getRenderWidth() / 2), Math.floor(engine.getRenderHeight() / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            resolve(Array.from(px));
        });
    }));
    check("unlit panel on screen in its own colour (navy 22,50,79, mid-tones not darkened)",
        Math.abs(screen[0] - 22) <= 2 && Math.abs(screen[1] - 50) <= 2 && Math.abs(screen[2] - 79) <= 2, JSON.stringify(screen));

    // A change to the content draws the texture again by itself.
    const redrawn = () => page.evaluate(() => new Promise(r => document.getElementById("panel")
        .addEventListener("garden-html-rendered", e => r(e.detail), { once: true })));
    let wait = redrawn();
    await page.evaluate(() => { document.querySelector(".card h1").style.background = "rgb(0, 255, 0)"; });
    await wait;
    const green = await pixel(0.5, 0.2);
    check("content change redraws (h1 now green)", green[1] > 200 && green[0] < 60, JSON.stringify(green));

    // A stylesheet change needs renderHtml().
    await page.evaluate(() => {
        const s = document.createElement("style");
        s.textContent = ".card h1 { background: rgb(255, 255, 0) !important; }";
        document.head.appendChild(s);
        return document.getElementById("panel").renderHtml();
    });
    const yellow = await pixel(0.5, 0.2);
    check("renderHtml() redraws after a stylesheet change (yellow)", yellow[0] > 200 && yellow[1] > 200 && yellow[2] < 60, JSON.stringify(yellow));

    // A rebuild (width changed) gets a new texture from the same content.
    await page.evaluate(() => {
        const el = document.getElementById("panel");
        window.__old = el.mesh.material.diffuseTexture;
        el.setAttribute("width", "4");
    });
    await page.waitForFunction(() => {
        const t = document.getElementById("panel").mesh?.material?.diffuseTexture;
        return t && t != window.__old && t.getSize().width == 2048;
    }, null, { timeout: 20000 });
    const rebuilt = await pixel(0.5, 0.2);
    check("rebuild: the new texture shows the content", rebuilt[0] > 200 && rebuilt[1] > 200, JSON.stringify(rebuilt));

    // Removed for good: the content goes back inside the element, the host goes.
    const back = await page.evaluate(async () => {
        const el = document.getElementById("panel");
        el.remove();
        await new Promise(r => setTimeout(r, 100));
        return { inside: !!el.querySelector(".card"), hosts: document.querySelectorAll(".garden-html-host").length };
    });
    check("removed: content back inside, its host gone", back.inside && back.hosts == 1, JSON.stringify(back));
});
