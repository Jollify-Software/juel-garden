import { HemisphericLight, Vector3 } from "babylonjs";
import { customElement, LitElement } from "lit-element";
import { JuelScene } from "./Scene";

@customElement("juel-light")
export class JuelLight extends LitElement {
    createRenderRoot() {
        return this;
    }
    firstUpdated() {
        let sceneEl = this.parentElement as JuelScene;
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), sceneEl.scene);
    }
}