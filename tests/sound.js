// Browser test of <garden-sound> on Babylon's AudioEngineV2: spatial sounds attach to
// their parent's mesh and follow it, ambient ones don't, play()/stop() and play-on/stop-on
// work, garden-sound-end fires, and the spatial attributes reach the Babylon sound.
// Run after a build: npm run test:sound.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 5 -10"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="speaker" position="3 1 0">
    <garden-sound id="voice" url="/examples/assets/tone.wav" ref-distance="2" rolloff="0.5"
        distance-model="exponential" directional="60 120" directional-volume="0.2"
        play-on="talk" stop-on="hush"></garden-sound>
  </garden-box>
  <garden-sound id="music" url="/examples/assets/tone.wav" loop autoplay volume="0.3"></garden-sound>
  <garden-box id="old" position="-3 1 0">
    <garden-sound id="legacy" url="/examples/assets/tone.wav" loop="false" maxdistance="20"></garden-sound>
  </garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => [...document.querySelectorAll("garden-sound")].every(s => s.sound), null, { timeout: 10000 });
    await page.mouse.click(500, 350); // a user gesture unlocks audio
    await frames(5);

    const got = await page.evaluate(() => {
        const v = document.getElementById("voice").sound, m = document.getElementById("music").sound, l = document.getElementById("legacy").sound;
        return {
            voiceAttached: v.spatial.isAttached, musicSpatial: m.spatial.isAttached,
            refDistance: v.spatial.minDistance, rolloff: v.spatial.rolloffFactor, model: v.spatial.distanceModel,
            cone: [v.spatial.coneInnerAngle, v.spatial.coneOuterAngle, v.spatial.coneOuterVolume].map(n => +n.toFixed(3)),
            musicLoop: m.loop, musicVolume: m.volume, musicPlaying: document.getElementById("music").playing,
            legacyLoop: l.loop, legacyModel: l.spatial.distanceModel, legacyMax: l.spatial.maxDistance,
            state: document.querySelector("garden-scene")._audioEngine && true,
        };
    });
    check("a sound inside a mesh is spatial and attached", got.voiceAttached, JSON.stringify(got));
    check("a sound directly in the scene is ambient", !got.musicSpatial);
    check("ref-distance / rolloff / distance-model", got.refDistance == 2 && got.rolloff == 0.5 && got.model == "exponential");
    check("directional cone in degrees", JSON.stringify(got.cone) == JSON.stringify([+(Math.PI / 3).toFixed(3), +(2 * Math.PI / 3).toFixed(3), 0.2]), JSON.stringify(got.cone));
    check("bare loop + autoplay + volume", got.musicLoop && got.musicPlaying && Math.abs(got.musicVolume - 0.3) < 1e-6);
    check("old maxdistance picks the linear model; loop=\"false\" is off", !got.legacyLoop && got.legacyModel == "linear" && got.legacyMax == 20);

    const events = await page.evaluate(() => new Promise(resolve => {
        const box = document.getElementById("speaker"), voice = document.getElementById("voice");
        const log = [];
        voice.addEventListener("garden-sound-end", () => log.push("end"));
        box.dispatchEvent(new CustomEvent("talk"));
        log.push(voice.playing ? "playing" : "silent");
        // tone.wav is 0.5 s; it ends on its own.
        setTimeout(() => {
            log.push(voice.playing ? "playing" : "silent");
            box.dispatchEvent(new CustomEvent("talk"));
            log.push(voice.playing ? "playing" : "silent");
            box.dispatchEvent(new CustomEvent("hush"));
            setTimeout(() => { log.push(voice.playing ? "playing" : "silent"); resolve(log); }, 100);
        }, 900);
    }));
    check("play-on plays, the end fires garden-sound-end, stop-on stops", JSON.stringify(events) == JSON.stringify(["playing", "end", "silent", "playing", "end", "silent"]), JSON.stringify(events));

    // The sound follows its mesh as it moves.
    const followed = await page.evaluate(async () => {
        const box = document.getElementById("speaker");
        box.mesh.position.set(10, 1, 5);
        await new Promise(r => setTimeout(r, 200));
        // spatial.position is the value set by hand; the attached position lives on the Spatial sub node.
        return document.getElementById("voice").sound.spatial._subGraph._subNodes.Spatial.position.asArray().map(n => +n.toFixed(2));
    });
    check("a spatial sound follows its moving mesh", followed[0] == 10 && followed[2] == 5, JSON.stringify(followed));
});
