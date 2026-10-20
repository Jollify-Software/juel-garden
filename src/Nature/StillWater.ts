import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";

/** How {@link StillWater} looks. */
export interface StillWaterOptions {
    position: Vector3;
    radius: number;
    /** The water's own colour (dark, so the sky's light doesn't wash it out). Default `#0b1724`. */
    colour?: string;
    /** How strong the ripples are (0 flat … 1). Default 0.25. */
    ripples?: number;
    /** How strong the mirror is once `reflect()` turns it on (0 … 1). Default 0.4. */
    mirror?: number;
}

/**
 * A still pool or lake: a dark disc with slow ripples (a normal map drawn in code) and a soft
 * sheen. `reflect()` turns its mirror on (everything in the scene then, or `only` those meshes
 * you give; never the ground under it unless you list it), so a big scene pays for the mirror
 * only once the water comes into view.
 *
 * @example
 * ```ts
 * const pond = new StillWater(scene, { position: new Vector3(20, -1.2, 40), radius: 9 });
 * pond.reflect((m) => m.name != "ground");
 * ```
 *
 * @category Nature
 */
export class StillWater {
    readonly mesh: Mesh;
    readonly material: StandardMaterial;
    private ripples: Texture;
    private mirrorTexture: MirrorTexture = null;
    private observer: Observer<Scene>;

    constructor(private scene: Scene, private options: StillWaterOptions) {
        let r = options.radius;
        this.mesh = MeshBuilder.CreateDisc("water", { radius: r, tessellation: 64 }, scene);
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.position.copyFrom(options.position);
        this.mesh.isPickable = false;
        let m = this.material = new StandardMaterial("water-m", scene);
        m.diffuseColor = Color3.FromHexString(options.colour ?? "#0b1724");
        // A soft sheen only: a strong one washes a flat pool out under a bright sky light.
        m.specularColor = new Color3(0.12, 0.13, 0.16);
        m.specularPower = 64;
        m.emissiveColor = m.diffuseColor.scale(0.7);
        m.alpha = 0.95;
        m.maxSimultaneousLights = 8;
        this.ripples = new Texture(rippleNormals(), scene);
        this.ripples.uScale = this.ripples.vScale = r / 2.5;
        m.bumpTexture = this.ripples;
        m.bumpTexture.level = options.ripples ?? 0.25;
        this.mesh.material = m;
        this.observer = scene.onBeforeRenderObservable.add(() => {
            let t = performance.now() / 1000;
            this.ripples.uOffset = t * 0.012;
            this.ripples.vOffset = Math.sin(t * 0.2) * 0.02;
        });
    }

    /** Turns the mirror on: every enabled mesh now but the water, or those `only` accepts. */
    reflect(only?: (mesh: AbstractMesh) => boolean): MirrorTexture {
        if (this.mirrorTexture) return this.mirrorTexture;
        let mirror = this.mirrorTexture = new MirrorTexture("water-mirror", 512, this.scene, true);
        // The surface, facing up (Babylon's mirror plane faces down, so its normal is -y).
        mirror.mirrorPlane = new Plane(0, -1, 0, this.mesh.position.y);
        mirror.renderList = this.scene.meshes.filter(m => m != this.mesh && m.isEnabled() && (only ? only(m) : true));
        mirror.level = this.options.mirror ?? 0.4;
        this.material.reflectionTexture = mirror;
        return mirror;
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.mirrorTexture?.dispose();
        this.mesh.dispose(false, true);
    }
}

/** A tile of gentle ripples as a normal map: overlapping sine waves, wrapped so it repeats. */
function rippleNormals(size = 256): string {
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");
    let img = ctx.createImageData(size, size);
    let h = (x: number, y: number) => {
        let u = (x / size) * Math.PI * 2, v = (y / size) * Math.PI * 2;
        return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 5 - v * 4 + 1.3) * 0.3 + Math.sin(-u * 2 + v * 7 + 0.4) * 0.2;
    };
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            let dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
            let k = (y * size + x) * 4;
            img.data[k] = Math.round((0.5 - dx * 2) * 255);
            img.data[k + 1] = Math.round((0.5 - dy * 2) * 255);
            img.data[k + 2] = 255;
            img.data[k + 3] = 255;
        }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
}
