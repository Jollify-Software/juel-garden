import { CSG, MeshBuilder, Scene, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Vector3Convert } from "../../Converters/Vector3Convert";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-opening")
export class GardenDoorway extends GardenMesh {
    @property() type: string = "square";
    @property() between: string;
    @property({ type: Boolean }) step: boolean = false;
    @property({ type: Number }) width: number;
    @property({ type: Number }) height: number;
    @property({ type: Number }) depth: number;

    @property({ converter: Vector3Convert.fromString }) position: Vector3;

    updated() {
        if (this.between) {
            setTimeout(() => {
            let scene = this.getScene();
            
        switch (this.type) {
            case "square":
                this.mesh = MeshBuilder.CreateBox("opening", {
                    width: this.width,
                    height: this.height,
                    depth: this.depth
                }, scene);
                break;
        
            default:
                break;
        }
        if (this.position) {
            this.mesh.position = this.position.add(
                this.step ? new Vector3(0, 0.2, 0) : new Vector3(0, 0.01, 0)
            );
        }

        this.mesh.isVisible = false;
        let thisCsg = CSG.FromMesh(this.mesh);

        let splitty = this.between.split(' ');
        for (let id of splitty) {
            let el = document.getElementById(id) as GardenMesh;
            if (el) {
                let thatCsg = CSG.FromMesh(el.mesh);
                let mat = el.getMaterial();
                el.mesh.dispose();
                el.setMesh(
                    thatCsg.subtract(thisCsg).toMesh(el.id, mat, scene, true)
                );
            }
        }
    });
        }
 
    }
}