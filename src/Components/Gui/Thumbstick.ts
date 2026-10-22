import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../../GardenElement";
import { ThumbPad } from "../../Utils/ThumbPad";
import { ThumbstickInput, ThumbstickRegistry } from "../../Utils/ThumbstickRegistry";

/**
 * An on-screen thumbstick for touch screens, like a controller's sticks:
 * one to walk, one to look round. It moves a `walk` element, or turns a
 * follow camera with `free-look`.
 *
 * Attributes:
 * - `controls` -- what it drives: a selector for a `walk` element (e.g.
 *   `#player`), or `camera` for the follow camera's look (turn, and tilt).
 * - `side` -- `left` (the default) or `right`.
 * - `show` -- `auto` (touch screens only, the default), `always` or `never`.
 * - `mode` -- `floating` (the default): a touch anywhere on that half of the
 *   screen puts the stick under the thumb, and it rests faded in its corner
 *   when let go; `fixed`: it stays in the corner.
 * - `size` -- the ring's diameter in CSS pixels (default 120).
 * - `colour` -- `#rrggbb` (default white).
 * - `disabled` -- hides it and ignores it (e.g. on a menu); settable from code.
 *
 * While a stick controls something, the built-in pads (`walk-joystick`, the
 * camera's `look-pad`) don't appear for it. Pushing a walking stick right to
 * its rim runs.
 *
 * Script API: `x`, `y` (-1..1, right and up), `active`, `disabled`.
 * Fires `garden-thumbstick-start`, `-move` and `-end` (bubbling; `detail: { x, y }`).
 *
 * @example
 * ```html
 * <garden-thumbstick side="left" controls="#player"></garden-thumbstick>
 * <garden-thumbstick side="right" controls="camera"></garden-thumbstick>
 * ```
 *
 * @category Components - GUI
 */
@customElement("garden-thumbstick")
export class GardenThumbstick extends GardenElement implements ThumbstickInput {
    @property() controls: string;
    @property() side: string;
    @property() show: string;
    @property() mode: string;
    @property({ type: Number }) size: number;
    @property() colour: string;
    @property({ type: Boolean, reflect: true }) disabled = false;

    private pad: ThumbPad = null;
    private builtKey: string;

    get x(): number { return this.enabled ? this.pad?.x ?? 0 : 0; }
    get y(): number { return this.enabled ? this.pad?.y ?? 0 : 0; }
    get active(): boolean { return this.enabled && !!this.pad?.active; }
    /** Shown and not disabled. */
    get enabled(): boolean { return !this.disabled && this.shown; }

    private get shown(): boolean {
        let show = (this.show ?? "auto").toLowerCase();
        return show == "always" || (show == "auto" && ThumbPad.touchScreen);
    }

    connectedCallback() {
        super.connectedCallback();
        ThumbstickRegistry.sticks.add(this);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        ThumbstickRegistry.sticks.delete(this);
        this.pad?.dispose();
        this.pad = null;
        this.builtKey = null;
    }

    update(changed?: Map<PropertyKey, unknown>) {
        this.liveUpdate(changed);
    }

    updated() {
        let key = [this.side, this.mode, this.size, this.colour].join("|");
        if (!this.pad || key != this.builtKey) {
            this.pad?.dispose();
            this.builtKey = key;
            let host = this.getSceneEl() ?? document.body;
            let detail = () => ({ detail: { x: this.x, y: this.y }, bubbles: true });
            this.pad = new ThumbPad(host as HTMLElement, {
                side: this.side == "right" ? "right" : "left",
                className: "garden-thumbstick",
                size: this.size || 120,
                colour: this.colour,
                mode: this.mode == "fixed" ? "fixed" : "floating",
                onStart: () => this.dispatchEvent(new CustomEvent("garden-thumbstick-start", detail())),
                onMove: () => this.dispatchEvent(new CustomEvent("garden-thumbstick-move", detail())),
                onEnd: () => this.dispatchEvent(new CustomEvent("garden-thumbstick-end", detail())),
            });
            this.pad.element.dataset.side = this.side == "right" ? "right" : "left";
        }
        this.pad.visible = this.enabled;
    }
}
