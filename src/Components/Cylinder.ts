import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A cylinder (or, with a low `tessellation`, a prism -- see {@link GardenColumn}
 * and the roof cone in {@link GardenHouse}), via Babylon's `MeshBuilder.CreateCylinder`.
 *
 * Attributes: `diameter`, `height`, `tessellation` (plus the common
 * {@link GardenMesh} set).
 *
 * @example
 * ```html
 * <garden-cylinder diameter="1" height="1.5" position="1 0.75 -3" colour="#FFC65D"></garden-cylinder>
 * ```
 *
 * @category Components
 */
@customElement("garden-cylinder")
export class GardenCylinder extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateCylinder(this.id ?? "cylinder", options, scene)
        );
        super.updated();
    }
}