import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";

/**
 * A line of words on how to move (`<garden-camera hint>`), for a visitor who has never walked round
 * a 3D scene in a browser. It sits at the bottom middle, takes no clicks, and goes once they've taken
 * a few steps or after {@link CameraHint.Seconds} seconds, so it's never in the way of what they came
 * to see. Hidden while another camera is active, which is how it goes away in a headset.
 * See {@link "Components/Camera"!GardenCamera}.
 *
 * @category Camera Types
 */
export class CameraHint {
    /** How long the words stay if the visitor doesn't move. */
    static readonly Seconds = 15;
    /** How far (metres, along the ground) counts as having found out how to walk. */
    static readonly Walked = 1;

    /** The words for a device: keys with a keyboard, the floor on a touch screen. */
    static words(touch: boolean, jump: boolean): string {
        if (touch) return "Tap the floor to walk. Drag to look round.";
        return `Arrow keys or W A S D to walk. Drag to look round.${jump ? " Space to jump." : ""}`;
    }

    readonly element: HTMLDivElement;
    /** The page's own say (`visible`): false keeps it hidden whichever camera is active. */
    private wanted = true;
    /** Done for good: walked, or the time ran out. */
    private over = false;
    private observer: Observer<Scene>;
    private startedAt: Vector3;
    private timer: ReturnType<typeof setTimeout>;

    constructor(host: HTMLElement, words: string, private camera: FreeCamera, private scene: Scene) {
        let line = this.element = document.createElement("div");
        line.className = "garden-camera-hint";
        line.setAttribute("role", "status");
        line.textContent = words;
        // White on a dark band, so it reads on a pale wall and against the sky alike.
        line.style.cssText = `position:fixed;left:50%;bottom:32px;transform:translateX(-50%);max-width:calc(100% - 32px);box-sizing:border-box;
            padding:10px 18px;border-radius:999px;background:rgba(0,0,0,.65);color:#fff;font:16px/1.3 system-ui,sans-serif;text-align:center;
            pointer-events:none;user-select:none;-webkit-user-select:none;z-index:11;transition:opacity .4s;`;
        host.appendChild(line);
        this.startedAt = camera.position.clone();
        this.timer = setTimeout(() => this.finish(), CameraHint.Seconds * 1000);
        this.observer = scene.onBeforeRenderObservable.add(() => this.frame());
    }

    /** Shows or hides it, for a page that has views of its own in which walking means nothing. */
    set visible(v: boolean) {
        this.wanted = v;
        this.show();
    }

    private frame() {
        let from = this.startedAt, at = this.camera.position;
        if (Math.hypot(at.x - from.x, at.z - from.z) >= CameraHint.Walked)
            this.finish();
        else
            this.show();
    }

    private finish() {
        this.over = true;
        this.show();
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
        clearTimeout(this.timer);
    }

    private show() {
        let shown = !this.over && this.wanted && this.scene.activeCamera == this.camera;
        let opacity = shown ? "1" : "0";
        if (this.element.style.opacity != opacity)
            this.element.style.opacity = opacity;
    }

    dispose() {
        clearTimeout(this.timer);
        if (this.observer)
            this.scene.onBeforeRenderObservable.remove(this.observer);
        this.element.remove();
    }
}
