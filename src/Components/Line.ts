import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-line")
export class JuelLine extends GardenMesh {
    createMesh() {
        this.mesh = MeshBuilder.CreateLines("triangle", <any>this.buildOptions(), this.getScene());
    }
}