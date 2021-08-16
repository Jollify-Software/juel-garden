import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-plane")
export class GardenPlane extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        console.log(options)
        this.setMesh(
            MeshBuilder.CreatePlane(this.id ?? "plane", options, scene)
        );
        super.updated();
    }
}