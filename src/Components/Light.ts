import { PointLight, HemisphericLight, Vector3 } from "babylonjs";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { Color3Convert } from "../Converters/Color3Convert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenScene } from "./Scene";

@customElement("garden-light")
export class GardenLight extends GardenElement {
    @property() type: string;
    @property({ converter: Vector3Convert.fromString }) position: Vector3;

    light: any;
    
    constructor() {
        super();
        this.type = "hemi";
        this.position = new Vector3(0, 1, 0);
    }
    updated() {
        let scene = this.getScene();

        switch (this.type) {
            case "hemi":
                this.light = new HemisphericLight("light", this.position, scene);
                break;
            case "point":
                this.light = new PointLight("light", this.position, scene);
                break;
        }
        let opt = this.buildOptions();
        this.light = Object.assign(this.light, opt);
    }
}