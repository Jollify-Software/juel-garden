// Browser test of type="device" (a DeviceOrientationCamera: a phone or tablet turns the
// view; a free camera on a desktop) and <garden-sky environment> (a prefiltered cube as
// both the sky and the light physically-based materials reflect). The environment is
// a tiny .env made here from a solid colour, so the test needs no download.
// Run after a build: npm run test:device-environment.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera id="cam" type="device" position="0 1.6 -5" target="0 1 0"></garden-camera>
  <garden-light></garden-light>
  <garden-sphere id="ball" position="0 1 0"></garden-sphere>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("cam").camera);
    const cam = await page.evaluate(() => {
        const c = document.getElementById("cam").camera;
        const d = c.getDirection(new BABYLON.Vector3(0, 0, 1));
        return { cls: c.getClassName(), pos: c.position.asArray(), dir: d.asArray().map(v => +v.toFixed(2)) };
    });
    check("type=\"device\" is a DeviceOrientationCamera", cam.cls == "DeviceOrientationCamera", cam.cls);
    check("…at its position, looking at its target", cam.pos.join() == "0,1.6,-5" && cam.dir[2] > 0.9 && cam.dir[1] < 0, JSON.stringify(cam));

    // An environment from a one-colour cube map, via Babylon's own .env writer.
    const env = await page.evaluate(async () => {
        const scene = document.querySelector("garden-scene").scene;
        const size = 4, face = new Uint8Array(size * size * 4).fill(255);
        const cube = new BABYLON.RawCubeTexture(scene, [face, face, face, face, face, face], size);
        const buffer = await BABYLON.EnvironmentTextureTools.CreateEnvTextureAsync(cube);
        cube.dispose();
        return URL.createObjectURL(new Blob([buffer]));
    });
    await page.evaluate((url) => {
        const sky = document.createElement("garden-sky");
        sky.setAttribute("environment", url + "#.env");
        sky.id = "sky";
        document.querySelector("garden-scene").appendChild(sky);
    }, env);
    await page.waitForFunction(() => document.getElementById("sky").mesh);
    await frames(10);
    const s = await page.evaluate(() => {
        const scene = document.querySelector("garden-scene").scene;
        const sky = document.getElementById("sky").mesh;
        return { env: !!scene.environmentTexture, sky: sky.name, infinite: sky.infiniteDistance };
    });
    check("environment lights the scene (scene.environmentTexture)", s.env, JSON.stringify(s));
    check("…and is the skybox", s.sky == "hdrSkyBox" && s.infinite, JSON.stringify(s));

    // environment="default": Babylon's createDefaultEnvironment (needs its assets online).
    await page.evaluate(() => {
        const sky = document.createElement("garden-sky");
        sky.setAttribute("environment", "default");
        sky.id = "default-sky";
        document.querySelector("garden-scene").appendChild(sky);
    });
    await page.waitForFunction(() => document.getElementById("default-sky").environmentHelper);
    const d = await page.evaluate(() => { const h = document.getElementById("default-sky").environmentHelper; return { sky: !!h.skybox, ground: !!h.ground, mesh: document.getElementById("default-sky").mesh == h.skybox }; });
    check("environment=\"default\": Babylon's default environment (sky and ground)", d.sky && d.ground && d.mesh, JSON.stringify(d));

    // A prefiltered .dds is loaded as Babylon's helper does: linear, not gamma (else it's too dark).
    const dds = await page.evaluate(() => {
        const sky = document.createElement("garden-sky");
        sky.setAttribute("environment", "/missing/environment.dds");
        sky.setAttribute("backdrop", "false");
        document.querySelector("garden-scene").appendChild(sky);
        return new Promise(r => requestAnimationFrame(() => {
            const t = document.querySelector("garden-scene").scene.environmentTexture;
            r({ url: t?.url ?? t?.name, gamma: t?.gammaSpace });
        }));
    });
    check("environment=\"x.dds\" is a prefiltered (linear) cube", /environment\.dds/.test(dds.url) && dds.gamma === false, JSON.stringify(dds));
});
