import { HemisphericLight, Vector3 } from "babylonjs";
import { LitElement } from "lit";
import { customElement } from "lit/decorators";
import { GardenScene } from "./Scene";

@customElement("garden-light")
export class GardenLight extends LitElement {
    createRenderRoot() {
        return this;
    }
    firstUpdated() {
        let sceneEl = this.parentElement as GardenScene;
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), sceneEl.scene);
    }
}