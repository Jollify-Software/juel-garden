import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-cylinder")
export class GardenCylinder extends GardenMesh {
    updated() {
        this.setMesh(
            MeshBuilder.CreateCylinder("roof", this.buildOptions(), this.getScene())
        );
    }
}