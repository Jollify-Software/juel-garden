import { Color3 } from "@babylonjs/core/Maths/math.color";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3Convert } from "../Converters/Color3Convert";
import { customElement } from "lit/decorators.js";
import { GardenMesh } from "../GardenMesh";

/**
 * A polyline, via Babylon's `MeshBuilder.CreateLines`. Also doubles as the
 * path a `<garden-... track>` behaviour follows -- see
 * {@link BehaviourTrack}, which reads this element's own `points` attribute
 * off its parent.
 *
 * Attributes: `points` (a `Vector3` array, see {@link Vector3Convert.array};
 * repeat the first point last for a closed loop) (plus the common
 * {@link GardenMesh} set -- though a line has no fill, so `colour` there
 * controls the line colour).
 *
 * @example
 * ```html
 * <garden-line points="0 0 0, 5 0 0, 5 0 5, 0 0 5, 0 0 0"></garden-line>
 * ```
 *
 * @category Components
 */
@customElement("garden-line")
export class GardenLine extends GardenMesh {
    updated() {
        let lines = MeshBuilder.CreateLines("triangle", <any>this.buildOptions(), this.getScene());
        this.setMesh(lines);
        // A line draws with its own shader and `color`, not a material's diffuse colour.
        let colour = this.getAttribute("colour")?.trim();
        if (colour && this.mesh instanceof LinesMesh)
            this.mesh.color = colour.startsWith("#") ? Color3.FromHexString(colour) : Color3Convert.fromString(colour) ?? this.mesh.color;
    }
}