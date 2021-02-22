import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-clone")
export class JuelClone extends GardenMesh {
    update() {
        let parent = this.parentElement;
        if ('mesh' in parent) {
            console.log((<GardenMesh>parent).mesh)
            this.mesh = (<GardenMesh>parent).mesh.clone(this.id ?? "clone");
            this.modifyMesh()
        }
    }
}