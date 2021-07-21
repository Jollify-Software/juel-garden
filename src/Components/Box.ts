import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-box")
export class GardenBox extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateBox("box", options, scene)
        );
    }
}