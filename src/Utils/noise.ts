/**
 * Smooth value noise, 0 to 1, over the plane: whole-number corners get a random value each,
 * blended smoothly between. For rocks, ragged texture edges, brightness that varies over the
 * ground. Repeatable (no seed needed: shift `x` and `z`).
 *
 * @category Utilities
 */
export function noise(x: number, z: number): number {
    let xi = Math.floor(x), zi = Math.floor(z);
    let xf = x - xi, zf = z - zi;
    let u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    let a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function hash(x: number, z: number): number {
    let s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/** 0 below `a`, 1 above `b`, and a smooth S-curve between. */
export function smoothstep(a: number, b: number, v: number): number {
    let t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

/** A repeatable dice, 0 to 1 (Park-Miller). */
export function seededRandom(seed: number): () => number {
    let s = Math.max(1, Math.floor(seed)) % 2147483647;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
