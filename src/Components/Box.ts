import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-box")
export class JuelBox extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateBox("box", options, scene)
        );
    }
}