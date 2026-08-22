import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";
import { OptionsBuilder } from "../Options/OptionsBuilder";

/**
 * A flat ground plane, via Babylon's `MeshBuilder.CreateGround`. The default
 * teleport target for `<garden-webxr>` (see {@link GardenWebXR}) when no
 * `floor` attribute is given.
 *
 * Attributes: `width`, `height`, `subdivisions` (plus the common
 * {@link GardenMesh} set, notably `collisions`).
 *
 * @example
 * ```html
 * <garden-ground width="150" height="160" colour="green" collisions></garden-ground>
 * ```
 *
 * @category Components
 */
@customElement("garden-ground")
export class GardenGround extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateGround(this.id ?? "ground", options, scene)
        );
        super.updated();
    }
}