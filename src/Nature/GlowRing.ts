import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";

/**
 * A soft, bright rim lying on the ground round a circle: where a pool of light ends (with
 * `<garden-light pool>`), a safe zone, a goal. Brightest at the circle and fading either side,
 * unlit and glowing (it shows up under a GlowLayer), and following the ground's height (give
 * `height(x, z)`) so it never cuts into a slope. Move and size it with `update()` each frame;
 * fade it with `level`.
 *
 * @example
 * ```ts
 * const rim = new GlowRing(scene, { colour: "#ffd27a", height: (x, z) => ground.getHeightAtCoordinates(x, z) });
 * scene.onBeforeRenderObservable.add(() => rim.update(guide.position.x, guide.position.z, 6));
 * ```
 *
 * @category Nature
 */
export class GlowRing {
    readonly mesh: Mesh;
    readonly material: StandardMaterial;
    private segments: number;
    private width: number;
    private height: (x: number, z: number) => number;
    private brightness = 1;

    constructor(scene: Scene, options: { colour?: string, width?: number, segments?: number, height?: (x: number, z: number) => number, name?: string } = {}) {
        this.segments = options.segments ?? 72;
        this.width = options.width ?? 0.9;
        this.height = options.height ?? (() => 0);
        let name = options.name ?? "glow-ring";
        this.mesh = MeshBuilder.CreateRibbon(name, { pathArray: this.paths(0, 0, 5), updatable: true, closePath: true }, scene);
        let colours: number[] = [];
        for (let a of [0, 1, 0]) for (let i = 0; i < this.segments; i++) colours.push(1, 1, 1, a);
        this.mesh.setVerticesData(VertexBuffer.ColorKind, colours);
        this.mesh.hasVertexAlpha = true;
        let m = this.material = new StandardMaterial(`${name}-m`, scene);
        m.disableLighting = true;
        m.emissiveColor = Color3.FromHexString(options.colour ?? "#ffd27a");
        m.backFaceCulling = false;
        m.alpha = 0.999;
        this.mesh.material = m;
        this.mesh.isPickable = false;
    }

    private paths(cx: number, cz: number, r: number): Vector3[][] {
        return [r - this.width, r, r + this.width * 0.4].map(rr => {
            let path: Vector3[] = [];
            for (let i = 0; i < this.segments; i++) {
                let a = (i / this.segments) * Math.PI * 2;
                let x = cx + Math.sin(a) * rr, z = cz + Math.cos(a) * rr;
                path.push(new Vector3(x, this.height(x, z) + 0.07, z));
            }
            return path;
        });
    }

    /** Centres it on (`x`, `z`) with radius `r`, along the ground. */
    update(x: number, z: number, r: number) {
        MeshBuilder.CreateRibbon("", { pathArray: this.paths(x, z, r), instance: this.mesh });
    }

    /** 0 hidden … 1 full. */
    set level(v: number) {
        this.brightness = v;
        this.mesh.visibility = v;
        this.mesh.setEnabled(v > 0.01);
    }

    get level(): number {
        return this.brightness;
    }
}
