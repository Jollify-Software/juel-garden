import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A rectangular prism, via Babylon's `MeshBuilder.CreateBox`.
 *
 * Attributes: `width`, `height`, `depth` (plus everything {@link GardenMesh}
 * already provides -- `position`, `rotation`, `colour`, `texture`, ...).
 *
 * @example
 * ```html
 * <garden-box width="2" height="1" depth="1" position="0 0.5 0" colour="#4CC3D9"></garden-box>
 * ```
 *
 * @category Components
 */
@customElement("garden-box")
export class GardenBox extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateBox("box", options, scene)
        );
        super.updated();
    }
}