import { Color3, Color4, HemisphericLight, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators.js";
import { Color3Convert } from "../Converters/Color3Convert";
import { GardenElement } from "../GardenElement";
import { GardenSound } from "./Sound";

/**
 * Lightning: a flash that lights the whole scene and brightens the sky for
 * a moment, flickering out, with thunder after it.
 *
 * Strikes at random every `interval` seconds (`"min max"`), or only when
 * {@link strike} is called (leave `interval` off). A `<garden-sound>` inside
 * is the thunder: it plays `thunder-delay` seconds after the flash (`"min
 * max"`, default `"0.5 3"` -- further away, longer). Fires `garden-lightning`
 * (bubbling) on each strike.
 *
 * Attributes: `interval`, `intensity` (the flash's brightness, default 3),
 * `colour` (default a cold blue-white), `thunder-delay`, `enabled`
 * (`"false"` to hold off random strikes; also settable from code).
 *
 * @example
 * ```html
 * <garden-lightning interval="6 15">
 *   <garden-sound url="thunder.mp3"></garden-sound>
 * </garden-lightning>
 * ```
 *
 * @category Components
 */
@customElement("garden-lightning")
export class GardenLightning extends GardenElement {
    @property() interval: string;
    @property({ type: Number }) intensity: number;
    @property() colour: string;

    /** False to hold off random strikes (strike() still works). */
    enabled = true;

    private flash: HemisphericLight;
    private timer: any;
    private flashing = false;

    updated() {
        let scene = this.getScene();
        if (!this.flash) {
            this.flash = new HemisphericLight(this.id || "lightning", new Vector3(0.2, 1, -0.3), scene);
            this.flash.intensity = 0;
            this.flash.groundColor = new Color3(0.15, 0.15, 0.2);
        }
        this.enabled = this.getAttribute("enabled") != "false";
        clearTimeout(this.timer);
        this.schedule();
    }

    private schedule() {
        let [min, max] = (this.interval ?? "").trim().split(/\s+/).filter(Boolean).map(Number);
        if (!(min > 0))
            return;
        max = max > min ? max : min;
        this.timer = setTimeout(() => {
            if (this.enabled && this.isConnected)
                this.strike();
            if (this.isConnected)
                this.schedule();
        }, (min + Math.random() * (max - min)) * 1000);
    }

    /** Strikes now: the flash, then the thunder. */
    strike() {
        let scene = this.getScene();
        if (!scene || this.flashing)
            return;
        this.flashing = true;
        let colour = this.colour ? (this.colour.startsWith("#") ? Color3.FromHexString(this.colour) : Color3Convert.fromString(this.colour)) : new Color3(0.85, 0.9, 1);
        let peak = this.intensity ?? 3;
        this.flash.diffuse = colour;
        let sky = scene.clearColor.clone();
        let fog = scene.fogColor.clone();

        // Two or three flickers, fading out over ~0.6 s.
        let flickers = [[0, 1], [0.06, 0.35], [0.12, 0.9], [0.2, 0.25], [0.28, 0.6]];
        let length = 0.65;
        let t = 0;
        let observer = scene.onBeforeRenderObservable.add(() => {
            t += Math.min(scene.getEngine().getDeltaTime(), 50) / 1000;
            let level = 0;
            for (let [at, value] of flickers)
                if (t >= at) level = value;
            level *= Math.max(0, 1 - t / length);
            this.flash.intensity = peak * level;
            let mix = level * 0.7;
            scene.clearColor = new Color4(sky.r + (colour.r - sky.r) * mix, sky.g + (colour.g - sky.g) * mix, sky.b + (colour.b - sky.b) * mix, sky.a);
            scene.fogColor = Color3.Lerp(fog, colour, mix * 0.6);
            if (t >= length) {
                scene.onBeforeRenderObservable.remove(observer);
                this.flash.intensity = 0;
                scene.clearColor = sky;
                scene.fogColor = fog;
                this.flashing = false;
            }
        });
        this.dispatchEvent(new CustomEvent("garden-lightning", { bubbles: true }));

        let thunder = this.querySelector("garden-sound") as GardenSound;
        if (thunder) {
            let [min, max] = (this.getAttribute("thunder-delay") ?? "0.5 3").trim().split(/\s+/).map(Number);
            max = max > min ? max : min;
            setTimeout(() => thunder.play(), (min + Math.random() * (max - min)) * 1000);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this.timer);
        this.flash?.dispose();
        this.flash = null;
    }
}
