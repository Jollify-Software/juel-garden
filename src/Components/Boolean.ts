import { CSG } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-boolean")
export class JuelBoolean extends GardenMesh {
    @property() subtract: string;

    updated() {
        setTimeout(() => {
        if ('mesh' in this.parentElement) {
            let scene = this.getScene();
            let csg = CSG.FromMesh((<GardenMesh>this.parentElement).mesh);
            
            if (this.subtract) {
                let otherMesh = document.getElementById(this.subtract) as GardenMesh;
                this.setMesh(csg.subtract(
                   CSG.FromMesh(otherMesh.mesh)
                ).toMesh(this.id ?? "csg", null, scene));
            }

            this.modifyMesh()
        }
    });
    }
}