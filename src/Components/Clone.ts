import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-clone")
export class JuelClone extends GardenMesh {
    updated() {
        let parent = this.parentElement as GardenMesh;
        if ('mesh' in parent) {
            this.setMesh(
                parent.mesh.clone(this.id ?? "clone")
            );
            let childAnimations = (<HTMLElement[]>Array.prototype.slice.call(parent.children))
                .filter(el => el.nodeName == "JUEL-ANIMATION")
            if (childAnimations && childAnimations.length > 0) {
                for (var el of childAnimations) {
                    this.appendChild(el.cloneNode());
                }
            }
        }
    }
}