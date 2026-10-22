import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Tools } from "@babylonjs/core/Misc/tools";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";
import { ThumbPad } from "../Utils/ThumbPad";
import { ThumbstickRegistry } from "../Utils/ThumbstickRegistry";

// Third-person chase camera. `target="#id"` (resolved asynchronously in
// GardenCamera.updated(), since the target element may not exist/be built
// yet) sets `chaseTarget`, read fresh every frame below; radius/height-offset/
// rotation-offset are tunable via the generic OptionsBuilder float setters.
// rotationOffset=180 is the standard "behind the target" chase angle.
//
// Deliberately named `chaseTarget`, not Babylon's own `lockedTarget` --
// `TargetCamera` (UniversalCamera's base class) already has a *native*
// `lockedTarget` property that auto-recomputes the camera's look direction
// from that target's raw position every frame, on its own, independently of
// anything this strategy does. Using that name here would silently fight our
// own manual `cam.setTarget()` call below (Babylon's native recompute runs
// after and wins) -- harmless as long as both ever wanted the same "look
// straight at the target" answer, but it made `look-offset` below a no-op:
// confirmed via a live probe (before this rename) that `cam.rotation.x` came
// back bit-for-bit identical for `look-offset` values of 0, 1, 2, even ±20.
//
// This deliberately isn't Babylon's own `FollowCamera` -- that chases its
// target via a damped spring too (cameraAcceleration/maxCameraSpeed), but
// under a fixed, uneditable integration that produced visible lag/overshoot
// ("jagged", "juddering during turns") once the target's angle was changing
// continuously rather than sitting still, and no amount of retuning its two
// exposed knobs removed it. This is our own explicit spring-damper instead --
// `camera-stiffness`/`camera-damping` -- integrated with a real delta-time in
// seconds (clamped against stall/frame-drop spikes the same way
// BehaviourDrive's dt is) so it stays stable regardless of frame rate. A
// target that itself moves smoothly (see BehaviourDrive's own dt scaling)
// keeps this camera smooth too, however loose the spring is tuned.
/** Where a follow camera is round its target: see `camera.show()`. */
export interface CameraPlace {
    /** Radians round the target (0: on its +Z side). */
    angle: number;
    radius: number;
    height: number;
    /** `look-offset`. */
    look: number;
}

/** How `camera.show()` frames what it shows. */
export interface ShowOptions {
    /** Where the camera looks, from the target (0) to what's shown (1). Default 0.6. */
    mix?: number;
    /** Radians to one side of straight past the target, so the target doesn't hide it. Default 0.4. */
    side?: number;
    /** Distance: `pad` plus `fit` times the gap between them, kept within `minRadius`..`maxRadius`. */
    pad?: number;
    fit?: number;
    minRadius?: number;
    maxRadius?: number;
    /** Height as a share of the distance. Default 0.35. */
    height?: number;
    /** How quickly it swings round (per second). Default 2. */
    rate?: number;
}

/**
 * `type="follow"`: a spring-damped third-person chase camera locked to
 * `target`. See {@link "Components/Camera"!GardenCamera}. `look-offset` raises the point the
 * camera aims at (not the camera itself) above the target, tilting the view
 * up toward the horizon -- useful at a small `radius`, where aiming exactly
 * at the target otherwise reads as looking almost straight down over it.
 *
 * `free-look` keeps the camera at its own angle round the target instead of
 * swinging behind it on every turn -- what a walking player wants (see
 * {@link "Behaviours/BehaviourWalk"!Walker}), whose controls are relative to the camera. Drag to
 * look round (sideways turns, up and down raises or lowers the camera).
 *
 * **Looking round independently of walking** (with `free-look`), like a
 * controller's two sticks: the first gamepad's right stick, the Q and E keys,
 * and on touch screens a `<garden-thumbstick controls="camera">`, or else a
 * built-in pad bottom right (`look-pad`: `auto`, the default, shows it on
 * touch screens; `always`; `never`). The walker can
 * turn right round without the camera following. `look-speed` is how fast
 * the stick turns it (degrees/second, default 150). A script can read or set
 * the camera's `orbitAngle` (radians round the target; 0 puts the camera on
 * the target's +Z side) to turn the view itself.
 *
 * Showing something (a cutaway): `camera.show(what, options)` swings the
 * camera round to look past the target at `what` (a mesh or node, a
 * `Vector3`, or a function giving one each frame, for something that moves),
 * pulled back to fit them both, and returns where the camera was (a
 * {@link CameraPlace}). `camera.unshow()` swings it back there and resolves
 * when it's back; `unshow({ keepAngle: true })` comes back onto the target
 * but keeps the new angle. `camera.swingTo(place, seconds)` eases to any
 * place (an angle needs `free-look`). The look controls are ignored while it
 * shows something. See {@link ShowOptions}.
 *
 * @example
 * ```ts
 * const camera = (document.querySelector("garden-camera") as any).camera;
 * camera.show(stranger, { side: 0.6 });   // look past the player at it
 * setTimeout(() => camera.unshow(), 3000); // and swing back after 3 s
 * ```
 *
 * @category Camera Types
 */
