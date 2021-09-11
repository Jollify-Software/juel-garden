import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-cylinder")
export class GardenCylinder extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateCylinder(this.id ?? "cylinder", options, scene)
        );
        super.updated();
    }
}