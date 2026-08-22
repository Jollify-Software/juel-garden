import { Mesh, Tools, Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

// Terrain-following "suspension" for a `drive`-driven mesh, without a physics
// engine -- this library has none, and a real one (Cannon/Ammo/Havok) is a
// heavy dependency to bundle alongside monolithic 'babylonjs' (@babylonjs/gui
// crashed the Parcel build doing exactly that; see the gui_babylonjs_gui_build_crash
// memory). Instead each wheel position samples the terrain's own height at its
// current world (x,z) via GroundMesh.getHeightAtCoordinates. Visually, a per-wheel
// damped spring chases that height -- the same hand-rolled spring-damper approach
// as the follow camera -- and the chassis's ride height and pitch/roll are derived
// from the 4 spring-smoothed corner heights, like fitting a plane through 4
// suspension travel points, so hitting a bump under one wheel visibly rocks the
// chassis rather than just bouncing it uniformly. But whether a position is
// drivable *at all* is decided from the raw, un-smoothed heights sampled this same
// frame, deliberately never the spring -- see the long comment below for why that
// split turned out to matter.
//
// Must run *after* `drive` has moved the chassis for this frame (Behaviours.map's
// key order registers `drive`'s render callback first, and Babylon fires
// registered callbacks in registration order) -- otherwise wheel world
// positions would be sampled a frame stale.
export function BehaviourSuspension(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
    let scene = (<GardenMesh>el).getScene();
    let engine = scene.getEngine();

    let wheelOffsets = Vector3Convert.array(
        el.getAttribute("suspension-wheels") ?? "-0.4 0 0.6, 0.4 0 0.6, -0.4 0 -0.6, 0.4 0 -0.6"
    );
    let stiffness = Number(el.getAttribute("suspension-stiffness") ?? 90);
    let damping = Number(el.getAttribute("suspension-damping") ?? 18);
    let rideHeight = Number(el.getAttribute("suspension-height") ?? 0.15);
    // How far the chassis can lean before the terrain is steeper than this
    // vehicle can actually climb -- a real mechanical bump-stop limit doubling
    // as the "collision" threshold below: ground that would need to tilt the
    // chassis past this simply isn't drivable, not something to lean harder
    // into and pass through.
    let maxTilt = Tools.ToRadians(Number(el.getAttribute("suspension-max-tilt") ?? 25));
    // Real units/second -- comfortably above any `drive-speed` this library's own
    // examples use, so `drive` can never out-race backing away from a slope it
    // can't climb. A much faster custom `drive-speed` elsewhere would need a
    // correspondingly raised `suspension-retreat-rate`.
    let retreatRate = Number(el.getAttribute("suspension-retreat-rate") ?? 20);

    let wheelbase = Math.abs(wheelOffsets[0].z - wheelOffsets[2].z) || 1;
    let track = Math.abs(wheelOffsets[1].x - wheelOffsets[0].x) || 1;

    let cornerHeight = wheelOffsets.map(() => mesh.position.y);
    let cornerVelocity = wheelOffsets.map(() => 0);
    // Last position confirmed drivable -- `drive` moves the chassis purely
    // kinematically with no idea what's underneath it, so this is the only thing
    // standing between the buggy and driving straight up (or through) a slope
    // steeper than its suspension could ever represent.
    let safeX = mesh.position.x;
    let safeZ = mesh.position.z;

    let terrain: { getHeightAtCoordinates(x: number, z: number): number } = null;
    let terrainAttr = el.getAttribute("suspension-terrain");
    if (terrainAttr) {
        (async () => {
            await GardenElement.whenDocumentReady();
            let [terrainEl] = await GardenElement.resolveReady<GardenMesh>(terrainAttr);
            terrain = <any>terrainEl?.mesh;
        })().catch(err => console.error("[suspension] failed to resolve suspension-terrain", terrainAttr, err));
    }

    scene.onBeforeRenderObservable.add(() => {
        if (!terrain) {
            return;
        }

        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
        let heading = (<any>mesh).drivingHeading ?? mesh.rotation.y;
        let sin = Math.sin(heading);
        let cos = Math.cos(heading);

        // Raw, un-smoothed ground truth for *this* frame's wheel positions --
        // the drivability check below is decided from this, never from the
        // spring-smoothed cornerHeight. Mixing the two turned a real, working
        // block-and-retreat into a stuck loop: a spring that hasn't caught up
        // yet to a just-approached slope reads as "not steep" a frame or two
        // after the raw ground already was, which is exactly long enough for
        // this checkpoint-based retreat to accept and commit a position that's
        // already past the limit -- and once the checkpoint itself creeps past,
        // "retreat from the checkpoint" and "the checkpoint is already too far
        // forward" cancel out into a stable back-and-forth going nowhere. Both
        // faster retreat rates tried before this (2, then 20 units/second) still
        // hit that same trap regardless of speed, because the speed was never
        // the actual problem -- the false-safe reads that kept re-permitting
        // forward progress were. Deciding drivability from the instantaneous
        // reading removes the false negative entirely; the spring still only
        // ever governs the *visual* bounce once a position is already accepted.
        let rawHeight: number[] = [];
        let offTerrain = false;
        for (let i = 0; i < wheelOffsets.length; i++) {
            let offset = wheelOffsets[i];
            let worldX = mesh.position.x + offset.x * cos + offset.z * sin;
            let worldZ = mesh.position.z - offset.x * sin + offset.z * cos;
            let groundY = terrain.getHeightAtCoordinates(worldX, worldZ);
            if (!Number.isFinite(groundY)) {
                // Off the edge of a finite terrain mesh, or queried before its
                // heightmap image has actually finished loading.
                offTerrain = true;
                rawHeight.push(cornerHeight[i]);
                continue;
            }
            rawHeight.push(groundY);
        }

        let [rawFrontLeft, rawFrontRight, rawRearLeft, rawRearRight] = rawHeight;
        let rawPitch = Math.atan2(
            (rawRearLeft + rawRearRight) / 2 - (rawFrontLeft + rawFrontRight) / 2,
            wheelbase
        );
        let rawRoll = Math.atan2(
            (rawFrontLeft + rawRearLeft) / 2 - (rawFrontRight + rawRearRight) / 2,
            track
        );

        if (offTerrain || Math.abs(rawPitch) > maxTilt || Math.abs(rawRoll) > maxTilt) {
            // Steeper than this vehicle can climb -- refuse `drive`'s move for this
            // frame. Retreating the safe checkpoint itself a little every blocked
            // frame (rather than snapping back to a single fixed spot, and rather
            // than leaving it frozen) guarantees this can't wedge into a permanent
            // standstill even if the checkpoint itself turns out to already be a
            // hair too close to the slope. Leaves position.y/rotation untouched
            // too, so the chassis stays exactly as it looked the moment it was
            // still valid, instead of flashing toward the too-steep reading first.
            safeX -= Math.sin(heading) * retreatRate * dt;
            safeZ -= Math.cos(heading) * retreatRate * dt;
            mesh.position.x = safeX;
            mesh.position.z = safeZ;
            return;
        }

        safeX = mesh.position.x;
        safeZ = mesh.position.z;

        // Only now, on an accepted position, does the visual spring get to move --
        // chasing the same raw heights just used for the drivability check above.
        for (let i = 0; i < wheelOffsets.length; i++) {
            // Semi-implicit Euler, same as the follow camera's spring -- stable
            // at ordinary frame deltas for a spring this stiff.
            let velocity = cornerVelocity[i];
            let accel = (rawHeight[i] - cornerHeight[i]) * stiffness - velocity * damping;
            velocity += accel * dt;
            cornerHeight[i] += velocity * dt;
            cornerVelocity[i] = velocity;

            // Bottom-out: a wheel's suspension travel physically can't compress past
            // the ground actually being there. Without this, a spring this soft lags
            // behind a fast-rising slope (climbing at speed onto a steep bit) and the
            // chassis visibly sinks *below* the real terrain surface for several frames
            // every time -- a genuine pass-through, not just cosmetic bounce. Snapping
            // the corner up to raw ground the instant it's caught below, and killing
            // any downward velocity, is the same "hit the bump-stop" behaviour a real
            // spring has; it only ever fires while still catching up to a rise, never
            // while legitimately riding above ground on the way down one.
            if (cornerHeight[i] < rawHeight[i]) {
                cornerHeight[i] = rawHeight[i];
                if (cornerVelocity[i] < 0) {
                    cornerVelocity[i] = 0;
                }
            }
        }

        let [frontLeft, frontRight, rearLeft, rearRight] = cornerHeight;
        let frontAvg = (frontLeft + frontRight) / 2;
        let rearAvg = (rearLeft + rearRight) / 2;
        let leftAvg = (frontLeft + rearLeft) / 2;
        let rightAvg = (frontRight + rearRight) / 2;

        // The drivability check above already gates entry here on the *raw*
        // reading being within maxTilt, but the spring driving these smoothed
        // heights can still transiently overshoot past what the raw reading
        // itself allowed -- clamp so a visual overshoot can't out-lean the
        // mechanical limit the collision check is meant to represent.
        mesh.position.y = (frontAvg + rearAvg) / 2 + rideHeight;
        mesh.rotation.x = Math.max(-maxTilt, Math.min(maxTilt, Math.atan2(rearAvg - frontAvg, wheelbase)));
        mesh.rotation.z = Math.max(-maxTilt, Math.min(maxTilt, Math.atan2(leftAvg - rightAvg, track)));
    });
}