export const FollowCameraStrategy: ICameraTypeStrategy = (el, scene) => {
    let cam = new UniversalCamera("camera", new Vector3(0, 5, -10), scene);
    let state = cam as unknown as {
        radius: number;
        heightOffset: number;
        rotationOffset: number;
        lookOffset: number;
        cameraStiffness: number;
        cameraDamping: number;
        chaseTarget: AbstractMesh;
        freeLook: boolean;
        lookSpeed: number;
        lookPad: string;
        orbitAngle: number;
    };
    state.radius = 4;
    state.heightOffset = 2;
    state.rotationOffset = 180;
    // How far above the target's own position the camera actually *looks*,
    // independent of heightOffset (which only moves the camera itself).
    // Left at 0, the camera aims exactly at the target -- fine at a distance,
    // but up close (a small radius) that reads as looking almost straight
    // down over the target rather than out at what's around it. Raising the
    // look point tilts the view up toward the horizon without moving the
    // camera's own position at all.
    state.lookOffset = 0;
    // Damping just under 2*sqrt(stiffness) (critical damping, ~12.6 here) is
    // deliberately underdamped -- the camera overshoots the ideal spot a little
    // and settles back, the "springy" chase-cam feel, rather than a dead-flat
    // catch-up. Loosen the chase by lowering stiffness and/or damping.
    state.cameraStiffness = 40;
    state.cameraDamping = 8;
    state.chaseTarget = null;
    state.freeLook = false;
    state.lookSpeed = 150;
    state.lookPad = "auto";
    // free-look: the camera's own angle round the target, set on the first frame.
    let orbitAngle: number = null;
    Object.defineProperty(cam, "orbitAngle", { get: () => orbitAngle, set: (v: number) => orbitAngle = v });

    // show()/unshow()/swingTo(): a cutaway to something, and back.
    let time = 0;
    let showing: { where: () => Vector3, was: CameraPlace, o: Required<ShowOptions> } = null;
    let swing: { to: CameraPlace, end: number, resolve: () => void } = null;
    // Where the camera looks while it shows something or swings back (null: at the target).
    let focus: Vector3 = null;
    // Without free-look the angle normally comes from the target's heading; this holds it meanwhile.
    let heldAngle: number = null;
    let place = (): CameraPlace => ({ angle: (state.freeLook ? orbitAngle : heldAngle) ?? 0, radius: state.radius, height: state.heightOffset, look: state.lookOffset });
    let pointOf = (what: unknown): () => Vector3 =>
        what instanceof Vector3 ? () => what
            : typeof what == "function" ? what as () => Vector3
            : () => (<any>what).getAbsolutePosition();
    let endSwing = () => { if (swing) { swing.resolve(); swing = null; } };
    (<any>cam).show = (what: unknown, options: ShowOptions = {}): CameraPlace => {
        let was = showing?.was ?? swing?.to ?? place();
        endSwing();
        showing = { where: pointOf(what), was, o: { mix: 0.6, side: 0.4, pad: 5, fit: 0.55, minRadius: 8, maxRadius: 15, height: 0.35, rate: 2, ...options } };
        return was;
    };
    (<any>cam).swingTo = (to: CameraPlace, seconds = 1.6): Promise<void> => {
        endSwing();
        showing = null;
        return new Promise<void>(resolve => swing = { to, end: time + seconds, resolve });
    };
    (<any>cam).unshow = (options: { keepAngle?: boolean, seconds?: number } = {}): Promise<void> => {
        if (!showing) return Promise.resolve();
        let was = showing.was;
        let to = options.keepAngle ? { ...place(), radius: was.radius, height: was.height, look: was.look } : was;
        return (<any>cam).swingTo(to, options.seconds ?? (options.keepAngle ? 0.5 : 1.6));
    };
    Object.defineProperty(cam, "showing", { get: () => !!showing });
    let keys = new Set<string>();
    window.addEventListener("keydown", e => {
        let t = e.target as HTMLElement;
        if (!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) keys.add(e.key.toLowerCase());
    });
    window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());
    let pad: ThumbPad = null;
    /** The look sticks' turn (x, right) and tilt (y, up) now, each -1..1. */
    let lookInput = () => {
        let x = (keys.has("e") ? 1 : 0) - (keys.has("q") ? 1 : 0), y = 0;
        let declared = ThumbstickRegistry.controlling("camera");
        if (declared.length && pad) { pad.dispose(); pad = null; }
        for (let s of declared.length ? declared.filter(s => s.enabled) : pad ? [pad] : [])
            if (s.active) { x += s.x; y += s.y; }
        let gamepad = navigator.getGamepads?.().find(g => g?.connected);
        if (gamepad) {
            let gx = gamepad.axes[2] ?? 0, gy = -(gamepad.axes[3] ?? 0);
            if (Math.hypot(gx, gy) > 0.15) { x += gx; y += gy; }
        }
        return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };

    // UniversalCamera ships with its own keyboard/mouse-look inputs, which
    // GardenCamera's generic attachControl() call would otherwise wire up --
    // fighting any `drive` behaviour's own arrow-key handling and pulling the
    // camera out of its spring. A chase camera here is meant to stay purely
    // programmatic: driven only by its spring toward the locked target.
    cam.inputs.clear();

    let engine = scene.getEngine();
    let velocity = Vector3.Zero();

    let canvas = engine.getRenderingCanvas();
    let drag: { id: number, x: number, y: number } = null;
    canvas?.addEventListener("pointerdown", e => {
        if (state.freeLook && !drag) drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    canvas?.addEventListener("pointermove", e => {
        if (!drag || e.pointerId != drag.id || orbitAngle == null) return;
        orbitAngle += (e.clientX - drag.x) * 0.006;
        state.heightOffset = Math.max(0.3, Math.min(state.radius * 2, state.heightOffset + (e.clientY - drag.y) * 0.02));
        drag.x = e.clientX;
        drag.y = e.clientY;
    });
    let endDrag = (e: PointerEvent) => { if (drag?.id == e.pointerId) drag = null; };
    canvas?.addEventListener("pointerup", endDrag);
    canvas?.addEventListener("pointercancel", endDrag);

    scene.onBeforeRenderObservable.add(() => {
        let target = state.chaseTarget;
        if (!target) {
            return;
        }

        let targetPosition = target.getAbsolutePosition();
        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
        time += dt;
        // Prefer the target's true direction of travel (BehaviourDrive.drivingHeading)
        // over its raw rotation.y -- a `drive-facing-offset` can make those two
        // diverge (a mesh authored so its visual "nose" isn't at local +Z), and a
        // chase camera should follow where the target is *going*, not how its
        // particular geometry happens to be modelled.
        let heading = (<any>target).drivingHeading ?? target.rotation.y;
        let angle = heading + Tools.ToRadians(state.rotationOffset);
        if (state.freeLook)
            angle = orbitAngle ??= angle;

        let lookAt = targetPosition;
        if (showing || swing) {
            focus ??= targetPosition.clone();
            let turn = (to: number, k: number) => {
                let from = state.freeLook ? orbitAngle : heldAngle ?? angle;
                let next = from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;
                if (state.freeLook) orbitAngle = next; else heldAngle = next;
                return next;
            };
            if (showing) {
                let o = showing.o, it = showing.where();
                let k = Math.min(1, dt * o.rate);
                let wanted = Vector3.Lerp(targetPosition, it, o.mix);
                focus.addInPlace(wanted.subtract(focus).scale(k));
                // From behind the target, a little to one side.
                angle = turn(Math.atan2(targetPosition.x - it.x, targetPosition.z - it.z) + o.side, k);
                let gap = Math.hypot(it.x - targetPosition.x, it.z - targetPosition.z);
                let radius = Math.min(o.maxRadius, Math.max(o.minRadius, gap * o.fit + o.pad));
                state.radius += (radius - state.radius) * k;
                state.heightOffset += (radius * o.height - state.heightOffset) * k;
            } else {
                let left = swing.end - time;
                let k = left <= 0 ? 1 : Math.min(1, dt / left);
                focus.addInPlace(targetPosition.subtract(focus).scale(k));
                // Without free-look the angle goes back to following the target's heading.
                angle = turn(state.freeLook ? swing.to.angle : angle, k);
                state.radius += (swing.to.radius - state.radius) * k;
                state.heightOffset += (swing.to.height - state.heightOffset) * k;
                state.lookOffset += (swing.to.look - state.lookOffset) * k;
                if (left <= 0) {
                    focus = null;
                    heldAngle = null;
                    endSwing();
                }
            }
            if (focus) lookAt = focus;
        }

        let idealPosition = new Vector3(
            lookAt.x + Math.sin(angle) * state.radius,
            lookAt.y + state.heightOffset,
            lookAt.z + Math.cos(angle) * state.radius
        );

        if (state.freeLook && !showing) {
            if (!pad && canvas?.parentElement && !ThumbstickRegistry.controlling("camera").length
                && (state.lookPad == "always" || (state.lookPad == "auto" && ThumbPad.touchScreen)))
                pad = new ThumbPad(canvas.parentElement, "right", "garden-look-pad");
            let look = lookInput();
            orbitAngle += look.x * Tools.ToRadians(state.lookSpeed) * dt;
            state.heightOffset = Math.max(0.3, Math.min(state.radius * 2, state.heightOffset - look.y * state.radius * 0.6 * dt));
        }

        // Semi-implicit (symplectic) Euler: update velocity first, then use the
        // *new* velocity to move position. Stays numerically stable for a stiff
        // spring at ordinary frame deltas, unlike plain (explicit) Euler.
        let toIdeal = idealPosition.subtract(cam.position);
        let accel = toIdeal.scale(state.cameraStiffness).subtract(velocity.scale(state.cameraDamping));
        velocity.addInPlace(accel.scale(dt));
        cam.position.addInPlace(velocity.scale(dt));

        cam.setTarget(lookAt.add(new Vector3(0, state.lookOffset, 0)));
    });

    return cam;
}
