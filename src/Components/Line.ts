import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-line")
export class GardenLine extends GardenMesh {
    updated() {
        this.setMesh(
            MeshBuilder.CreateLines("triangle", <any>this.buildOptions(), this.getScene())
        );
    }
}