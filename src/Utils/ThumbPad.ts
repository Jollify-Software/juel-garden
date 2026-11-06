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
    /**
     * `floating` only: after this many milliseconds untouched, the resting ring fades out
     * altogether (it still comes back under the thumb). Left out, it stays faded in its corner.
     */
    idleFade?: number;
    /**
     * `floating` only: a quick touch that doesn't move (a tap, not a push of the stick) is
     * passed here, with the stick left untouched, so whatever is under the finger can take it.
     */
    onTap?: (x: number, y: number) => void;
    /**
     * `floating` only: only fingers use it. A mouse or pen goes through its half of the screen to what's underneath, so on
     * a touch screen with a mouse attached, the left of a scene can still be clicked, dragged and looked round with.
     */
    touchOnly?: boolean;
}

/** A touch shorter than this (ms), that moves less than {@link TapSlop} px, is a tap. */
const TapTime = 300;
const TapSlop = 10;
/** The resting ring's opacity in `floating` mode. */
const RestOpacity = ".45";

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
            if (o.touchOnly) {
                // A mouse arrives before it presses, so the press itself lands on the canvas. The first touch after
                // that goes to the canvas too, as the stick's zone only comes back as it lands.
                zone.addEventListener("pointerover", e => { if (e.pointerType != "touch") zone.style.pointerEvents = "none"; });
                this.fingerBack = e => { if (e.pointerType == "touch") zone.style.pointerEvents = ""; };
                window.addEventListener("pointerdown", this.fingerBack, true);
            }
            base.style.pointerEvents = "none";
            base.style.opacity = RestOpacity;
            base.style.transition = "opacity .6s";
        }
        host.appendChild(base);
        this.rest();

        let pointer: number = null;
        let centre = { x: 0, y: 0 };
        let down = { x: 0, y: 0, t: 0 };
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
            down = { x: e.clientX, y: e.clientY, t: performance.now() };
            clearTimeout(this.fadeTimer);
            if (o.mode == "floating") {
                // The ring jumps to the thumb.
                base.style.left = `${e.clientX - size / 2}px`;
                base.style.top = `${e.clientY - size / 2}px`;
                base.style.right = base.style.bottom = "auto";
                base.style.transition = "none"; // under the thumb at once; it fades out slowly
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
                this.rest();
            }
            o.onEnd?.();
            let tap = e.type == "pointerup" && performance.now() - down.t < TapTime
                && Math.hypot(e.clientX - down.x, e.clientY - down.y) < TapSlop;
            if (tap && o.mode == "floating")
                o.onTap?.(e.clientX, e.clientY);
        };
        grab.addEventListener("pointerup", end);
        grab.addEventListener("pointercancel", end);
    }

    private fadeTimer: any;
    private fingerBack: (e: PointerEvent) => void = null;

    /** Back to resting: faded in its corner, then (with `idleFade`) gone until touched. */
    private rest() {
        if (this.options.mode != "floating") return;
        this.element.style.transition = "opacity .6s";
        this.element.style.opacity = RestOpacity;
        clearTimeout(this.fadeTimer);
        if (this.options.idleFade != null)
            this.fadeTimer = setTimeout(() => { if (!this.active) this.element.style.opacity = "0"; }, this.options.idleFade);
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
        clearTimeout(this.fadeTimer);
        if (this.fingerBack) window.removeEventListener("pointerdown", this.fingerBack, true);
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
