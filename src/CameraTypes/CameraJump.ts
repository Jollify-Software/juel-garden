import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";

/** Gravity for the jump's arc, in m/s² (the scene's `gravity` is a per-frame drop, not this). */
const Gravity = 9.81;
/** Room kept between the top of the camera's ellipsoid and a ceiling, metres. */
const Headroom = 0.05;

/**
 * Space jumps a walking camera (`<garden-camera type="free" collisions jump>`): it rises
 * `height` metres and comes down again. With collisions it bumps its head on ceilings and lands
 * on whatever is below; without, it lands back at the height it left. Only when it's standing
 * (not already falling) and not while typing in a form field. While in the air the camera's own
 * gravity is off and the jump moves it; it's put back on landing. See {@link "Components/Camera"!GardenCamera}.
 *
 * @category Camera Types
 */
export class CameraJump {
    /** Upward speed while in the air, m/s; null when standing. */
    private velocity: number | null = null;
    private lastY: number;
    /** Where a jump without collisions started: it lands back at that height. */
    private startY: number;
    private hadGravity: boolean;
    private observer: Observer<Scene>;
    private onKey = (evt: KeyboardEvent) => {
        if (evt.code != "Space" || evt.repeat || CameraJump.typing(evt.target)) return;
        if (this.scene.activeCamera != this.camera) return;
        if (this.jump()) evt.preventDefault();
    };

    constructor(private camera: FreeCamera, private scene: Scene, private height = 1) {
        this.lastY = camera.position.y;
        window.addEventListener("keydown", this.onKey);
        this.observer = scene.onBeforeRenderObservable.add(() => this.step());
    }

    /** True while the camera is in the air from a jump. */
    get jumping() {
        return this.velocity != null;
    }

    /** Starts a jump if the camera is standing; returns whether it did. */
    jump(): boolean {
        if (this.jumping || !this.standing) return false;
        this.velocity = Math.sqrt(2 * Gravity * Math.max(0, this.height));
        this.startY = this.camera.position.y;
        this.hadGravity = this.camera.applyGravity;
        this.camera.applyGravity = false;
        return true;
    }

    /** Standing: the camera didn't drop last frame (gravity found something under it). */
    private standing = true;

    private step() {
        let cam = this.camera;
        if (this.velocity == null) {
            this.standing = Math.abs(cam.position.y - this.lastY) < 0.001;
            this.lastY = cam.position.y;
            return;
        }
        let dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);
        let move = this.velocity * dt - Gravity * dt * dt / 2;
        this.velocity -= Gravity * dt;
        let before = cam.position.y;
        if (cam.checkCollisions && this.scene.collisionsEnabled) {
            if (move > 0) {
                // Going up, Babylon's collider sticks on the floor it's touching, so a ray from
                // the top of the camera's ellipsoid finds the ceiling instead.
                let room = this.headroom(move + Headroom);
                if (room < move + Headroom) {
                    move = Math.max(0, room - Headroom);
                    this.velocity = Math.min(this.velocity, 0); // a ceiling: start coming down
                }
                cam.position.y += move;
            } else {
                cam._collideWithWorld(new Vector3(0, move, 0));
                // Babylon ignores a step shorter than its CollisionsEpsilon (0.001), as the
                // arc's top is: only a longer step that didn't happen is the ground.
                let moved = cam.position.y - before;
                if (move < -0.004 && moved > move / 2)
                    this.land(); // something underfoot
            }
        } else {
            cam.position.y = Math.max(before + move, this.startY);
            if (move < 0 && cam.position.y <= this.startY)
                this.land();
        }
        this.lastY = cam.position.y;
    }

    /** How far the camera can rise, up to `max`: a ray up from the top of its ellipsoid. */
    private headroom(max: number): number {
        let cam = this.camera;
        let top = cam.globalPosition.add(cam.ellipsoidOffset);
        let hit = this.scene.pickWithRay(new Ray(top, Vector3.Up(), max),
            m => m.checkCollisions && m.isEnabled() && !m.isDescendantOf(cam as any));
        return hit?.hit ? hit.distance : max;
    }

    private land() {
        this.velocity = null;
        this.camera.applyGravity = this.hadGravity;
        this.standing = true;
    }

    /** A form field or editable text: Space types there. */
    static typing(target: EventTarget | null): boolean {
        let el = target as HTMLElement;
        return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName ?? ""));
    }

    dispose() {
        window.removeEventListener("keydown", this.onKey);
        this.scene.onBeforeRenderObservable.remove(this.observer);
        if (this.jumping) this.camera.applyGravity = this.hadGravity;
        this.velocity = null;
    }
}
