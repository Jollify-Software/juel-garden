import { MeshBuilder } from "babylonjs";
import { customElement, LitElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";
import { Modifier } from "../Modifiers/Modifier";
import { JuelScene } from "./Scene";

@customElement("juel-box")
export class JuelBox extends GardenMesh {
    createRenderRoot() {
        return this;
    }
    firstUpdated() {
        let sceneEl = this.parentElement as JuelScene;

        this.mesh = MeshBuilder.CreateBox("box", this.buildOptions(), sceneEl.scene);
        this.modifyMesh();
    }
}