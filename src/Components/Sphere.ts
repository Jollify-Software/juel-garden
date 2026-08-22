import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A sphere, via Babylon's `MeshBuilder.CreateSphere`.
 *
 * Attributes: `diameter`, `segments` (plus the common {@link GardenMesh} set).
 *
 * @example
 * ```html
 * <garden-sphere diameter="2.5" position="0 1.25 -5" colour="#EF2D5E"></garden-sphere>
 * ```
 *
 * @category Components
 */
@customElement("garden-sphere")
export class GardenSphere extends GardenMesh {
    updated() {
        this.setMesh(
            MeshBuilder.CreateSphere(this.id ?? "sphere", this.buildOptions(), this.getScene())
        );
        super.updated();
    }
}