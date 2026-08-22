import { MeshBuilder } from "babylonjs";
import { GardenMesh } from "../GardenMesh";
import earcut from "earcut";
import { customElement, property } from "lit/decorators";

/**
 * An extruded 2D polygon, via Babylon's `MeshBuilder.ExtrudePolygon`
 * (triangulated with `earcut`). Only builds when `extrude` is set.
 *
 * Attributes: `extrude` (boolean, must be present to build), `shape` (the
 * polygon outline, a `Vector3` array -- see {@link Vector3Convert.array}),
 * `depth` (plus the common {@link GardenMesh} set).
 *
 * @category Components
 */
@customElement("garden-polygon")
export class GardenExtrude extends GardenMesh {
    @property({ type: Boolean }) extrude = false;

    updated() {
        if (this.extrude == true) {
            this.setMesh(
                MeshBuilder.ExtrudePolygon(
                this.id ?? "extrude",
                <any>this.buildOptions(),
                this.getScene(),
                earcut
            )
            );
        }
    }
}