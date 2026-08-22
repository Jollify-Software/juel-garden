import { AbstractMesh, Tools, UniversalCamera, Vector3 } from "babylonjs";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";

// Third-person chase camera. `target="#id"` (resolved asynchronously in
// GardenCamera.updated(), since the target element may not exist/be built
// yet) sets `lockedTarget`, read fresh every frame below; radius/height-offset/
// rotation-offset are tunable via the generic OptionsBuilder float setters.
// rotationOffset=180 is the standard "behind the target" chase angle.
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
/**
 * `type="follow"`: a spring-damped third-person chase camera locked to
 * `target`. See {@link GardenCamera}.
 *
 * @category Camera Types
 */
export const FollowCameraStrategy: ICameraTypeStrategy = (el, scene) => {
    let cam = new UniversalCamera("camera", new Vector3(0, 5, -10), scene);
    let state = cam as unknown as {
        radius: number;
        heightOffset: number;
        rotationOffset: number;
        cameraStiffness: number;
        cameraDamping: number;
        lockedTarget: AbstractMesh;
    };
    state.radius = 4;
    state.heightOffset = 2;
    state.rotationOffset = 180;
    // Damping just under 2*sqrt(stiffness) (critical damping, ~12.6 here) is
    // deliberately underdamped -- the camera overshoots the ideal spot a little
    // and settles back, the "springy" chase-cam feel, rather than a dead-flat
    // catch-up. Loosen the chase by lowering stiffness and/or damping.
    state.cameraStiffness = 40;
    state.cameraDamping = 8;
    state.lockedTarget = null;

    // UniversalCamera ships with its own keyboard/mouse-look inputs, which
    // GardenCamera's generic attachControl() call would otherwise wire up --
    // fighting any `drive` behaviour's own arrow-key handling and pulling the
    // camera out of its spring. A chase camera here is meant to stay purely
    // programmatic: driven only by its spring toward the locked target.
    cam.inputs.clear();

    let engine = scene.getEngine();
    let velocity = Vector3.Zero();

    scene.onBeforeRenderObservable.add(() => {
        let target = state.lockedTarget;
        if (!target) {
            return;
        }

        let targetPosition = target.getAbsolutePosition();
        // Prefer the target's true direction of travel (BehaviourDrive.drivingHeading)
        // over its raw rotation.y -- a `drive-facing-offset` can make those two
        // diverge (a mesh authored so its visual "nose" isn't at local +Z), and a
        // chase camera should follow where the target is *going*, not how its
        // particular geometry happens to be modelled.
        let heading = (<any>target).drivingHeading ?? target.rotation.y;
        let angle = heading + Tools.ToRadians(state.rotationOffset);

        let idealPosition = new Vector3(
            targetPosition.x + Math.sin(angle) * state.radius,
            targetPosition.y + state.heightOffset,
            targetPosition.z + Math.cos(angle) * state.radius
        );

        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;

        // Semi-implicit (symplectic) Euler: update velocity first, then use the
        // *new* velocity to move position. Stays numerically stable for a stiff
        // spring at ordinary frame deltas, unlike plain (explicit) Euler.
        let toIdeal = idealPosition.subtract(cam.position);
        let accel = toIdeal.scale(state.cameraStiffness).subtract(velocity.scale(state.cameraDamping));
        velocity.addInPlace(accel.scale(dt));
        cam.position.addInPlace(velocity.scale(dt));

        cam.setTarget(targetPosition);
    });

    return cam;
}
