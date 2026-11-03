// Browser test of <garden-sound sync>: sounds with the same `sync` and `autoplay` wait until
// the whole group has loaded (one file here is held back 1.5 s), then start together, at the
// same place in their files; play() and stop() on one act on the group; a sound outside it
// is left alone. Run after a build: npm run test:sound-sync.
const fs = require("fs");
const path = require("path");
const { run, ROOT, ORIGIN } = require("./harness");

run(`<garden-scene><garden-camera></garden-camera></garden-scene>`, async ({ page, check, open }) => {
    const tone = fs.readFileSync(path.join(ROOT, "examples/assets/tone.wav"));
    await page.route(ORIGIN + "/slow/tone.wav", async route => {
        await new Promise(r => setTimeout(r, 1500));
        route.fulfill({ status: 200, body: tone, contentType: "audio/wav" });
    });
    await open(`
<garden-scene>
  <garden-camera type="arc" position="0 2 -6"></garden-camera>
  <garden-sound id="a" url="/examples/assets/tone.wav" loop autoplay sync="band"></garden-sound>
  <garden-sound id="b" url="/examples/assets/call.wav" loop autoplay sync="band"></garden-sound>
  <garden-sound id="c" url="/slow/tone.wav" loop autoplay sync="band"></garden-sound>
  <garden-sound id="solo" url="/examples/assets/tone.wav" loop></garden-sound>
</garden-scene>`);
    await page.mouse.click(500, 350); // a user gesture unlocks audio
    const state = () => page.evaluate(() => ["a", "b", "c", "solo"].map(id => {
        const el = document.getElementById(id);
        return { id, loaded: !!el.sound, playing: el.playing, t: el.sound ? +el.sound.currentTime.toFixed(3) : null };
    }));
    await page.waitForFunction(() => document.getElementById("a").sound && document.getElementById("b").sound, null, { timeout: 10000 });
    let s = await state();
    check("while one is still loading, none of the group plays", !s[2].loaded && !s[0].playing && !s[1].playing, JSON.stringify(s));

    await page.waitForFunction(() => document.getElementById("c").sound, null, { timeout: 10000 });
    await page.waitForTimeout(200);
    s = await state();
    check("once all have loaded, all three play", s[0].playing && s[1].playing && s[2].playing, JSON.stringify(s));
    check("together: each is at the same place in its file", Math.abs(s[0].t - s[1].t) < 0.02 && Math.abs(s[0].t - s[2].t) < 0.02, JSON.stringify(s));
    check("a sound without sync isn't started", !s[3].playing);
    check("group() lists the sync group", await page.evaluate(() => document.getElementById("b").group().map(el => el.id).join() == "a,b,c"));

    await page.evaluate(() => document.getElementById("b").stop());
    s = await state();
    check("stop() on one stops the group", !s[0].playing && !s[1].playing && !s[2].playing, JSON.stringify(s));
    await page.evaluate(() => document.getElementById("c").play());
    await page.waitForTimeout(100);
    s = await state();
    check("play() on one starts the group together", s[0].playing && s[1].playing && s[2].playing && Math.abs(s[0].t - s[2].t) < 0.02 && !s[3].playing, JSON.stringify(s));
});
