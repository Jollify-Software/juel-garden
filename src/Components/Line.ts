import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
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
        this.setMesh(
            MeshBuilder.CreateLines("triangle", <any>this.buildOptions(), this.getScene())
        );
    }
}