// Wall arcs and vertex picking, on Babylon's Vector3 alone (no engine, no scene).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { arcPoints } from "../../src/Utils/Mesh/createWall";
import { getBottommostVertices } from "../../src/Utils/getBottommostVertices";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

test("arcPoints with no sagitta is a straight wall", () => {
    const pts = arcPoints(new Vector3(0, 0, 0), new Vector3(4, 0, 0), 0, 8);
    assert.equal(pts.length, 2);
});

test("arcPoints gives segments + 1 points, pinned to the ends", () => {
    const start = new Vector3(0, 0, 0), end = new Vector3(4, 0, 0);
    const pts = arcPoints(start, end, 1, 8);
    assert.equal(pts.length, 9);
    assert.ok(pts[0].equals(start) && pts[8].equals(end));
});

test("arcPoints' midpoint bulges by the sagitta, anticlockwise for a positive one", () => {
    // Chord along +x; turned 90 degrees anticlockwise in XZ, (dx, dz) -> (-dz, dx), is +z.
    const pts = arcPoints(new Vector3(0, 0, 0), new Vector3(4, 0, 0), 1, 8);
    close(pts[4].x, 2);
    close(pts[4].z, 1);
    const neg = arcPoints(new Vector3(0, 0, 0), new Vector3(4, 0, 0), -1, 8);
    close(neg[4].z, -1);
});

test("arcPoints keeps every point on one circle", () => {
    // Half-chord 2, sagitta 1: radius (1 + 4) / 2 = 2.5, centre at (2, 0, -1.5).
    for (const p of arcPoints(new Vector3(0, 0, 0), new Vector3(4, 0, 0), 1, 12))
        close(Math.hypot(p.x - 2, p.z + 1.5), 2.5);
});

test("arcPoints climbs evenly from the start's height to the end's", () => {
    const pts = arcPoints(new Vector3(0, 0, 0), new Vector3(4, 2, 0), 1, 4);
    pts.forEach((p, i) => close(p.y, i * 0.5));
});

test("getBottommostVertices keeps every vertex at the lowest y", () => {
    const low = [new Vector3(0, -1, 0), new Vector3(3, -1, 2)];
    const got = getBottommostVertices([new Vector3(1, 2, 0), low[0], new Vector3(0, 0, 0), low[1]]);
    assert.deepEqual(got, low);
    assert.deepEqual(getBottommostVertices([]), []);
});
