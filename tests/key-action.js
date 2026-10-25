// Browser test of <garden-action trigger="keydown"/"keyup" key="...">: inside a mesh, a key moves
// it (each key press, and the browser's repeats); keys are any case and several can share an
// action; keyup works; a rebuilt or removed action stops acting; and a free camera with
// keys="arrows" leaves W/A/S/D alone. Run after a build: npm run test:key-action.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="free" position="0 5 -10" target="0 0 0" keys="arrows"></garden-camera>
  <garden-light type="hemi"></garden-light>
  <garden-sphere id="ball" diameter="1">
    <garden-action id="left" type="increment" trigger="keydown" key="a ArrowLeft" property="position.x" value="-0.1"></garden-action>
    <garden-action type="increment" trigger="keydown" key="D" property="position.x" value="0.1"></garden-action>
    <garden-action type="increment" trigger="keyup" key="space" property="position.y" value="1"></garden-action>
  </garden-sphere>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("ball").mesh);
    await page.waitForTimeout(300); // actions register once the document is ready
    const where = () => page.evaluate(() => {
        const p = document.getElementById("ball").mesh.position, c = document.querySelector("garden-scene").scene.activeCamera.position;
        return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), camera: c.asArray().map(n => +n.toFixed(2)).join(" ") };
    });
    await page.mouse.click(500, 350); // the canvas takes the keys once it has the focus
    await page.keyboard.press("a");
    await page.keyboard.press("a");
    await frames(2);
    let p = await where();
    check("each press of a moves it -0.1", p.x == -0.2, JSON.stringify(p));
    await page.keyboard.press("Shift+A");
    await page.keyboard.press("ArrowLeft");
    await frames(2);
    p = await where();
    check("any case, and a second key on the same action", p.x == -0.4, JSON.stringify(p));
    await page.keyboard.press("d");
    await frames(2);
    p = await where();
    check("key=\"D\" matches d", p.x == -0.3, JSON.stringify(p));
    await page.keyboard.down(" ");
    await frames(2);
    const down = await where();
    await page.keyboard.up(" ");
    await frames(2);
    p = await where();
    check("keyup with key=\"space\" acts on release", down.y == 0 && p.y == 1, JSON.stringify({ down, up: p }));

    // Held: the browser's repeats are each a key press.
    await page.keyboard.down("d");
    for (let i = 0; i < 4; i++) await page.keyboard.down("d"); // repeats
    await page.keyboard.up("d");
    await frames(2);
    p = await where();
    check("a held key's repeats keep moving it", p.x == 0.2, JSON.stringify(p));

    await page.waitForTimeout(500); // the arrow pressed above has finished moving the camera
    const before = await where();
    await page.keyboard.press("w");
    await page.keyboard.down("s");
    await page.waitForTimeout(300);
    await page.keyboard.up("s");
    const after = await where();
    check("keys=\"arrows\": W/A/S/D don't move the camera", after.camera == before.camera, JSON.stringify({ before, after }));

    // A changed action is rebuilt (the old one stops acting); a removed one stops.
    await page.evaluate(() => document.getElementById("left").setAttribute("value", "-1"));
    await page.waitForTimeout(300);
    await page.keyboard.press("a");
    await frames(2);
    p = await where();
    check("a changed action acts once, with its new value", p.x == -0.8, JSON.stringify(p));
    await page.evaluate(() => document.getElementById("left").remove());
    await page.waitForTimeout(100);
    await page.keyboard.press("a");
    await frames(2);
    p = await where();
    check("a removed action stops", p.x == -0.8, JSON.stringify(p));
});
