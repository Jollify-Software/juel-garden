import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-box")
export class JuelBox extends GardenMesh {
    createRenderRoot() {
        return this;
    }
    firstUpdated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.mesh = MeshBuilder.CreateBox("box", options, scene);
        this.modifyMesh();
    }
}