import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Axis } from "@babylonjs/core/Maths/math.axis";
import { CharacterSupportedState, PhysicsCharacterController } from "@babylonjs/core/Physics/v2/characterController";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Tools } from "@babylonjs/core/Misc/tools";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { GardenElement } from "../GardenElement";
import { IBehaviourTarget } from "../IBehaviourTarget";
import { GardenPhysics } from "../Components/Physics";
import { turnYaw } from "../Utils/turnYaw";
import { WalkInput } from "./WalkInput";

/**
 * The state of a `walk` behaviour, on its element as `element.walker`.
 * A game reads `speed` (e.g. to pick an animation) and sets `enabled` to
 * take control away for a cutscene or while the player is carried.
 *
 * @category Behaviours
 */
export class Walker {
    /** When false the walker ignores input and stops moving the mesh: a game can move it itself. Turning it back on carries on from wherever the mesh now is. */
    enabled = true;
    /** Horizontal speed actually moved last frame, units/second (0 against a wall). */
    speed = 0;
    /** True while running (Shift, gamepad B, or the touch joystick pushed to its rim). */
    running = false;
    /** The direction of travel, radians about Y; 0 faces +Z. */
    heading = 0;
    /** The Havok character controller, when the scene has `<garden-physics>`. */
    controller: PhysicsCharacterController = null;
    /** The input in use (keyboard, gamepad, touch joystick). */
    input: WalkInput;

    /** @internal */ _dispose: () => void = () => {};

    /** Moves the walker (and its character controller) to `position` and stops it. */
    teleport(position: Vector3) {
        this._target.position.copyFrom(position);
        this._resync?.();
    }

    /** @internal */ _target: IBehaviourTarget;
    /** @internal */ _resync: () => void;
}

