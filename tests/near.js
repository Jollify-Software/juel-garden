// Browser test of proximity events: near="#id" fires garden-near / garden-far with
// hysteresis, several targets, near="camera", a plain <garden-element> as a point, and a
// <garden-sound play-on="garden-near" stop-on="garden-far"> exhibit with no code.
// Run after a build: npm run test:near.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="free" position="0 1.6 -20"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="exhibit" position="0 0.5 0" near="#p, #q" near-distance="3">
    <garden-sound id="talk" url="/examples/assets/tone.wav" loop play-on="garden-near" stop-on="garden-far"></garden-sound>
  </garden-box>
  <garden-element id="spot" position="10 0 0" near="#p" near-distance="2"></garden-element>
  <garden-box id="kiosk" position="0 1 -10" near="camera" near-distance="4"></garden-box>
  <garden-box id="p" position="8 0.5 0"></garden-box>
  <garden-box id="q" position="-8 0.5 0"></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("talk").sound);
    await page.mouse.click(500, 350); // unlock audio
    await page.evaluate(() => {
        window.log = [];
        for (const id of ["exhibit", "spot", "kiosk"])
            for (const type of ["garden-near", "garden-far"])
                document.getElementById(id).addEventListener(type, e => {
                    const t = e.detail.target;
                    log.push(`${id} ${type.slice(7)} ${t.id || t.getClassName?.() || "?"}`);
                });
    });
    const move = async (id, x, z) => { await page.evaluate(([id, x, z]) => document.getElementById(id).mesh.position.set(x, 0.5, z), [id, x, z]); await frames(3); };
    const take = () => page.evaluate(() => log.splice(0));

    await frames(3);
    check("nothing fires while everything is far", (await take()).length == 0);

    await move("p", 2.5, 0);
    let got = await take();
    check("garden-near when a target comes within near-distance", JSON.stringify(got) == JSON.stringify(["exhibit near p"]), JSON.stringify(got));
    check("…and play-on starts the sound", await page.evaluate(() => document.getElementById("talk").playing));

    await move("p", 3.3, 0);
    check("no garden-far inside the hysteresis band (3 x 1.2)", (await take()).length == 0);
    await move("p", 3.7, 0);
    got = await take();
    check("garden-far past near-distance x near-hysteresis", JSON.stringify(got) == JSON.stringify(["exhibit far p"]), JSON.stringify(got));
    check("…and stop-on stops the sound", !(await page.evaluate(() => document.getElementById("talk").playing)));

    await move("q", -1, 1);
    got = await take();
    check("several targets: each fires its own event", JSON.stringify(got) == JSON.stringify(["exhibit near q"]), JSON.stringify(got));
    check("element.nearby lists who is near", await page.evaluate(() => [...document.getElementById("exhibit").nearby].map(t => t.id).join() == "q"));

    await move("p", 9, 0.5);
    got = await take();
    check("a plain <garden-element> works as a point", got.includes("spot near p"), JSON.stringify(got));

    await page.evaluate(() => document.querySelector("garden-scene").scene.activeCamera.position.set(0, 1.6, -12));
    await frames(3);
    got = await take();
    check("near=\"camera\" fires for the active camera", got.some(e => e.startsWith("kiosk near")), JSON.stringify(got));
});
