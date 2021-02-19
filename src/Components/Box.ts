import { MeshBuilder } from "babylonjs";
import { customElement, LitElement } from "lit-element";
import { JuelScene } from "./Scene";

@customElement("juel-box")
export class JuelBox extends LitElement {
    createRenderRoot() {
        return this;
    }
    firstUpdated() {
        let sceneEl = this.parentElement as JuelScene;

        const box = MeshBuilder.CreateBox("box", {}, sceneEl.scene);
    }
}