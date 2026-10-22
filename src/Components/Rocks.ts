import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { Modifier } from "../Modifiers/Modifier";
import { rockMesh } from "../Nature/Rocks";
import { seededRandom } from "../Utils/noise";

/**
 * Rocks scattered over an area: `count` {@link rockMesh}es, each its own shape, scaled unevenly
 * into slabs and boulders, turned at random and sunk a little into the ground, then merged into
 * one mesh (one draw call).
 *
 * Attributes: `count` (default 12), `width` and `depth` (the area, centred on `position`;
 * default 10 by 10, or the whole of `ground`), `size` (the smallest and largest radius, default
 * `0.3 0.9`), `seed` (a different scatter; default 1), `ground` (a selector for a
 * `<garden-ground>` or `<garden-height-map>`: the rocks sit on its surface, and cover it unless
 * `width`/`depth` say otherwise). Plus the common {@link GardenMesh} set: `texture`,
 * `bump-texture` (a normal map), `colour`, their `-uscale`/`-vscale`, or a `<garden-material>`
 * child. With none of those the rocks are a plain weathered grey.
 *
 * @example
 * ```html
 * <garden-rocks ground="#hills" count="40" size="0.2 1.2" seed="7"
 *     texture="rock.jpg" bump-texture="rock-normal.jpg"></garden-rocks>
 * <garden-rocks position="5 0 -3" width="4" depth="4" count="6"></garden-rocks>
 * ```
 *
 * @category Components
 */
@customElement("garden-rocks")
export class GardenRocks extends GardenMesh {
    /** The rocks' colour when nothing else gives them one. */
    static DEFAULT_COLOUR = "#8a8580";

    @property({ type: Number }) count: number;
    @property({ type: Number }) width: number;
    @property({ type: Number }) depth: number;
    @property() size: string;
    @property({ type: Number }) seed: number;
    @property() ground: string;

    /** Its shape is sat on the ground where it is, so under a new parent it's built again. */
    protected moved() {
        this.updated();
    }

    async updated() {
        let scene = this.getScene();
        if (!scene) return;
        this.beginBuild();
        try {
            let ground: Mesh & { getHeightAtCoordinates?(x: number, z: number): number } = null;
            if (this.ground) {
                await GardenElement.whenDocumentReady();
                let [groundEl] = await GardenElement.resolveReady<GardenMesh>(this.ground);
                ground = groundEl?.mesh;
                if (!ground)
                    console.warn(`<garden-rocks ground="${this.ground}"> names no ground; scattering on the flat.`);
            }

            let box = ground?.getBoundingInfo().boundingBox;
            let centre = this.position?.clone()
                ?? (box ? new Vector3(box.centerWorld.x, 0, box.centerWorld.z) : Vector3.Zero());
            let width = this.width > 0 ? this.width : box ? box.maximumWorld.x - box.minimumWorld.x : 10;
            let depth = this.depth > 0 ? this.depth : box ? box.maximumWorld.z - box.minimumWorld.z : 10;
            let [small, large] = (this.size ?? "0.3 0.9").trim().split(/[\s,]+/).map(Number);
            if (!(small > 0)) small = 0.3;
            if (!(large >= small)) large = small;
            let count = this.count >= 0 ? Math.floor(this.count) : 12;
            let seed = this.seed ?? 1;
            let rand = seededRandom(seed * 7919 + 1);
            // The element's own frame (its `rotation` and `scale` turn the scatter too), so each rock
            // is sat on the ground under where it will end up, not where it would be unturned.
            // (Read as the mesh gets them, a parent element's share included: Modifier.transformOf.)
            let given = Modifier.transformOf(this), scale = given.scaling ?? Vector3.One();
            // With no `position`, the area is centred on the ground (or the origin) in the world, so under
            // a `parent`-tagged element, whose node the mesh is parented to, that centre is turned into
            // the node's own frame (else the parent's place would move the rocks off the ground).
            let holder = this.parentElement?.hasAttribute("parent") ? (<GardenElement>this.parentElement).getNode?.() : null;
            let place = given.position
                ?? (holder ? Vector3.TransformCoordinates(centre, holder.computeWorldMatrix(true).clone().invert()) : centre);
            // Under a `parent`-tagged element that frame is the parent node's (Modifier.worldFrameOf).
            let { frame, yScale } = Modifier.worldFrameOf(this,
                Matrix.Compose(scale, Quaternion.FromEulerVector(given.rotation ?? Vector3.Zero()), place));
            // How far above the element's own plane the ground is under a point of it (none without `ground`).
            let liftAt = (at: Vector3) => {
                if (!ground) return 0;
                let y = ground.getHeightAtCoordinates?.(at.x, at.z);
                return ((Number.isFinite(y) ? y : box.maximumWorld.y) - at.y) / yScale;
            };

            let rocks: Mesh[] = [];
            for (let i = 0; i < count; i++) {
                let r = small + (large - small) * rand() * rand(); // more small ones than big
                let rock = rockMesh(scene, r, seed * 31 + i * 3.7, "rock");
                rock.scaling.set(1 + rand() * 0.4, 0.6 + rand() * 0.4, 1 + rand() * 0.3);
                rock.rotation.y = rand() * Math.PI * 2;
                let x = (rand() - 0.5) * width, z = (rand() - 0.5) * depth;
                let at = Vector3.TransformCoordinates(new Vector3(x, 0, z), frame);
                // Sunk by a sixth of its height, relative to the element's own position.
                rock.position.set(x, liftAt(at) - r * rock.scaling.y * 0.15, z);
                rocks.push(rock);
            }
            let merged = rocks.length ? Mesh.MergeMeshes(rocks, true, true) : new Mesh("rocks", scene);
            merged.name = this.id || "rocks";
            merged.isPickable = false;
            let material = new StandardMaterial("rocks", scene);
            material.diffuseColor = Color3.FromHexString(GardenRocks.DEFAULT_COLOUR);
            material.specularColor = new Color3(0.04, 0.04, 0.04);
            material.maxSimultaneousLights = 8;
            merged.material = material;
            this.setMesh(merged);
            merged.position.copyFrom(place);
            super.updated();
        } finally {
            this.endBuild();
        }
    }
}
