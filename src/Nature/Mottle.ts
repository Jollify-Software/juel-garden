import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { noise as valueNoise } from "../Utils/noise";

/**
 * Varies a mesh's brightness over its surface with vertex colours (`scales` in metres, each
 * adding `amount` of noise), so a tiled ground texture doesn't read as a repeat. Warms the
 * shadows a touch (`warmth`). `noise` defaults to the value noise in `src/Utils/noise.ts`.
 *
 * @example
 * ```ts
 * mottle(ground, { scales: [3, 12], amounts: [0.15, 0.1], warmth: 0.05 });
 * ```
 *
 * @category Nature
 */
export function mottle(mesh: Mesh, options: { scales?: number[], amounts?: number[], base?: number, warmth?: number, noise?: (x: number, z: number) => number } = {}) {
    let noise = options.noise ?? valueNoise;
    let scales = options.scales ?? [23, 7], amounts = options.amounts ?? [0.22, 0.08];
    let base = options.base ?? 0.82, warmth = options.warmth ?? 0.03;
    let p = mesh.getVerticesData(VertexBuffer.PositionKind);
    let colours: number[] = [];
    for (let i = 0; i < p.length; i += 3) {
        let v = base;
        scales.forEach((s, k) => v += noise(p[i] / s, p[i + 2] / s) * amounts[k]);
        colours.push(v, v * (1 - warmth * 0.7), v * (1 - warmth * 1.6), 1);
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colours);
}
