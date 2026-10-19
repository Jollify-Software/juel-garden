// Browser test of `follow` and `follow-wait`: followers close in on their leader and keep
// apart, face the way they walk, follow-offset holds a place in the leader's own frame,
// and a guide on a track stops, turns to the player and fires garden-wait/garden-resume.
// Run after a build: npm run test:follow.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 20 -20"></garden-camera>
  <garden-light></garden-light>
  <garden-box id="L" position="0 0.5 0"></garden-box>
  <garden-box class="f" position="-6 0.5 -3" follow="#L" follow-distance="2" follow-spacing="1.2"></garden-box>
  <garden-box class="f" position="-6 0.5 0" follow="#L" follow-distance="2" follow-spacing="1.2"></garden-box>
  <garden-box class="f" position="-6 0.5 3" follow="#L" follow-distance="2" follow-spacing="1.2"></garden-box>
  <garden-box id="L2" position="0 0.5 0"></garden-box>
  <garden-box id="side" position="4 0.5 -6" follow="#L2" follow-offset="-1.5 0 -1" follow-speed="6"></garden-box>
</garden-scene>`, async ({ page, check, open }) => {
    await page.evaluate(() => document.getElementById("L").mesh.position.set(10, 0.5, 0));
    await page.waitForTimeout(5000);
    const flock = await page.evaluate(() => {
        const L = document.getElementById("L").mesh.position;
        const fs = [...document.querySelectorAll(".f")].map(f => f.mesh.position);
        const gaps = [];
        for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) gaps.push(Math.hypot(fs[i].x - fs[j].x, fs[i].z - fs[j].z));
        return { toLeader: fs.map(p => +Math.hypot(p.x - L.x, p.z - L.z).toFixed(2)), gaps: gaps.map(g => +g.toFixed(2)),
                 speeds: [...document.querySelectorAll(".f")].map(f => +f.follower.speed.toFixed(2)) };
    });
    check("followers close in on the leader", flock.toLeader.every(d => d < 3.4), JSON.stringify(flock));
    check("…and keep follow-spacing apart", flock.gaps.every(g => g > 0.9), JSON.stringify(flock.gaps));
    check("…and stop once there", flock.speeds.every(s => s < 0.2), JSON.stringify(flock.speeds));

    // Moving the leader along +Z: followers turn to face +Z while they walk.
    await page.evaluate(() => document.getElementById("L").mesh.position.set(10, 0.5, 15));
    await page.waitForTimeout(1500);
    const yaws = await page.evaluate(() => [...document.querySelectorAll(".f")].map(f => +(f.mesh.rotation.y * 180 / Math.PI).toFixed(0)));
    check("followers face the way they walk", yaws.every(y => Math.abs(y) < 30), JSON.stringify(yaws));

    // follow-offset in the leader's frame: (-1.5, 0, -1) at yaw 0; turned 90 deg, (-1, 0, +1.5).
    await page.evaluate(() => { const m = document.getElementById("L2").mesh; m.position.set(0, 0.5, 20); m.rotation.y = 0; });
    await page.waitForTimeout(6000);
    let side = await page.evaluate(() => document.getElementById("side").mesh.position.asArray().map(n => +n.toFixed(1)));
    check("follow-offset: behind and to the left", Math.abs(side[0] + 1.5) < 0.3 && Math.abs(side[2] - 19) < 0.3, JSON.stringify(side));
    await page.evaluate(() => { document.getElementById("L2").mesh.rotation.y = Math.PI / 2; });
    await page.waitForTimeout(4000);
    side = await page.evaluate(() => document.getElementById("side").mesh.position.asArray().map(n => +n.toFixed(1)));
    check("follow-offset turns with the leader", Math.abs(side[0] + 1) < 0.3 && Math.abs(side[2] - 21.5) < 0.3, JSON.stringify(side));

    // A guide on a track that waits for the player.
    await open(`
<garden-scene>
  <garden-camera type="arc" position="0 30 -30"></garden-camera>
  <garden-light></garden-light>
  <garden-line points="0 0 0, 0 0 100">
    <garden-box id="guide" track track-step="0.05" follow-wait="#player" follow-wait-distance="5"></garden-box>
  </garden-line>
  <garden-box id="fan" position="-3 0 -3" follow="#guide" follow-distance="1.5"></garden-box>
  <garden-box id="player" position="3 0 -1"></garden-box>
</garden-scene>`);
    await page.evaluate(() => {
        window.log = [];
        const g = document.getElementById("guide");
        g.addEventListener("garden-wait", e => log.push(["wait", +e.detail.distance.toFixed(1)]));
        g.addEventListener("garden-resume", () => log.push(["resume"]));
    });
    // The guide walks off; the player stays put, so the guide soon waits.
    await page.waitForFunction(() => log.length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1000);
    const waiting = await page.evaluate(() => {
        const g = document.getElementById("guide"), m = g.mesh, p = document.getElementById("player").mesh.position;
        return { waiting: g.waiting, z: m.position.z, yaw: m.rotation.y, wantYaw: Math.atan2(p.x - m.position.x, p.z - m.position.z) };
    });
    check("garden-wait fires when the player is too far behind", waiting.waiting && (await page.evaluate(() => log[0][0])) == "wait", JSON.stringify(waiting));
    check("…and the guide turns to face the player", Math.abs(waiting.yaw - waiting.wantYaw) < 0.1, JSON.stringify(waiting));
    await page.waitForTimeout(800);
    const z2 = await page.evaluate(() => document.getElementById("guide").mesh.position.z);
    check("…and stops on its track", Math.abs(z2 - waiting.z) < 1e-6, `${waiting.z} -> ${z2}`);
    const fan = await page.evaluate(() => {
        const a = document.getElementById("fan").mesh.position, b = document.getElementById("guide").mesh.position;
        return +Math.hypot(a.x - b.x, a.z - b.z).toFixed(2);
    });
    check("a follower of the waiting guide waits by it", fan < 2.2, String(fan));

    // The player catches up: within 80% of the distance, the guide carries on.
    await page.evaluate(() => { const g = document.getElementById("guide").mesh.position; document.getElementById("player").mesh.position.set(0, 0, g.z - 2); });
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() => ({ log, waiting: document.getElementById("guide").waiting, z: document.getElementById("guide").mesh.position.z }));
    check("garden-resume fires and the guide walks on", !resumed.waiting && resumed.log.some(e => e[0] == "resume") && resumed.z > z2 + 0.5, JSON.stringify(resumed));
});