/**
 * A walking player: WASD/arrow keys, a gamepad's left stick, or an on-screen
 * thumb pad on touch screens. Movement is relative to the camera -- push
 * "up" and the character walks away from the camera -- and the mesh turns
 * smoothly to face the way it is going. Pair it with
 * `<garden-camera type="follow" target="#id" free-look>` (the camera stays
 * where it is round the player instead of swinging behind on every turn; drag
 * to look round).
 *
 * Ground and walls:
 * - With a `<garden-physics>` in the scene, Havok's character controller
 *   walks it up slopes and steps, against walls, and pushes dynamic bodies.
 *   The capsule is sized from the mesh (or `walk-height`/`walk-radius`).
 *   Floors need `physics="static"`.
 * - Otherwise with `terrain="#height-map"` (see {@link "Behaviours/BehaviourTerrain"!BehaviourTerrain}) it
 *   follows the ground; with `collisions` it slides along meshes with
 *   `collisions` (Babylon's `moveWithCollisions`) and falls under the
 *   scene's `gravity`.
 * - Otherwise it moves flat, in x and z only.
 *
 * Attributes: `walk-speed` (units/second, default `2`), `walk-run-speed`
 * (default `5`), `walk-turn` (degrees/second, default `540`),
 * `walk-facing-offset` (degrees, for a model whose front isn't +Z, like
 * `drive-facing-offset`), `walk-height`/`walk-radius` (the capsule),
 * `walk-joystick` (`auto`: on touch screens, the default; `always`; `never`).
 *
 * Script API: `element.walker` ({@link Walker}): `speed`, `running`,
 * `heading`, `enabled`, `teleport()`.
 *
 * @example
 * ```html
 * <garden-mesh-model id="player" src="robot.glb" height="1.8" walk walk-speed="2" terrain="#dunes"></garden-mesh-model>
 * <garden-camera type="follow" target="#player" free-look radius="6" height-offset="3"></garden-camera>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourWalk(el: GardenElement, target: IBehaviourTarget, attr: Attr[]) {
    // A GardenMesh re-applies its behaviours whenever an attribute changes:
    // keep one walker, moved onto the new target.
    let previous: Walker = (<any>el).walker;
    previous?._dispose();

    let scene = el.getScene();
    let engine = scene.getEngine();
    let num = (name: string, fallback: number) => el.hasAttribute(name) ? Number(el.getAttribute(name)) : fallback;
    let walkSpeed = num("walk-speed", 2);
    let runSpeed = num("walk-run-speed", 5);
    let turnRate = Tools.ToRadians(num("walk-turn", 540));
    let facingOffset = Tools.ToRadians(num("walk-facing-offset", 0));

    let walker = new Walker();
    walker._target = target;
    walker.enabled = previous?.enabled ?? true;
    walker.heading = previous?.heading ?? target.rotation.y - facingOffset;
    walker.input = previous && !previous.input.disposed ? previous.input : new WalkInput(el.getSceneEl(), el.getAttribute("walk-joystick") ?? "auto", el);
    (<any>el).walker = walker;

    let mesh = target instanceof AbstractMesh ? target : null;
    let velocity = Vector3.Zero();
    let lastPosition = target.position.clone();
    let fallSpeed = 0;
    let usesTerrain = el.hasAttribute("terrain");
    let collisions = el.hasAttribute("collisions") && mesh != null;

    // The capsule/ellipsoid, from the mesh's own size.
    let centreOffset = 0, height = num("walk-height", 1.8), radius = num("walk-radius", 0.4);
    if (mesh) {
        let { min, max } = mesh.getHierarchyBoundingVectors(true);
        if (max.y > min.y) {
            if (!el.hasAttribute("walk-height")) height = max.y - min.y;
            if (!el.hasAttribute("walk-radius")) radius = Math.max(0.1, Math.min(height / 2, Math.max(max.x - min.x, max.z - min.z) / 2));
            centreOffset = (min.y + max.y) / 2 - mesh.getAbsolutePosition().y;
        }
    }
    if (collisions) {
        mesh.ellipsoid = new Vector3(radius, height / 2, radius);
        mesh.ellipsoidOffset = new Vector3(0, centreOffset, 0);
    }

    /** The way the player wants to go, in world space (length 0-1). */
    let desiredDirection = (): Vector3 => {
        let { x, y } = walker.input.read();
        walker.running = walker.input.running;
        if (!x && !y)
            return Vector3.Zero();
        let camera = scene.activeCamera;
        let forward = camera ? camera.getDirection(Axis.Z) : new Vector3(0, 0, 1);
        forward.y = 0;
        if (forward.lengthSquared() < 1e-6)
            forward = camera ? camera.getDirection(Axis.Y) : new Vector3(0, 0, 1); // looking straight down
        forward.y = 0;
        forward.normalize();
        let right = Vector3.Cross(Axis.Y, forward);
        return forward.scale(y).addInPlace(right.scale(x));
    };

    let turnTowards = (direction: Vector3, dt: number) => {
        if (direction.lengthSquared() < 1e-4)
            return;
        walker.heading = turnYaw(walker.heading, Math.atan2(direction.x, direction.z), turnRate * dt);
        target.rotation.y = walker.heading + facingOffset;
        // Read by a type="follow" camera, as for `drive`.
        (<any>target).drivingHeading = walker.heading;
    };

    /** The horizontal velocity to move at this frame, eased towards what the input asks for. */
    let steer = (dt: number): Vector3 => {
        let direction = walker.enabled ? desiredDirection() : Vector3.Zero();
        let magnitude = Math.min(1, direction.length());
        let wanted = magnitude > 0 ? direction.normalize().scale(magnitude * (walker.running ? runSpeed : walkSpeed)) : Vector3.Zero();
        let k = Math.min(1, dt * 10);
        velocity.x += (wanted.x - velocity.x) * k;
        velocity.z += (wanted.z - velocity.z) * k;
        if (wanted.lengthSquared() == 0 && velocity.lengthSquared() < 1e-4)
            velocity.setAll(0);
        turnTowards(magnitude > 0.05 ? wanted : Vector3.Zero(), dt);
        return velocity;
    };

    let observers: [any, Observer<Scene>][] = [];
    let measure = (dt: number) => {
        let p = target.position;
        let moved = Math.hypot(p.x - lastPosition.x, p.z - lastPosition.z);
        walker.speed = dt > 0 ? moved / dt : 0;
        lastPosition.copyFrom(p);
    };

    let physicsEl = GardenPhysics.forElement(el);
    if (physicsEl && mesh && !el.hasAttribute("physics")) {
        let down = new Vector3(0, -1, 0);
        let controller: PhysicsCharacterController;
        let wasEnabled = walker.enabled;
        walker._resync = () => {
            controller?.setPosition(target.position.add(new Vector3(0, centreOffset, 0)));
            controller?.setVelocity(Vector3.Zero());
            velocity.setAll(0);
            lastPosition.copyFrom(target.position);
        };
        physicsEl.ready.then(() => {
            if ((<any>el).walker != walker)
                return;
            controller = walker.controller = new PhysicsCharacterController(
                target.position.add(new Vector3(0, centreOffset, 0)),
                { capsuleHeight: height, capsuleRadius: radius }, scene);
            let up = Axis.Y;
            observers.push([scene.onAfterPhysicsObservable, el.observe(scene.onAfterPhysicsObservable, () => {
                let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
                if (!dt) return;
                if (!walker.enabled) {
                    wasEnabled = false;
                    return;
                }
                if (!wasEnabled) {
                    wasEnabled = true;
                    walker._resync();
                }
                let gravity = scene.getPhysicsEngine()?.gravity ?? new Vector3(0, -9.81, 0);
                let support = controller.checkSupport(dt, down);
                let wanted = steer(dt);
                let current = controller.getVelocity();
                let forward = wanted.lengthSquared() > 0 ? wanted.normalizeToNew() : new Vector3(Math.sin(walker.heading), 0, Math.cos(walker.heading));
                let out: Vector3;
                if (support.supportedState == CharacterSupportedState.SUPPORTED) {
                    out = controller.calculateMovement(dt, forward, support.averageSurfaceNormal, current, support.averageSurfaceVelocity, wanted, up);
                    // Keep the horizontal speed on slopes (Babylon's character controller sample).
                    out.subtractInPlace(support.averageSurfaceVelocity);
                    if (out.dot(up) > 1e-3) {
                        let length = out.length();
                        out.normalizeFromLength(length);
                        let horizontal = length / support.averageSurfaceNormal.dot(up);
                        out = support.averageSurfaceNormal.cross(out).cross(up).scale(horizontal);
                    }
                    out.addInPlace(support.averageSurfaceVelocity);
                } else {
                    out = controller.calculateMovement(dt, forward, up, current, Vector3.ZeroReadOnly, wanted, up);
                    out.addInPlace(up.scale(-out.dot(up)));
                    out.addInPlace(up.scale(current.dot(up)));
                    out.addInPlace(gravity.scale(dt));
                }
                controller.setVelocity(out);
                controller.integrate(dt, support, gravity);
                let p = controller.getPosition();
                target.position.set(p.x, p.y - centreOffset, p.z);
                measure(dt);
            })]);
        });
    } else {
        walker._resync = () => {
            velocity.setAll(0);
            fallSpeed = 0;
            lastPosition.copyFrom(target.position);
        };
        observers.push([scene.onBeforeRenderObservable, el.observe(scene.onBeforeRenderObservable, () => {
            let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
            if (!dt) return;
            if (!walker.enabled) {
                lastPosition.copyFrom(target.position);
                walker.speed = 0;
                return;
            }
            let v = steer(dt);
            if (collisions) {
                let falling = !usesTerrain;
                if (falling) fallSpeed += scene.gravity.y * dt;
                let before = mesh.position.y;
                (<Mesh>mesh).moveWithCollisions(new Vector3(v.x * dt, falling ? fallSpeed * dt : 0, v.z * dt));
                // Landed (or hit something above): stop accelerating.
                if (falling && Math.abs(mesh.position.y - before) < Math.abs(fallSpeed * dt) * 0.5)
                    fallSpeed = 0;
            } else {
                target.position.x += v.x * dt;
                target.position.z += v.z * dt;
            }
            measure(dt);
        })]);
    }

    walker._dispose = () => {
        for (let [observable, observer] of observers)
            observable.remove(observer);
        walker.controller?.dispose();
        walker.controller = null;
    };

    // Removed for good: the character controller, the keyboard and the pad go too (a
    // rebuild for a change keeps them; the next BehaviourWalk takes them over).
    el.whenDisposed(removed => {
        if (removed && (<any>el).walker == walker) {
            walker._dispose();
            walker.input.dispose();
        }
    });
}
