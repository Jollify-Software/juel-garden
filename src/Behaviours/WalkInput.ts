import { ThumbPad } from "../Utils/ThumbPad";
import { ThumbstickRegistry } from "../Utils/ThumbstickRegistry";

/**
 * The input for a `walk` behaviour (see {@link BehaviourWalk}): keyboard
 * (WASD/arrows, Shift to run), the first gamepad's left stick (B to run, or
 * the stick pushed right over), and an on-screen thumb pad on touch screens
 * (pushed to its rim to run): a `<garden-thumbstick controls="...">` that
 * matches the walker, or else a built-in pad (`walk-joystick`). {@link read} gives one direction, x right and
 * y forward, each -1..1.
 *
 * @category Behaviours
 */
export class WalkInput {
    /** True while the player asks to run. Set by {@link read}. */
    running = false;

    private keys = new Set<string>();
    private pad: ThumbPad;
    private host: HTMLElement;
    private joystick: string;
    private owner: Element;

    /**
     * `joystick`: `"auto"` (touch screens only), `"always"` or `"never"`.
     * `owner`: the walking element, for `<garden-thumbstick controls>`.
     */
    constructor(host: HTMLElement, joystick = "auto", owner: Element = null) {
        this.host = host;
        this.joystick = joystick;
        this.owner = owner;
        let typing = (e: KeyboardEvent) => {
            let t = e.target as HTMLElement;
            return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
        };
        window.addEventListener("keydown", e => { if (!typing(e)) this.keys.add(e.key.toLowerCase()); });
        window.addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()));
        window.addEventListener("blur", () => this.keys.clear());

    }

    /** The thumbsticks for this walker, or the built-in pad (made on first use) if there are none. */
    private sticks(): { x: number, y: number, active: boolean }[] {
        let declared = this.owner ? ThumbstickRegistry.controlling(this.owner) : [];
        if (declared.length) {
            this.pad?.dispose();
            this.pad = null;
            return declared.filter(s => s.enabled);
        }
        let j = this.joystick;
        if (!this.pad && this.host && (j == "always" || (j == "auto" && ThumbPad.touchScreen)))
            this.pad = new ThumbPad(this.host, "left", "garden-walk-joystick");
        return this.pad ? [this.pad] : [];
    }

    /** The direction asked for now: x right, y forward. */
    read(): { x: number, y: number } {
        let k = this.keys;
        let x = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
        let y = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
        let running = k.has("shift");

        for (let pad of this.sticks()) {
            if (!pad.active) continue;
            x += pad.x;
            y += pad.y;
            running ||= Math.hypot(pad.x, pad.y) > 0.9;
        }

        let gamepad = navigator.getGamepads?.().find(g => g?.connected);
        if (gamepad) {
            let gx = gamepad.axes[0] ?? 0, gy = -(gamepad.axes[1] ?? 0);
            if (Math.hypot(gx, gy) > 0.15) {
                x += gx;
                y += gy;
                running ||= Math.hypot(gx, gy) > 0.95;
            }
            running ||= !!gamepad.buttons[1]?.pressed;
        }

        let length = Math.hypot(x, y);
        if (length > 1) {
            x /= length;
            y /= length;
        }
        this.running = running && length > 0;
        return { x, y };
    }
}
