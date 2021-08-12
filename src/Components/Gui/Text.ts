import { TextBlock } from "babylonjs-gui";
import { customElement } from "lit/decorators";
import { GardenInfo } from "../Info";
import { GardenControl } from "./Control";

@customElement("garden-text")
export class GardenText extends GardenControl {
    updated() {
        setTimeout(() => {
            var label = new TextBlock();
            let text =  this.textContent.replace(/^\s+|\s+$/gm, '');
            label.text = text;
            
            this.applyProperties(label);

            (<GardenInfo>this.parentElement).container.addControl(label);
        });
    }
}