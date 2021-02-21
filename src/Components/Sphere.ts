import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-sphere")
export class JuelSphere extends GardenMesh {
    firstUpdated() {
        this.mesh = MeshBuilder.CreateSphere(this.id ?? "sphere", this.buildOptions(), this.getScene());
        this.modifyMesh();
    }
}