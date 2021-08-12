import { Vector3 } from "babylonjs";
import { Mesh, MeshBuilder } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-column")
export class GardenColumn extends GardenMesh {
    @property({ type: Number }) height: number;
    @property({ type: String }) type: string;

    constructor() {
        super();
        this.type = "round";
    }

    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        let mesh: Mesh;
        switch (this.type) {
            case "round":
                mesh = MeshBuilder.CreateCylinder("roof", options, scene)
                break;
        
            default:
                break;
        }
        mesh.position = new Vector3(0, this.height/2, 0);
        this.setMesh(mesh);
    }
}