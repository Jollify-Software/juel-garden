import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A single flat quad, via Babylon's `MeshBuilder.CreatePlane`.
 *
 * Attributes: `width`, `height`, `sideorientation` (`"default"|"front"|"back"|"double"`)
 * (plus the common {@link GardenMesh} set).
 *
 * @example
 * ```html
 * <garden-plane width="4" height="2" position="0 1 0" texture="poster.jpg"></garden-plane>
 * ```
 *
 * @category Components
 */
@customElement("garden-plane")
export class GardenPlane extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        console.log(options)
        this.setMesh(
            MeshBuilder.CreatePlane(this.id ?? "plane", options, scene)
        );
        super.updated();
    }
}