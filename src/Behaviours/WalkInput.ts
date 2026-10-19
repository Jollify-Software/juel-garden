/**
 * The input for a `walk` behaviour (see {@link BehaviourWalk}): keyboard
 * (WASD/arrows, Shift to run), the first gamepad's left stick (B to run, or
 * the stick pushed right over), and an on-screen thumb pad on touch screens
 * (pushed to its rim to run). {@link read} gives one direction, x right and
 * y forward, each -1..1.
 *
 * @category Behaviours
 */
export class WalkInput {
    /** True while the player asks to run. Set by {@link read}. */
    running = false;

    private keys = new Set<string>();
    private pad = { x: 0, y: 0, active: false };
    private joystick: HTMLElement;

    /** `joystick`: `"auto"` (touch screens only), `"always"` or `"never"`. */
    constructor(host: HTMLElement, joystick = "auto") {
        let typing = (e: KeyboardEvent) => {
            let t = e.target as HTMLElement;
            return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
        };
        window.addEventListener("keydown", e => { if (!typing(e)) this.keys.add(e.key.toLowerCase()); });
        window.addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()));
        window.addEventListener("blur", () => this.keys.clear());

        let touch = navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
        if (host && (joystick == "always" || (joystick == "auto" && touch)))
            this.joystick = this.buildJoystick(host);
    }

    /** The direction asked for now: x right, y forward. */
    read(): { x: number, y: number } {
        let k = this.keys;
        let x = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
        let y = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
        let running = k.has("shift");

        if (this.pad.active) {
            x += this.pad.x;
            y += this.pad.y;
            running ||= Math.hypot(this.pad.x, this.pad.y) > 0.9;
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

    private buildJoystick(host: HTMLElement): HTMLElement {
        let size = 120, knobSize = 52;
        let base = document.createElement("div");
        base.className = "garden-walk-joystick";
        base.style.cssText = `position:fixed;left:24px;bottom:24px;width:${size}px;height:${size}px;border-radius:50%;
            background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.45);touch-action:none;z-index:10;user-select:none;`;
        let knob = document.createElement("div");
        knob.style.cssText = `position:absolute;left:${(size - knobSize) / 2}px;top:${(size - knobSize) / 2}px;width:${knobSize}px;
            height:${knobSize}px;border-radius:50%;background:rgba(255,255,255,.6);pointer-events:none;`;
        base.appendChild(knob);
        host.appendChild(base);

        let pointer: number = null;
        let move = (e: PointerEvent) => {
            let r = base.getBoundingClientRect();
            let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            let max = size / 2, length = Math.hypot(dx, dy);
            if (length > max) { dx *= max / length; dy *= max / length; }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            this.pad.x = dx / max;
            this.pad.y = -dy / max;
        };
        base.addEventListener("pointerdown", e => {
            pointer = e.pointerId;
            base.setPointerCapture(pointer);
            this.pad.active = true;
            move(e);
            e.preventDefault();
        });
        base.addEventListener("pointermove", e => { if (e.pointerId == pointer) move(e); });
        let end = (e: PointerEvent) => {
            if (e.pointerId != pointer) return;
            pointer = null;
            this.pad = { x: 0, y: 0, active: false };
            knob.style.transform = "";
        };
        base.addEventListener("pointerup", end);
        base.addEventListener("pointercancel", end);
        return base;
    }
}
