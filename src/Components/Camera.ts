import { ArcRotateCamera, Vector3 } from "babylonjs";
import { customElement, LitElement } from "lit-element";
import { JuelScene } from "./Scene";

@customElement("juel-camera")
export class JuelCamera extends LitElement {

    createRenderRoot() {
        return this;
    }

    firstUpdated() {
        let sceneEl = this.parentElement as JuelScene
        let scene = sceneEl.scene
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), scene);
camera.attachControl(sceneEl.canvas, true);


    }
}