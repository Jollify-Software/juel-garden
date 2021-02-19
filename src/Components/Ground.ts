import { customElement, LitElement } from "lit-element";
import { OptionsBuilder } from "../Options/OptionsBuilder";

@customElement("juel-ground")
export class JuelGround extends LitElement {
    createRenderRoot() {
        return this;
    }
    firstUpdated() {
        let options = OptionsBuilder.build(this)
        let ground = BABYLON.MeshBuilder.CreateGround("ground", options);
    }
}