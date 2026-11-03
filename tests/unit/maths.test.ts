// Pure maths with no scene: yaw turning, noise, smoothstep, the seeded dice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { turnYaw } from "../../src/Utils/turnYaw";
import { noise, smoothstep, seededRandom } from "../../src/Utils/noise";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

test("turnYaw reaches the wanted yaw when it is within one step", () => {
    close(turnYaw(0, 0.1, 0.5), 0.1);
});

test("turnYaw moves at most maxStep", () => {
    close(turnYaw(0, 2, 0.5), 0.5);
    close(turnYaw(0, -2, 0.5), -0.5);
});

test("turnYaw goes the short way round", () => {
    // From just below +pi to just above -pi is a small step forwards, not nearly a full turn back.
    const from = Math.PI - 0.1, to = -Math.PI + 0.1;
    close(turnYaw(from, to, 1), from + 0.2);
});

test("smoothstep is 0 below, 1 above, and a half at the middle", () => {
    assert.equal(smoothstep(1, 2, 0), 0);
    assert.equal(smoothstep(1, 2, 3), 1);
    close(smoothstep(1, 2, 1.5), 0.5);
});

test("noise stays within 0 to 1, repeats, and is continuous", () => {
    for (let i = 0; i < 500; i++) {
        const x = i * 0.37 - 50, z = i * 0.91 - 20, n = noise(x, z);
        assert.ok(n >= 0 && n <= 1, `noise(${x}, ${z}) = ${n}`);
        assert.equal(noise(x, z), n);
        assert.ok(Math.abs(noise(x + 1e-6, z) - n) < 1e-4, "jumps between close points");
    }
});

test("seededRandom repeats for one seed, differs for another, stays in 0 to 1", () => {
    const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43);
    const as = Array.from({ length: 20 }, a), bs = Array.from({ length: 20 }, b), cs = Array.from({ length: 20 }, c);
    assert.deepEqual(as, bs);
    assert.notDeepEqual(as, cs);
    for (const v of as) assert.ok(v >= 0 && v < 1);
});
