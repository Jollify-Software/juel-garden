import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { CameraJump } from "./CameraJump";

/**
 * The on-screen Jump button (`<garden-camera jump jump-button>`), for a visitor with no Space bar.
 * It sits on the right, above where Babylon puts its Enter VR button: the thumbstick has the bottom
 * left, and a drag anywhere else looks round, so a thumb on each side can walk and jump together.
 * It takes the press itself, so the scene doesn't read it as a tap on the floor or the start of a
 * look. Hidden while another camera is active, which is how it goes away in a headset. It stays on
 * screen rather than fading as the thumbstick does: a stick comes back under any touch, and a
 * button has to be seen to be found. See {@link "Components/Camera"!GardenCamera}.
 *
 * @category Camera Types
 */
export class CameraJumpButton {
    readonly element: HTMLButtonElement;
    /** The page's own say (`visible`): false keeps it hidden whichever camera is active. */
    private wanted = true;
    private observer: Observer<Scene>;
    private onDown = (e: PointerEvent) => {
        e.preventDefault(); // keeps the focus where it was, so Space and the arrows still go to the scene
        e.stopPropagation();
        this.jumper.jump();
    };
    /** A keyboard press on the button, or a screen reader's: pointers have already jumped, on the way down. */
    private onClick = (e: MouseEvent) => {
        if (e.detail == 0) this.jumper.jump();
    };

    constructor(host: HTMLElement, private jumper: CameraJump, private camera: FreeCamera, private scene: Scene) {
        let button = this.element = document.createElement("button");
        button.type = "button";
        button.className = "garden-touch-jump";
        button.title = "Jump";
        button.setAttribute("aria-label", "Jump");
        // White on a dark disc, so it reads on a pale wall and against the sky alike.
        button.style.cssText = `position:fixed;right:24px;bottom:120px;width:64px;height:64px;padding:0;margin:0;border-radius:50%;
            background:rgba(0,0,0,.4);border:2px solid rgba(255,255,255,.75);color:#fff;touch-action:none;z-index:12;user-select:none;
            -webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
        button.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
        button.addEventListener("pointerdown", this.onDown);
        button.addEventListener("click", this.onClick);
        host.appendChild(button);
        this.observer = scene.onBeforeRenderObservable.add(() => this.show());
    }

    /** Shows or hides it, for a page that has views of its own in which a jump means nothing. */
    set visible(v: boolean) {
        this.wanted = v;
        this.show();
    }

    private show() {
        let display = this.wanted && this.scene.activeCamera == this.camera ? "flex" : "none";
        if (this.element.style.display != display)
            this.element.style.display = display;
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.element.remove();
    }
}
