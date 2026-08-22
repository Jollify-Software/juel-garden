import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A ring/donut shape, via Babylon's `MeshBuilder.CreateTorus`.
 *
 * Attributes: `diameter`, `thickness`, `tessellation` (plus the common
 * {@link GardenMesh} set).
 *
 * @example
 * ```html
 * <garden-torus diameter="2" thickness="0.3" position="0 1 0" colour="gray"></garden-torus>
 * ```
 *
 * @category Components
 */
@customElement("garden-torus")
export class GardenTorus extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateTorus(this.id ?? "torus", options, scene)
        );
        super.updated();
    } 
}