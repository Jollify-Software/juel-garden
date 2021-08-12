import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

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