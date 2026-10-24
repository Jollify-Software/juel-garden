// Browser test of <garden-sprite> cell animation: cells="from to" plays a sheet's cells in
// turn (cell-delay ms each, looping unless cell-loop="false"), cell="n" shows one, still;
// a rebuild leaves no old sprite behind. Run after a build: npm run test:sprite.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 0 -8"></garden-camera>
  <garden-light></garden-light>
  <garden-sprite id="walker" url="/examples/assets/dunes.png" width="32" height="32" count="2" positions="-1 0 0"
      cells="0 7" cell-delay="50"></garden-sprite>
  <garden-sprite id="once" url="/examples/assets/dunes.png" width="32" height="32" count="1" positions="1 0 0"
      cells="2 4" cell-delay="50" cell-loop="false"></garden-sprite>
  <garden-sprite id="still" url="/examples/assets/dunes.png" width="32" height="32" count="1" positions="0 1 0" cell="5"></garden-sprite>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("still").sprites.length == 1);
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
        seen.add(await page.evaluate(() => document.getElementById("walker").sprites[0].cellIndex));
        await page.waitForTimeout(40);
    }
    check("cells plays the sheet's cells in turn", seen.size >= 4 && [...seen].every(c => c >= 0 && c <= 7), JSON.stringify([...seen]));
    const s = await page.evaluate(() => ({
        count: document.getElementById("walker").sprites.length,
        both: document.getElementById("walker").sprites.every(sp => sp.animationStarted),
        once: document.getElementById("once").sprites[0].cellIndex,
        onceRunning: document.getElementById("once").sprites[0].animationStarted,
        still: document.getElementById("still").sprites[0].cellIndex,
        stillRunning: document.getElementById("still").sprites[0].animationStarted,
    }));
    check("every sprite in the group animates", s.count == 2 && s.both, JSON.stringify(s));
    check("cell-loop=\"false\" stops on the last cell", s.once == 4 && !s.onceRunning, JSON.stringify(s));
    check("cell shows one cell, still", s.still == 5 && !s.stillRunning, JSON.stringify(s));

    await page.evaluate(() => document.getElementById("still").setAttribute("cell", "3"));
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
        cell: document.getElementById("still").sprites[0].cellIndex,
        managers: document.querySelector("garden-scene").scene.spriteManagers.length,
    }));
    check("a change rebuilds it without leaving the old sprites behind", r.cell == 3 && r.managers == 3, JSON.stringify(r));
});
