import { PointLight, HemisphericLight, Vector3 } from "babylonjs";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { Color3Convert } from "../Converters/Color3Convert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenScene } from "./Scene";

/**
 * A scene light -- a Babylon `HemisphericLight` (`type="hemi"`, the default,
 * ambient sky/ground light) or `PointLight` (`type="point"`).
 *
 * Attributes: `type` (`"hemi"|"point"`, default `"hemi"`), `position`
 * (defaults to `0 1 0`), `diffuse` (colour, see {@link Color3Convert}).
 *
 * @example
 * ```html
 * <garden-light></garden-light>
 * <garden-light type="point" position="0 4 0" diffuse="1 0.9 0.8"></garden-light>
 * ```
 *
 * @category Components
 */
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