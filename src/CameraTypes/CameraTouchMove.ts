import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Navigation } from "../Navigation";
import { ThumbPad } from "../Utils/ThumbPad";
import { pickAlong, pickAt } from "../Utils/picking";

/** How far a tap on the floor can send the visitor, metres. */
const MaxTapWalk = 40;
/** A floor faces up at least this much (the normal's y). */
const FloorUp = 0.7;
/** The stick fades out after this long untouched, ms. */
const IdleFade = 4000;
/** Walking speed at full push, metres a second (a brisk walk). */
const WalkSpeed = 2.2;

/**
 * Walking on a touch screen, for a `type="free"` camera (`touch="true"`, the default): the
 * visitor can't press W or the arrow keys, so
 *
 * - **tap the floor** to glide there (as Street View and venue tours do): a tap on anything that
 *   faces up, in reach, that isn't a waypoint's platform, a link or a model with `click-play`
 *   (those still do their own thing);
 * - **a floating thumbstick**, bottom left: a touch there puts the stick under the thumb, push to
 *   walk (forward and back, sideways). It shows faded when the scene opens, so the visitor knows
 *   it's there, then fades out altogether after a few seconds untouched: nothing covers the view.
 * - **drag** anywhere else looks round (the camera's own touch input).
 *
 * Not built on a desktop, or when a `<garden-thumbstick controls="camera">` is on the page.
 * See {@link "Components/Camera"!GardenCamera}.
 *
 * @category Camera Types
 */
export class CameraTouchMove {
    readonly pad: ThumbPad;
    private observer: Observer<Scene>;
    private tapStart: { id: number, x: number, y: number, t: number } = null;
    private gliding = false;

    private onDown = (e: PointerEvent) => {
        if (e.isTrusted && (this.anyPointer || e.pointerType == "touch"))
            this.tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    };
    private onUp = (e: PointerEvent) => {
        let s = this.tapStart;
        this.tapStart = null;
        if (!s || !e.isTrusted || e.pointerId != s.id) return;
        if (performance.now() - s.t < 300 && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10)
            this.tapAt(e.clientX, e.clientY);
    };

    constructor(private camera: FreeCamera, private scene: Scene, private canvas: HTMLCanvasElement, private anyPointer = false) {
        this.pad = new ThumbPad(document.body, {
            side: "left", className: "garden-touch-walk", mode: "floating", idleFade: IdleFade,
            // A tap on the stick's half of the screen: let the scene have it (a waypoint, a
            // link), then walk there if it was the floor.
            onTap: (x, y) => {
                this.forward(x, y);
                this.tapAt(x, y);
            },
        });
        canvas.addEventListener("pointerdown", this.onDown);
        canvas.addEventListener("pointerup", this.onUp);
        this.observer = scene.onBeforeRenderObservable.add(() => this.step());
    }

    /** True on a touch screen without a page-level camera thumbstick. */
    static wanted(): boolean {
        return ThumbPad.touchScreen;
    }

    /** Each frame: the stick's push, turned by where the camera faces (level, not tilted). */
    private step() {
        if (!this.pad.active || this.scene.activeCamera != this.camera) return;
        if (this.gliding) {
            this.scene.stopAnimation(this.camera);
            this.gliding = false;
        }
        let dt = this.scene.getEngine().getDeltaTime() / 1000;
        // cameraDirection is applied (with collisions) then damped by inertia each frame, so a
        // push of v per frame settles at v / (1 - inertia).
        let perFrame = WalkSpeed * Math.min(dt, 0.1) * (1 - this.camera.inertia);
        let local = new Vector3(this.pad.x * perFrame, 0, this.pad.y * perFrame);
        let world = Vector3.TransformNormal(local, Matrix.RotationY(this.camera.rotation.y));
        this.camera.cameraDirection.addInPlace(world);
    }

    /** The scene's pointer handlers (waypoints, links, `garden-pick`) see a tap the stick's zone caught. */
    private forward(x: number, y: number) {
        let init: PointerEventInit = { pointerId: 9999, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, button: 0 };
        this.canvas.dispatchEvent(new PointerEvent("pointerdown", { ...init, buttons: 1 }));
        this.canvas.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
    }

    /** A tap at client `x`, `y`: if it's the floor, in reach, glide there at the same eye height. */
    tapAt(x: number, y: number) {
        if (this.scene.activeCamera != this.camera || this.pad.active) return;
        let r = this.canvas.getBoundingClientRect();
        let scale = this.scene.getEngine().getRenderWidth() / (r.width || 1);
        let hit = pickAt(this.scene, (x - r.left) * scale, (y - r.top) * scale, { sprites: false });
        if (!hit?.mesh || !hit.normal || hit.distance > MaxTapWalk) return;
        if (hit.normal.y < FloorUp || this.handledElsewhere(hit.mesh) || hit.element?.hasAttribute?.("click-play")) return;

        // Keep the eye height the camera has now, over whatever it stands on.
        let under = pickAlong(this.scene, this.camera.position, new Vector3(0, -1, 0), 50, { sprites: false });
        let eye = under ? this.camera.position.y - under.point.y : Navigation.defaultOffset.y;
        let to = hit.point.add(new Vector3(0, eye, 0));
        let from = this.camera.position;
        // Stop a little short, so a tap at a wall's foot doesn't put the eye in the wall.
        let flat = new Vector3(to.x - from.x, 0, to.z - from.z);
        let length = flat.length();
        if (length < 0.3) return;
        to = to.subtract(flat.scale(Math.min(0.35, length / 2) / length));
        let duration = Math.min(2200, Math.max(450, length * 220));
        this.gliding = true;
        Navigation.applyPose(this.scene, { position: to.asArray() }, duration).then(() => this.gliding = false);
    }

    /** A waypoint's platform or a mesh with a link (or any pick action) does its own thing. */
    private handledElsewhere(mesh: any): boolean {
        for (let m = mesh; m; m = m.parent) {
            if (m.actionManager?.hasPickTriggers) return true;
        }
        let sceneEl = this.canvas.closest("garden-scene") ?? document;
        for (let w of Array.from(sceneEl.querySelectorAll("garden-waypoint")) as any[])
            if (w.stopOf?.(mesh)) return true;
        return false;
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.canvas.removeEventListener("pointerdown", this.onDown);
        this.canvas.removeEventListener("pointerup", this.onUp);
        this.pad.dispose();
    }
}
