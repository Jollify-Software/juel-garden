import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { customElement, property } from "lit/decorators.js";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { Modifier } from "../Modifiers/Modifier";
import { arcPath, stoneWall } from "../Nature/Rocks";

/**
 * A dry-stone wall ({@link stoneWall}): tapering, with rough capstones along the top, either along
 * `points` or round a circle (a fold, a well) with a gateway.
 *
 * Attributes: `points` (the wall's line, relative to `position`, as on `<garden-line>`), or
 * `radius` for a ring round `position` with `gate` (the gateway's direction in degrees, 0 = +z,
 * 90 = +x; leave it off for a closed ring) and `gate-width` (default 1.2 m); `height` (default
 * 1.05), `foot-width` and `top-width` (default 0.72 and 0.54), `cap-every` (a capstone every so
 * many metres, default 0.55; 0 for none), `ground` (a selector for a `<garden-ground>` or
 * `<garden-height-map>`: the wall follows it up and down, each point's y then a height above
 * it). Plus the common {@link GardenMesh} set (`texture`, `bump-texture`, `colour`, their
 * `-uscale`/`-vscale`, or a `<garden-material>` child), which the capstones share. With none of
 * those it is a plain weathered grey.
 *
 * The capstones are `element.caps`, a child of the wall's mesh.
 *
 * @example
 * ```html
 * <garden-stone-wall points="0 0 0, 12 0 0, 12 0 8" ground="#hills" texture="wall.jpg"></garden-stone-wall>
 * <garden-stone-wall position="20 0 10" radius="5" gate="180" gate-width="1.5"></garden-stone-wall>
 * ```
 *
 * @category Components
 */
@customElement("garden-stone-wall")
export class GardenStoneWall extends GardenMesh {
    /** The wall's colour when nothing else gives it one. */
    static DEFAULT_COLOUR = "#8f8a80";

    @property() points: string;
    @property({ type: Number }) radius: number;
    @property({ type: Number }) gate: number;
    @property({ type: Number, attribute: "gate-width" }) gateWidth: number;
    @property({ type: Number }) height: number;
    @property({ type: Number, attribute: "foot-width" }) footWidth: number;
    @property({ type: Number, attribute: "top-width" }) topWidth: number;
    @property({ type: Number, attribute: "cap-every" }) capEvery: number;
    @property() ground: string;

    /** The capstones (null with `cap-every="0"`). */
    caps: Mesh = null;

    setMaterial(material: Material) {
        super.setMaterial(material);
        if (this.caps) this.caps.material = material;
    }

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
                    console.warn(`<garden-stone-wall ground="${this.ground}"> names no ground; building on the flat.`);
            }
            // Where the mesh will be, a parent element's share included (as for every mesh element).
            let given = Modifier.transformOf(this), scale = given.scaling ?? Vector3.One();
            let origin = given.position ?? Vector3.Zero();

            let path: Vector3[];
            if (this.radius > 0) {
                let gap = this.hasAttribute("gate") ? (this.gateWidth >= 0 ? this.gateWidth : 1.2) / this.radius : 0;
                let gate = (this.gate ?? 0) * Math.PI / 180;
                path = arcPath({ x: 0, z: 0 }, this.radius, gate + gap / 2, gate + Math.PI * 2 - gap / 2);
            } else {
                path = (this.points ? Vector3Convert.array(this.points) : []).filter(p => p && Number.isFinite(p.x))
                    .map(p => new Vector3(p.x, Number.isFinite(p.y) ? p.y : 0, Number.isFinite(p.z) ? p.z : 0));
                if (path.length < 2) {
                    console.warn(`<garden-stone-wall> needs \`points\` (two or more) or a \`radius\`.`);
                    return;
                }
                path = densify(path, 0.3);
            }
            if (ground) {
                let box = ground.getBoundingInfo().boundingBox;
                // The element's own frame (its `rotation` and `scale` turn the wall too), so the wall
                // follows the ground under where each point will end up, not where it would be unturned.
                // (Read as the mesh gets them, a parent element's share included: Modifier.transformOf.)
                // Under a `parent`-tagged element that frame is the parent node's (Modifier.worldFrameOf).
                let { frame, yScale } = Modifier.worldFrameOf(this,
                    Matrix.Compose(scale, Quaternion.FromEulerVector(given.rotation ?? Vector3.Zero()), origin));
                path = path.map(p => {
                    let at = Vector3.TransformCoordinates(new Vector3(p.x, 0, p.z), frame);
                    let y = ground.getHeightAtCoordinates?.(at.x, at.z);
                    return new Vector3(p.x, p.y + ((Number.isFinite(y) ? y : box.maximumWorld.y) - at.y) / yScale, p.z);
                });
            }

            let material = new StandardMaterial("stone-wall", scene);
            material.diffuseColor = Color3.FromHexString(GardenStoneWall.DEFAULT_COLOUR);
            material.specularColor = new Color3(0.04, 0.04, 0.04);
            material.maxSimultaneousLights = 8;
            let { wall, caps } = stoneWall(scene, path, {
                height: this.height > 0 ? this.height : undefined,
                footWidth: this.footWidth > 0 ? this.footWidth : undefined,
                topWidth: this.topWidth > 0 ? this.topWidth : undefined,
                capEvery: this.capEvery >= 0 ? this.capEvery : undefined,
                material, capMaterial: material,
            });
            wall.name = this.id || "stone-wall";
            if (caps) {
                caps.parent = wall;
                (<any>caps).element = this;
            }
            this.caps = caps;
            this.setMesh(wall);
            wall.position.copyFrom(origin);
            super.updated();
        } finally {
            this.endBuild();
        }
    }
}

/** `points` with extra points every `step` metres between them, so a wall can follow the ground. */
function densify(points: Vector3[], step: number): Vector3[] {
    let out: Vector3[] = [];
    for (let i = 0; i < points.length; i++) {
        if (i > 0) {
            let a = points[i - 1], b = points[i];
            let n = Math.floor(Vector3.Distance(a, b) / step);
            for (let k = 1; k < n; k++) out.push(Vector3.Lerp(a, b, k / n));
        }
        out.push(points[i]);
    }
    return out;
}
