import { Mesh, Tools } from "babylonjs";
import { GardenMesh } from "../GardenMesh";

// Keyboard-driven movement (WASD / arrow keys) -- accelerate/brake forward-back,
// steer left-right. Drives in world space (position.x/z + rotation.y) rather
// than the mesh's own local axes: a drivable mesh may carry a fixed tilt of its
// own baked into rotation.x/z (e.g. an extruded car body authored lying down
// and rotated upright once), which would otherwise get tangled up with
// movePOV()/Space.LOCAL rotation -- both operate relative to the mesh's
// *current* full orientation, so "forward" and "turn" stop meaning what they
// look like they mean the moment any other rotation is already baked in.
// Assumes the ordinary Y-up, XZ-ground convention the rest of the library uses.
/**
 * Keyboard-driven (WASD/arrow keys) forward/back movement and left/right
 * steering, e.g. for a drivable car. Pair with `suspension` (see
 * {@link BehaviourSuspension}) to also follow terrain, and a
 * `<garden-camera type="follow" target="#id">` to chase it.
 *
 * Attributes: `drive-speed` (max units/second, default `0.15`), `drive-turn`
 * (turn rate, default `0.04`), `drive-facing-offset` (degrees -- corrects a
 * mesh whose modelled "front" isn't at local +Z, without affecting movement
 * direction).
 *
 * @example
 * ```html
 * <garden-box id="car" drive drive-speed="0.15" drive-turn="0.05"></garden-box>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourDrive(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
    let scene = (<GardenMesh>el).getScene();
    let engine = scene.getEngine();

    let maxSpeed = Number(el.getAttribute("drive-speed") ?? 0.15);
    let turnRate = Number(el.getAttribute("drive-turn") ?? 0.04);
    let accel = maxSpeed / 20;
    let friction = 0.92;

    // `heading` (used for movement, below) treats yaw=0 as facing +Z, matching
    // Babylon's own default forward direction. A mesh whose modelled nose isn't
    // at local +Z at yaw=0 -- e.g. an ExtrudePolygon body authored as a side
    // profile in the XZ plane and laid upright with a fixed rotation.x, whose
    // "length" axis ends up along X instead -- would otherwise visually face 90°
    // off from the direction it's actually travelling in ("crab-walking").
    // `drive-facing-offset` (degrees) corrects that: it's added only to the
    // rotation.y actually written to the mesh, never to the movement math.
    let facingOffset = Tools.ToRadians(Number(el.getAttribute("drive-facing-offset") ?? 0));

    let keys = new Set<string>();
    window.addEventListener("keydown", e => keys.add(e.key.toLowerCase()));
    window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));

    let speed = 0;
    let heading = mesh.rotation.y;

    scene.onBeforeRenderObservable.add(() => {
        // accel/turnRate/friction below are tuned per frame at a 60fps baseline --
        // dt turns that into a real-time rate instead of a per-rendered-frame one.
        // Frame time is also capped (a stalled/backgrounded tab can report a huge
        // gap on the frame it resumes) so a single slow frame can't fling the car
        // -- and with it the follow camera chasing it -- a long, jarring distance.
        let dt = Math.min(engine.getDeltaTime(), 50) / (1000 / 60);

        let throttle = 0;
        if (keys.has("w") || keys.has("arrowup")) throttle = 1;
        else if (keys.has("s") || keys.has("arrowdown")) throttle = -1;

        if (throttle !== 0) {
            speed += throttle * accel * dt;
            speed = Math.max(-maxSpeed / 2, Math.min(maxSpeed, speed));
        } else {
            speed *= Math.pow(friction, dt);
            if (Math.abs(speed) < 0.0005) {
                speed = 0;
            }
        }

        if (speed !== 0) {
            let steer = 0;
            if (keys.has("a") || keys.has("arrowleft")) steer = -1;
            else if (keys.has("d") || keys.has("arrowright")) steer = 1;

            if (steer !== 0) {
                let direction = speed > 0 ? 1 : -1;
                let pace = Math.min(1, Math.abs(speed) / (maxSpeed * 0.3));
                heading += steer * turnRate * direction * pace * dt;
            }
        }

        mesh.rotation.y = heading + facingOffset;

        mesh.position.x += Math.sin(heading) * speed * dt;
        mesh.position.z += Math.cos(heading) * speed * dt;

        // Exposed so a `type="follow"` camera targeting this mesh can chase the
        // true direction of travel rather than mesh.rotation.y -- which, once
        // drive-facing-offset is nonzero, no longer means the same thing.
        (<any>mesh).drivingHeading = heading;
    });
}
