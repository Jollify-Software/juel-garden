import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";

/** One sky for {@link PanoramaSky}. */
export interface Panorama {
    /** An equirectangular (2:1) sky image. */
    url: string;
    /** Multiplies its colours: below 1 darkens a daylight photo to evening. Default white. */
    tint?: Color3;
}

/**
 * A sky from photographs: one or two panoramas on domes round the camera, cross-fading from
 * the first to the second (`blend`, 0 to 1: a storm clearing to dusk, day to night). Thick fog
 * hides them (`haze`: from fog density `hazeFrom`, gone by `hazeFrom + hazeRange`), with the
 * scene's clear colour set to the fog colour behind them, so a dust storm or a mist swallows
 * the sky. `flash()` lights the first one up for a moment (lightning).
 *
 * The domes are unlit and not fogged: with lighting off the emissive colour is what shows the
 * picture, so `tint` is the emissive colour.
 *
 * @example
 * ```ts
 * const sky = new PanoramaSky(scene, { url: "storm.jpg", tint: new Color3(0.5, 0.5, 0.58) }, { url: "dusk.jpg" });
 * lightning.addEventListener("garden-lightning", () => sky.flash());
 * sky.blend = 1; // or ease it over time
 * ```
 *
 * @category Nature
 */
export class PanoramaSky {
    /** 0 the first panorama … 1 the second. */
    blend = 0;
    hazeFrom = 0.02;
    hazeRange = 0.06;
    readonly domes: { mesh: Mesh, material: StandardMaterial, tint: Color3 }[] = [];
    private flashing = 0;
    private observer: Observer<Scene>;

    constructor(private scene: Scene, first: Panorama, second?: Panorama, size = 900) {
        // The second behind the first, so the first fades over it.
        for (let [i, p] of [first, second].entries()) {
            if (!p) continue;
            let mesh = MeshBuilder.CreateSphere(`sky-${i}`, { diameter: size + i * 40, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene);
            mesh.infiniteDistance = true;
            mesh.isPickable = false;
            let material = new StandardMaterial(`sky-${i}-m`, scene);
            let texture = new Texture(p.url, scene);
            // Seen from inside: flip it so it reads the right way round.
            texture.uScale = -1;
            material.diffuseTexture = texture;
            material.disableLighting = true;
            material.diffuseColor = Color3.Black();
            material.specularColor = Color3.Black();
            material.fogEnabled = false;
            material.backFaceCulling = false;
            mesh.material = material;
            mesh.alphaIndex = i == 0 ? 1 : 0;
            this.domes.push({ mesh, material, tint: p.tint ?? Color3.White() });
        }
        this.observer = scene.onBeforeRenderObservable.add(() => this.update());
    }

    /** Lightning: the first sky lights up, then fades. */
    flash() {
        this.flashing = 1;
    }

    private update() {
        let dt = Math.min(this.scene.getEngine().getDeltaTime(), 50) / 1000;
        this.flashing = Math.max(0, this.flashing - dt * 2.2);
        let f = this.flashing * (Math.random() * 0.3 + 0.7);
        let haze = this.scene.fogMode ? Math.min(1, Math.max(0, (this.scene.fogDensity - this.hazeFrom) / this.hazeRange)) : 0;
        if (this.scene.fogMode) {
            let fog = this.scene.fogColor;
            this.scene.clearColor.set(fog.r, fog.g, fog.b, 1);
        }
        this.domes.forEach((d, i) => {
            let t = d.tint, lit = i == 0 ? f : 0;
            d.material.emissiveColor.set(t.r + (1 - t.r) * lit, t.g + (1 - t.g) * lit, t.b + (1 - t.b) * lit);
            let v = (this.domes.length == 1 ? 1 : i == 0 ? 1 - this.blend : this.blend) * (1 - haze);
            d.mesh.visibility = v;
            d.mesh.setEnabled(v > 0.002);
        });
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        for (let d of this.domes) d.mesh.dispose(false, true);
    }
}
