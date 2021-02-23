import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-sphere")
export class JuelSphere extends GardenMesh {
    updated() {
        this.setMesh(
            MeshBuilder.CreateSphere(this.id ?? "sphere", this.buildOptions(), this.getScene())
        );
    }
}