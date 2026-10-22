/** How a {@link ThumbPad} looks and behaves. */
export interface ThumbPadOptions {
    side: "left" | "right";
    className: string;
    /** The ring's diameter, CSS pixels (default 120). */
    size?: number;
    /** The ring and knob colour (default white). */
    colour?: string;
    /**
     * `fixed`: the ring stays in its corner. `floating`: a touch anywhere on
     * that half of the screen puts the ring under the thumb (what most phone
     * games do: easier for small hands), and it goes back to the corner,
     * faded, when let go.
     */
    mode?: "fixed" | "floating";
    onStart?: () => void;
    onMove?: () => void;
    onEnd?: () => void;
}

/**
 * An on-screen thumb pad for touch screens: a ring in a bottom corner with a
 * knob you drag. `x` (right) and `y` (up) are -1..1 while it's held. Drawn
 * by `<garden-thumbstick>`, and by `walk` (bottom left) and the follow
 * camera's `look-pad` (bottom right) when no thumbstick is declared, so the
 * two can be held at once like a controller's sticks.
 *
 * @category Utils
 */
export class ThumbPad {
    x = 0;
    y = 0;
    active = false;
    readonly element: HTMLElement;
    private zone: HTMLElement = null;
    private knob: HTMLElement;
    private size: number;
    private options: ThumbPadOptions;

    constructor(host: HTMLElement, sideOrOptions: "left" | "right" | ThumbPadOptions, className?: string, size = 120) {
        let o: ThumbPadOptions = typeof sideOrOptions == "string" ? { side: sideOrOptions, className, size } : sideOrOptions;
        this.options = o;
        size = this.size = o.size ?? 120;
        let colour = o.colour ?? "255,255,255";
        let rgb = colour.startsWith("#") ? hexToRgb(colour) : colour;
        let knobSize = Math.round(size * 0.43);
        let base = this.element = document.createElement("div");
        base.className = o.className;
        base.style.cssText = `position:fixed;${o.side}:24px;bottom:24px;width:${size}px;height:${size}px;border-radius:50%;
            background:rgba(${rgb},.15);border:2px solid rgba(${rgb},.5);touch-action:none;z-index:10;user-select:none;
            transition:opacity .25s;box-sizing:border-box;`;
        let knob = this.knob = document.createElement("div");
        knob.style.cssText = `position:absolute;left:${(size - knobSize) / 2 - 2}px;top:${(size - knobSize) / 2 - 2}px;width:${knobSize}px;
            height:${knobSize}px;border-radius:50%;background:rgba(${rgb},.65);pointer-events:none;`;
        base.appendChild(knob);

        let grab = base;
        if (o.mode == "floating") {
            // A touch anywhere on this half of the screen (below the top fifth) starts it.
            let zone = this.zone = document.createElement("div");
            zone.className = o.className + "-zone";
            zone.style.cssText = `position:fixed;${o.side}:0;bottom:0;width:50%;height:80%;touch-action:none;z-index:9;user-select:none;`;
            host.appendChild(zone);
            grab = zone;
            base.style.pointerEvents = "none";
            base.style.opacity = ".45";
        }
        host.appendChild(base);

        let pointer: number = null;
        let centre = { x: 0, y: 0 };
        let move = (e: PointerEvent) => {
            let dx = e.clientX - centre.x, dy = e.clientY - centre.y;
            let max = size / 2, length = Math.hypot(dx, dy);
            if (length > max) { dx *= max / length; dy *= max / length; }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            this.x = dx / max;
            this.y = -dy / max;
            o.onMove?.();
        };
        grab.addEventListener("pointerdown", e => {
            if (pointer != null) return;
            pointer = e.pointerId;
            grab.setPointerCapture(pointer);
            if (o.mode == "floating") {
                // The ring jumps to the thumb.
                base.style.left = `${e.clientX - size / 2}px`;
                base.style.top = `${e.clientY - size / 2}px`;
                base.style.right = base.style.bottom = "auto";
                base.style.opacity = "1";
            }
            let r = base.getBoundingClientRect();
            centre = o.mode == "floating" ? { x: e.clientX, y: e.clientY } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            this.active = true;
            o.onStart?.();
            move(e);
            e.preventDefault();
            e.stopPropagation();
        });
        grab.addEventListener("pointermove", e => { if (e.pointerId == pointer) move(e); });
        let end = (e: PointerEvent) => {
            if (e.pointerId != pointer) return;
            pointer = null;
            this.x = this.y = 0;
            this.active = false;
            knob.style.transform = "";
            if (o.mode == "floating") {
                base.style.left = base.style.right = base.style.top = base.style.bottom = "";
                base.style[o.side] = "24px";
                base.style.bottom = "24px";
                base.style.opacity = ".45";
            }
            o.onEnd?.();
        };
        grab.addEventListener("pointerup", end);
        grab.addEventListener("pointercancel", end);
    }

    /** Shows or hides it (hidden, it lets go and ignores touches). */
    set visible(v: boolean) {
        this.element.style.display = v ? "" : "none";
        if (this.zone) this.zone.style.display = v ? "" : "none";
        if (!v && this.active) {
            this.x = this.y = 0;
            this.active = false;
            this.knob.style.transform = "";
            this.options.onEnd?.();
        }
    }

    dispose() {
        this.element.remove();
        this.zone?.remove();
    }

    /** True on a touch screen (where `auto` pads appear). */
    static get touchScreen(): boolean {
        return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
    }
}

function hexToRgb(hex: string): string {
    let h = hex.replace("#", "");
    if (h.length == 3) h = h.split("").map(c => c + c).join("");
    let n = parseInt(h, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
