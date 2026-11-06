// Browser test of `<garden-camera fall>`: a walking camera climbs stairs and comes down at the same pace at any frame rate. The scene's `gravity`
// is a drop per frame, so at a slow walk on a fast screen it beats the step and the camera sticks at the foot of the stairs: that's the control.
// The frame rate is simulated (Babylon reads it from the engine), so a slow test machine can stand for a fast screen. Run after a build:
// npm run test:camera-fall.
const { run } = require("./harness");

const scene = fall => `
<garden-scene gravity="0 -0.4 0" collisions>
  <garden-camera id="cam" type="free" collisions${fall ? ` fall="${fall}"` : ""} position="0 1.7 3" rotation="0 180 0" speed="0.095" ellipsoid="0.4 0.8 0.4"></garden-camera>
  <garden-light></garden-light>
  <garden-ground width="60" height="60" collisions></garden-ground>
  <garden-stairs id="stairs" position="0 0 1" rotation="0 180 0" width="3" depth="3.5" height="3" collisions></garden-stairs>
</garden-scene>`;

run(scene(5), async ({ page, check, open }) => {
    /** Holds W for this many frames at a simulated frame rate: the highest the eye got. */
    const climb = (fps, frames) => page.evaluate(([fps, frames]) => new Promise(resolve => {
        const el = document.getElementById("cam"), cam = el.camera, s = cam.getScene(), engine = s.getEngine();
        engine.getDeltaTime = () => 1000 / fps;
        engine.getFps = () => fps;
        cam.position.set(0, 1.7, 3);
        cam.rotation.set(0, Math.PI, 0);
        cam.cameraDirection.set(0, 0, 0);
        let n = 0, top = 0;
        const canvas = document.querySelector("garden-scene").canvas;
        canvas.focus();
        const o = s.onBeforeRenderObservable.add(() => {
            top = Math.max(top, cam.position.y);
            if (++n >= frames) { s.onBeforeRenderObservable.remove(o); resolve({ top: +top.toFixed(2), z: +cam.position.z.toFixed(2) }); }
        });
    }), [fps, frames]);
    await page.waitForFunction(() => document.getElementById("cam").camera);
    await page.waitForTimeout(1500);
    await page.keyboard.down("w");
    for (const fps of [30, 60, 144]) {
        const got = await climb(fps, Math.ceil(fps * 4));
        check(`fall: at ${fps} fps it climbs the stairs`, got.top > 4.2, JSON.stringify(got));
    }
    await page.keyboard.up("w");

    // Coming down: off the top of a drop, at about the rate asked for, whatever the frame rate.
    for (const fps of [30, 144]) {
        const rate = await page.evaluate(fps => new Promise(resolve => {
            const cam = document.getElementById("cam").camera, s = cam.getScene(), engine = s.getEngine();
            engine.getDeltaTime = () => 1000 / fps;
            engine.getFps = () => fps;
            cam.position.set(20, 21.6, 20);
            let n = 0, start = null;
            const o = s.onBeforeRenderObservable.add(() => {
                if (++n == 3) start = cam.position.y;
                if (n == 3 + Math.round(fps)) { s.onBeforeRenderObservable.remove(o); resolve(+(start - cam.position.y).toFixed(2)); }
            });
        }), fps);
        check(`fall="5": about 5 m in a second at ${fps} fps`, rate > 4.5 && rate < 5.5, String(rate));
    }

    // Off the edge of the world, it comes back to where it started.
    const back = await page.evaluate(() => new Promise(resolve => {
        const cam = document.getElementById("cam").camera, s = cam.getScene();
        cam.position.set(100, 5, 100);
        const until = Date.now() + 12000;
        const o = s.onBeforeRenderObservable.add(() => { if (cam.position.x == 0 || Date.now() > until) { s.onBeforeRenderObservable.remove(o); resolve([cam.position.x, +cam.position.y.toFixed(1), cam.position.z]); } });
    }));
    check("off the edge of the world: back where it started", back[0] == 0 && back[2] == 3, JSON.stringify(back));

    // A page turning gravity off stops the fall: the app's Overview looks from above with this.
    const still = await page.evaluate(() => new Promise(resolve => {
        const cam = document.getElementById("cam").camera, s = cam.getScene();
        cam.applyGravity = false;
        cam.position.set(20, 21.6, 20);
        let n = 0;
        const o = s.onBeforeRenderObservable.add(() => { if (++n == 30) { s.onBeforeRenderObservable.remove(o); cam.applyGravity = true; resolve(cam.position.y); } });
    }));
    check("applyGravity off: it stays where it is", still == 21.6, String(still));

    // The control: the scene's own per-frame gravity, as it was.
    await open(scene(0));
    await page.waitForFunction(() => document.getElementById("cam").camera);
    await page.waitForTimeout(1200);
    await page.keyboard.down("w");
    const stuck = await climb(60, 240);
    await page.keyboard.up("w");
    check("control: without fall, at 60 fps, a slow walk sticks at the foot", stuck.top < 2.5, JSON.stringify(stuck));
});
