// Browser test of weather: particle presets (rain/snow/sand round the camera, a dust devil
// on its mesh), live density, scene fog attributes + fogTo() + a fog <garden-animation>,
// a colour sky with fadeTo() and fog following it, and <garden-lightning> strike() with
// its thunder. Run after a build: npm run test:weather.
const { run } = require("./harness");

run(`
<garden-scene fog-density="0.01">
  <garden-camera type="free" position="0 2 -10"></garden-camera>
  <garden-sky id="sky" colour="#ff8000"></garden-sky>
  <garden-light></garden-light>
  <garden-ground width="40" height="40"></garden-ground>
  <garden-particle id="rain" preset="rain" density="0.5"></garden-particle>
  <garden-particle id="snow" preset="snow"></garden-particle>
  <garden-particle id="sand" preset="sand" wind="5 0 0"></garden-particle>
  <garden-box id="devil-carrier" position="5 0 5" width="0.2" height="0.2" depth="0.2">
    <garden-particle id="devil" preset="dust-devil"></garden-particle>
  </garden-box>
  <garden-lightning id="bolt" intensity="4" thunder-delay="0.2 0.2">
    <garden-sound id="thunder" url="/examples/assets/thunder.wav"></garden-sound>
  </garden-lightning>
</garden-scene>`, async ({ page, check, frames, open }) => {
    await page.waitForFunction(() => ["rain", "snow", "sand", "devil"].every(id => document.getElementById(id).particleSystem));
    await page.waitForFunction(() => document.getElementById("thunder").sound);
    await page.mouse.click(500, 350); // unlock audio
    await page.waitForTimeout(500);

    const ps = () => page.evaluate(() => Object.fromEntries(["rain", "snow", "sand", "devil"].map(id => {
        const p = document.getElementById(id).particleSystem;
        const e = p.emitter.getAbsolutePosition ? p.emitter.getAbsolutePosition() : p.emitter;
        return [id, { active: p.getActiveCount(), rate: p.emitRate, emitter: e.asArray().map(n => +n.toFixed(1)), local: p.isLocal }];
    })));
    let p = await ps();
    check("rain, snow and sand presets emit", p.rain.active > 0 && p.snow.active > 0 && p.sand.active > 0, JSON.stringify(p));
    check("density scales the emit rate (rain at 0.5)", p.rain.rate == 2000, String(p.rain.rate));
    check("rain falls from above the camera", p.rain.emitter[1] > 10 && p.rain.emitter[2] == -10, JSON.stringify(p.rain.emitter));
    check("the dust devil spins in its mesh's space, on the mesh", p.devil.local && p.devil.active > 0 && p.devil.emitter[0] == 5 && p.devil.emitter[2] == 5, JSON.stringify(p.devil));

    await page.evaluate(() => {
        document.querySelector("garden-scene").scene.activeCamera.position.set(20, 2, 20);
        document.getElementById("rain").density = 2;
        document.getElementById("devil-carrier").mesh.position.set(-5, 0, -5);
    });
    await frames(3);
    p = await ps();
    check("rain follows the camera", p.rain.emitter[0] == 20 && p.rain.emitter[2] == 20, JSON.stringify(p.rain.emitter));
    check("density can be set from code", p.rain.rate == 8000, String(p.rain.rate));
    check("the dust devil travels with its mesh", p.devil.emitter[0] == -5 && p.devil.emitter[2] == -5, JSON.stringify(p.devil.emitter));

    // Sky and fog.
    const sky = () => page.evaluate(() => {
        const s = document.querySelector("garden-scene").scene;
        return { clear: s.clearColor.toHexString().slice(0, 7), fog: s.fogColor.toHexString(), mode: s.fogMode, density: +s.fogDensity.toFixed(4) };
    });
    let s = await sky();
    check("a colour sky sets the clear colour, and the fog follows it", s.clear == "#FF8000" && s.fog == "#FF8000", JSON.stringify(s));
    check("fog-density alone turns on exp2 fog", s.mode == 2 && s.density == 0.01, JSON.stringify(s));
    await page.evaluate(() => document.querySelector("garden-scene").fogDensity = 0.03);
    await page.waitForTimeout(100);
    check("fog attributes are live", (await sky()).density == 0.03);
    await page.evaluate(() => { window.fogged = document.querySelector("garden-scene").fogTo({ density: 0.1, colour: "#0000ff" }, 1); document.getElementById("sky").fadeTo("#000000", 1); });
    await page.waitForTimeout(500);
    s = await sky();
    check("fogTo() eases the fog (its own colour, not the sky's)", s.density > 0.04 && s.density < 0.09 && s.fog.startsWith("#") && s.fog != s.clear, JSON.stringify(s));
    await page.evaluate(() => window.fogged);
    await page.waitForTimeout(600);
    s = await sky();
    check("…to its target; the sky fades with fadeTo()", s.density == 0.1 && s.fog == "#0000FF" && s.clear == "#000000", JSON.stringify(s));

    // Lightning.
    const bolt = await page.evaluate(() => new Promise(resolve => {
        const b = document.getElementById("bolt"), s = document.querySelector("garden-scene").scene, thunder = document.getElementById("thunder");
        const out = { event: false, peak: 0, sky: 0, thunder: false };
        b.addEventListener("garden-lightning", () => out.event = true, { once: true });
        const o = s.onAfterRenderObservable.add(() => {
            const flash = s.lights.find(l => l.name == "bolt");
            out.peak = Math.max(out.peak, flash.intensity);
            out.sky = Math.max(out.sky, s.clearColor.b);
        });
        b.strike();
        setTimeout(() => { out.thunder = thunder.playing; }, 450);
        setTimeout(() => { s.onAfterRenderObservable.remove(o); out.after = s.lights.find(l => l.name == "bolt").intensity; out.skyAfter = s.clearColor.toHexString().slice(0, 7); resolve(out); }, 1200);
    }));
    check("strike() flashes the scene and the sky, then goes dark again", bolt.event && bolt.peak > 2 && bolt.sky > 0.3 && bolt.after == 0 && bolt.skyAfter == "#000000", JSON.stringify(bolt));
    check("…and the thunder plays after thunder-delay", bolt.thunder, JSON.stringify(bolt));

    // A fog animation inside the scene, and random strikes.
    await open(`
<garden-scene id="world" fog-mode="exp">
  <garden-camera type="arc" position="0 5 -10"></garden-camera>
  <garden-light></garden-light>
  <garden-animation event="load" property="fogDensity" type="float" from="0" to="15" keyframes="0 0, 15 0.2"></garden-animation>
  <garden-lightning id="random" interval="0.3 0.5"></garden-lightning>
</garden-scene>`);
    await page.evaluate(() => { window.strikes = 0; document.getElementById("random").addEventListener("garden-lightning", () => strikes++); });
    await page.waitForTimeout(1500);
    const anim = await page.evaluate(() => ({ density: document.querySelector("garden-scene").scene.fogDensity, strikes }));
    check("<garden-animation property=\"fogDensity\"> in the scene animates the fog", Math.abs(anim.density - 0.2) < 1e-6, JSON.stringify(anim));
    check("interval strikes at random", anim.strikes >= 2, JSON.stringify(anim));
});
