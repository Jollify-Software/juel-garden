import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A cheap duplicate of the parent element's mesh (via Babylon `Mesh.clone`),
 * including any `<garden-animation>` children -- useful for repeating a
 * hand-tuned shape without rebuilding its geometry from scratch.
 *
 * @example
 * ```html
 * <garden-box id="original" width="1" height="1" depth="1">
 *   <garden-clone position="2 0 0"></garden-clone>
 * </garden-box>
 * ```
 *
 * @category Components
 */
@customElement("garden-clone")
export class GardenClone extends GardenMesh {
    updated() {
        let parent = this.parentElement as GardenMesh;
        if ('mesh' in parent) {
            this.setMesh(
                parent.mesh.clone(this.id ?? "clone")
            );
            let childAnimations = (<HTMLElement[]>Array.prototype.slice.call(parent.children))
                .filter(el => el.nodeName == "GARDEN-ANIMATION")
            if (childAnimations && childAnimations.length > 0) {
                for (var el of childAnimations) {
                    this.appendChild(el.cloneNode());
                }
            }
        }
    }
}