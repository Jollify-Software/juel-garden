import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-cylinder")
export class JuelCylinder extends GardenMesh {
    firstUpdated() {
        this.mesh = MeshBuilder.CreateCylinder("roof", this.buildOptions());
        this.modifyMesh();
    }
}