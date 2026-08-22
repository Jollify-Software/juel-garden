import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A lathed (revolved-profile) mesh, via Babylon's `MeshBuilder.CreateLathe` --
 * sweeps a 2D `shape` profile around the Y axis, e.g. a vase or fountain bowl.
 *
 * Attributes: `shape` (a `Vector3` array profile, see {@link Vector3Convert.array}),
 * `tessellation`, `sideorientation` (plus the common {@link GardenMesh} set).
 *
 * @category Components
 */
@customElement("garden-lathe")
export class GardenLathe extends GardenMesh {
    updated() {
        let scene = this.getScene();
        this.setMesh(
            MeshBuilder.CreateLathe("fountain", <any>this.buildOptions(), scene)
        );
    }
}