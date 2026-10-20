// Browser test of named GLB animations on <garden-mesh-model>: play="..." at load,
// play(name, { blend }) cross-fades by weight, a one-shot fires garden-animation-end and
// returns to the looping animation, and anim-idle/-walk/-run follow a walking model's
// speed. Uses the CC0 RobotExpressive. Run after a build: npm run test:named-animations.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera type="arc" position="0 3 -8"></garden-camera>
  <garden-light></garden-light>
  <garden-mesh-model id="robot" src="/examples/assets/characters/RobotExpressive.glb" height="1.8" play="idle" loading-screen="false"></garden-mesh-model>
  <garden-mesh-model id="walker" src="/examples/assets/characters/RobotExpressive.glb" height="1.8" position="3 0 0" loading-screen="false"
      walk anim-idle="Idle" anim-walk="Walking" anim-run="Running" anim-walk-speed="1.8" anim-run-speed="5"></garden-mesh-model>
</garden-scene>`, async ({ page, check }) => {
    await page.waitForFunction(() => document.getElementById("robot").mesh && document.getElementById("walker").mesh, null, { timeout: 15000 });
    const weights = () => page.evaluate(() => {
        const r = document.getElementById("robot");
        const w = n => { const g = r.mixer.group(n); return g.isPlaying ? +g.weight.toFixed(2) : "stopped"; };
        return { current: r.mixer.current, idle: w("Idle"), walking: w("Walking"), wave: w("Wave") };
    });

    const names = await page.evaluate(() => document.getElementById("robot").animationNames);
    check("the GLB's animations by name", ["Idle", "Walking", "Running", "Wave"].every(n => names.includes(n)), names.join(","));
    let w = await weights();
    check("play=\"idle\" (any case) starts Idle at full weight", w.current == "Idle" && w.idle == 1 && w.walking == "stopped", JSON.stringify(w));

    await page.evaluate(() => document.getElementById("robot").play("Walking", { blend: 0.8 }));
    await page.waitForTimeout(350);
    w = await weights();
    check("mid-blend both play, weights summing to 1", w.idle > 0.1 && w.idle < 0.9 && Math.abs(w.idle + w.walking - 1) < 0.05, JSON.stringify(w));
    await page.waitForTimeout(800);
    w = await weights();
    check("after the blend only Walking plays", w.walking == 1 && w.idle == "stopped", JSON.stringify(w));

    const ended = await page.evaluate(() => new Promise(resolve => {
        const r = document.getElementById("robot");
        r.addEventListener("garden-animation-end", e => setTimeout(() => resolve({ name: e.detail.name, current: r.mixer.current }), 50), { once: true });
        r.play("Wave", { loop: false, blend: 0.1, speed: 2 });
        setTimeout(() => resolve("timeout"), 8000);
    }));
    check("a one-shot fires garden-animation-end and returns to the loop", ended.name == "Wave" && ended.current == "Walking", JSON.stringify(ended));

    // Replaying a one-shot from its own end event keeps it going (a gesture repeated while a pose holds).
    const again = await page.evaluate(() => new Promise(resolve => {
        const r = document.getElementById("robot");
        let ends = 0;
        const replay = () => {
            if (++ends < 3) return r.play("Wave", { loop: false, blend: 0.1, speed: 2 });
            r.removeEventListener("garden-animation-end", replay);
            setTimeout(() => resolve({ ends, current: r.mixer.current }), 50);
        };
        r.addEventListener("garden-animation-end", replay);
        r.play("Wave", { loop: false, blend: 0.1, speed: 2 });
        setTimeout(() => resolve("timeout"), 15000);
    }));
    check("a one-shot replayed from garden-animation-end plays again, then returns to the loop", again.ends == 3 && again.current == "Walking", JSON.stringify(again));

    check("an unknown name returns false", await page.evaluate(() => document.getElementById("robot").play("Moonwalk") === false));

    // Motion-driven: the walker's own speed picks Idle / Walking / Running.
    const motion = () => page.evaluate(() => {
        const m = document.getElementById("walker").mixer, g = m.group(m.current);
        return { current: m.current, speed: +g.speedRatio.toFixed(2) };
    });
    await page.waitForTimeout(300);
    let m = await motion();
    check("standing still plays Idle", m.current == "Idle", JSON.stringify(m));
    await page.keyboard.down("w");
    await page.waitForTimeout(1000);
    m = await motion();
    check("walking plays Walking, sped to match", m.current == "Walking" && m.speed > 0.9 && m.speed < 1.4, JSON.stringify(m));
    await page.keyboard.down("Shift");
    await page.waitForTimeout(1000);
    m = await motion();
    check("running plays Running", m.current == "Running", JSON.stringify(m));
    await page.keyboard.up("Shift");
    await page.keyboard.up("w");
    await page.waitForTimeout(1200);
    m = await motion();
    check("stopping goes back to Idle", m.current == "Idle", JSON.stringify(m));
});
