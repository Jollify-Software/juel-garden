import { Sound } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../GardenElement";

@customElement("garden-sound")
export class GardenSound extends GardenElement {
    @property() url: string;

    sound: Sound;

    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();

        this.sound = new Sound(this.id ?? "sound", this.url, scene, null, options);
        if ('mesh' in this.parentElement) {
            this.sound.attachToMesh(
                (<any>this.parentElement).mesh
            );
        }
    }
}