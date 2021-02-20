import { customElement, html } from "lit-element";
import { GardenElement } from "../../GardenElement";

@customElement("juel-house")
export class JuelHouse extends GardenElement {
    render() {
        return html`
        <juel-box position="0 0.5 0"
                texture="https://assets.babylonjs.com/environments/cubehouse.png"
                faceuv="0.5 0.0 0.75 1.0,0.0 0.0 0.25 1.0,0.25 0 0.5 1.0,0.75 0 1.0 1.0" wrap="true">

                <juel-cylinder position="0 0.72 0" scale="-0.25 0 0" rotation="0 0 90"
                    diameter="1.3" height="1.2" tessellation="3"
                    texture="https://assets.babylonjs.com/environments/roof.jpg"></juel-cylinder>
            </juel-box>
        `;
    }
}