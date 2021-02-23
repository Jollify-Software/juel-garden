import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-cylinder")
export class JuelCylinder extends GardenMesh {
    updated() {
        this.setMesh(
            MeshBuilder.CreateCylinder("roof", this.buildOptions(), this.getScene())
        );
    }
}