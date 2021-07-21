import { CSG } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-boolean")
export class GardenBoolean extends GardenMesh {
    @property() subtract: string;
    @property() subtractTo: string;
    @property() intersect: string;

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
            } else if (this.subtractTo) {
                let otherMesh = document.getElementById(this.subtractTo) as GardenMesh;
                let otherCsg = CSG.FromMesh(otherMesh.mesh);
                otherMesh.setMesh(otherCsg.subtract(
                   csg
                ).toMesh(otherMesh.id ?? "csg", null, scene));
            } else if (this.intersect) {
                let otherMesh = document.getElementById(this.intersect) as GardenMesh;
                this.setMesh(csg.intersect(
                   CSG.FromMesh(otherMesh.mesh)
                ).toMesh(this.id ?? "csg", null, scene));
            }

            this.modifyMesh()
        }
    });
    }
}