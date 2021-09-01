import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-torus")
export class GardenTorus extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateTorus("torus", options, scene)
        );
        super.updated();
    } 
}