import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { GardenMesh } from "../GardenMesh";
import earcut from "earcut";
import { customElement, property } from "lit/decorators.js";

/**
 * An extruded 2D polygon, via Babylon's `MeshBuilder.ExtrudePolygon`
 * (triangulated with `earcut`). Only builds when `extrude` is set.
 *
 * Attributes: `extrude` (boolean, must be present to build), `shape` (the
 * polygon outline, a `Vector3` array -- see {@link "Converters/Vector3Convert"!Vector3Convert.array}),
 * `depth` (plus the common {@link GardenMesh} set). The outline may wind
 * either way round; it's turned so the sides face out.
 *
 * @category Components
 */
@customElement("garden-polygon")
export class GardenExtrude extends GardenMesh {
    @property({ type: Boolean }) extrude = false;

    updated() {
        if (this.extrude == true) {
            let options = <any>this.buildOptions();
            // ExtrudePolygon builds its sides facing out only for one winding (x, z
            // counter-clockwise, x right and z up); the other way round they face in
            // and are culled, so the block shows only its top. Accept either.
            if (Array.isArray(options.shape) && GardenExtrude.signedArea(options.shape) < 0)
                options.shape = options.shape.slice().reverse();
            this.setMesh(
                MeshBuilder.ExtrudePolygon(
                this.id ?? "extrude",
                options,
                this.getScene(),
                earcut
            )
            );
        }
    }

    /** Twice the signed area of an x,z outline: positive when counter-clockwise (x right, z up). */
    static signedArea(shape: { x: number, z: number }[]): number {
        let sum = 0;
        for (let i = 0; i < shape.length; i++) {
            let a = shape[i], b = shape[(i + 1) % shape.length];
            sum += a.x * b.z - b.x * a.z;
        }
        return sum;
    }
}