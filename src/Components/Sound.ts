import { Sound } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../GardenElement";

/**
 * A positional (or ambient) audio source, via Babylon's `Sound`. Attaches
 * itself to the parent element's mesh when the parent has one, for 3D
 * panning/attenuation.
 *
 * Attributes: `url`, `loop`, `autoplay`, `maxdistance`.
 *
 * @example
 * ```html
 * <garden-stairs id="s1">
 *   <garden-sound loop="true" autoplay="true" maxdistance="20" url="theme.ogg"></garden-sound>
 * </garden-stairs>
 * ```
 *
 * @category Components
 */
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