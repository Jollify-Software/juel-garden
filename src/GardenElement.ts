import { Scene } from "babylonjs";
import { LitElement } from "lit-element";
import { OptionsBuilder } from "./Options/OptionsBuilder";

export class GardenElement extends LitElement {
    getScene(): Scene {
        if ('getScene' in this.parentElement) {
            return (<any>this.parentElement).getScene();
        } else {
            return null;
        }
    }

    createRenderRoot() {
        return this;
    }
    buildOptions(): object {
        return OptionsBuilder.build(this);
    }
}