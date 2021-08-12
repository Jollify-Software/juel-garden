import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-sphere")
export class GardenSphere extends GardenMesh {
    updated() {
        this.setMesh(
            MeshBuilder.CreateSphere(this.id ?? "sphere", this.buildOptions(), this.getScene())
        );
    }
}