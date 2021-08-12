import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-box")
export class GardenBox extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        console.log(options)
        this.setMesh(
            MeshBuilder.CreateBox("box", options, scene)
        );
        super.updated();
    }
}