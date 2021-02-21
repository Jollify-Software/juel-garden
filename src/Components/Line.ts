import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-line")
export class JuelLine extends GardenMesh {
    firstUpdated() {
        this.mesh = MeshBuilder.CreateLines("triangle", <any>this.buildOptions(), this.getScene());
        this.modifyMesh();
    }
}