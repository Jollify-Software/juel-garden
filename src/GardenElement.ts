import { LitElement } from "lit-element";
import { OptionsBuilder } from "./Options/OptionsBuilder";

export class GardenElement extends LitElement {
    createRenderRoot() {
        return this;
    }
    buildOptions(): object {
        return OptionsBuilder.build(this);
    }
}