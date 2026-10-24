import { Observer } from "@babylonjs/core/Misc/observable";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import {
    BallAndSocketConstraint, DistanceConstraint, HingeConstraint, LockConstraint, Physics6DoFConstraint,
    Physics6DoFLimit, PhysicsConstraint, PrismaticConstraint, SliderConstraint, SpringConstraint
} from "@babylonjs/core/Physics/v2/physicsConstraint";
import { PhysicsActivationControl, PhysicsConstraintAxis, PhysicsConstraintAxisLimitMode, PhysicsConstraintMotorType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Scene } from "@babylonjs/core/scene";
import { customElement, property } from "lit/decorators.js";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { resolveElements } from "../Utils/resolveElements";
import { GardenPhysics } from "./Physics";

/** `limits` and `motor-axis` names. */
const axisNames: { [name: string]: PhysicsConstraintAxis } = {
    "linear-x": PhysicsConstraintAxis.LINEAR_X,
    "linear-y": PhysicsConstraintAxis.LINEAR_Y,
    "linear-z": PhysicsConstraintAxis.LINEAR_Z,
    "angular-x": PhysicsConstraintAxis.ANGULAR_X,
    "angular-y": PhysicsConstraintAxis.ANGULAR_Y,
    "angular-z": PhysicsConstraintAxis.ANGULAR_Z,
    "linear-distance": PhysicsConstraintAxis.LINEAR_DISTANCE,
};

/**
 * A physics joint between two bodies (needs `<garden-physics>`, and both
 * elements need `physics`): a door on its hinge, a pendulum, a drawer that
 * slides, a trailer on its tow bar, a flipper driven by a motor. It's
 * Babylon's [physics constraints](https://doc.babylonjs.com/features/featuresDeepDive/physics/constraints),
 * declared. The joint waits for both bodies, and joins them again when either
 * is rebuilt.
 *
 * Attributes:
 * - `between` -- the two elements, `"#a #b"` (body A first).
 * - `type` -- `ball` (ball and socket: swings any way about the pivots),
 *   `distance` (keeps the bodies' centres `max-distance` apart, a rod; with
 *   `min-distance` too, anywhere between the two: `min-distance="0"` is a
 *   rope), `hinge` (turns about `axis-a`/`axis-b`), `slider`
 *   (slides along the axis and may turn about it), `prismatic` (slides along
 *   it, no turning), `lock` (welded together), `spring` (a spring between the
 *   pivots: `min-distance`, `max-distance`, `stiffness`, `damping`) or
 *   `six-dof` (only what `limits` says). Default `ball`.
 * - `pivot-a`, `pivot-b` -- where the joint is on each body, in that body's
 *   own space (default its centre).
 * - `axis-a`, `axis-b` -- the joint's main axis in each body's space (the
 *   hinge's pin, the slider's rail), default `"1 0 0"` (`axis-b`: as
 *   `axis-a`); `perp-axis-a`, `perp-axis-b` -- a second axis at right angles
 *   (default: one Havok picks), for `six-dof` limits on the second axes.
 * - `max-distance` -- for `distance` (default: how far apart the bodies are
 *   when they're joined) and `spring`; `min-distance` for both;
 *   `stiffness` and `damping` for `spring`.
 * - `limits` -- `"axis min max, ..."`, each axis one of `linear-x`,
 *   `linear-y`, `linear-z` (metres along the main, second and third axes),
 *   `angular-x`, `angular-y`, `angular-z` (radians about them) or
 *   `linear-distance`; `min` = `max` locks that axis. With `six-dof`
 *   everything not listed is free; on another type they narrow it (a hinge
 *   that opens 90° only: `limits="angular-x 0 1.57"`).
 * - `motor` -- drives the joint at this speed (rad/s for a hinge, m/s for a
 *   slider or prismatic) along `motor-axis` (default `angular-x` for a hinge,
 *   else `linear-x`), with at most `motor-force` (default 1000). Change it
 *   from code to change the speed.
 * - `collisions` -- the two bodies collide with each other too (by default
 *   jointed bodies pass through each other, so a hinge's leaf can swing
 *   through its frame; turn this on only when they don't overlap).
 *
 * `element.constraint` is the Babylon constraint once it's made.
 *
 * @example
 * ```html
 * <garden-physics></garden-physics>
 * <garden-box id="frame" physics="static" width="0.2" height="2" depth="0.2" position="0 1 0"></garden-box>
 * <garden-box id="door" physics width="1" height="2" depth="0.1" position="0.6 1 0"></garden-box>
 * <garden-joint type="hinge" between="#frame #door" pivot-a="0.1 0 0" pivot-b="-0.5 0 0"
 *     axis-a="0 1 0" limits="angular-x -1.6 1.6"></garden-joint>
 * ```
 *
 * @category Components
 */
@customElement("garden-joint")
export class GardenJoint extends GardenElement {
    @property() type: string;
    @property() between: string;
    @property({ type: Number }) motor: number;

    /** The Babylon constraint, once both bodies exist. */
    constraint: PhysicsConstraint;

    private bodies: PhysicsBody[] = [];
    private watcher: Observer<Scene>;

    /** A `motor` change only changes the speed. */
    protected get handlesChanges() {
        return true;
    }

    protected dispose() {
        this.disconnect();
        super.dispose();
    }

    async updated(changed?: Map<PropertyKey, unknown>) {
        let onlyMotor = changed && changed.size == 1 && changed.has("motor") && this.constraint;
        if (onlyMotor) {
            this.applyMotor(this.getScene());
            return;
        }
        this.disconnect();
        this.beginBuild();
        await GardenElement.whenDocumentReady();
        let scene = this.getScene();
        let physicsEl = GardenPhysics.forElement(this);
        if (!scene || !physicsEl) {
            console.warn("<garden-joint> needs a <garden-physics> element in its <garden-scene>.");
            this.endBuild();
            return;
        }
        await physicsEl.ready;
        // Bodies are made a little after their meshes (and again when an element is
        // rebuilt), so the joint checks every frame and joins whatever bodies are there.
        this.watcher = scene.onBeforeRenderObservable.add(() => this.connect(scene));
        this.connect(scene);
    }

    /** The two elements' bodies, or null until both have one. */
    private currentBodies(): PhysicsBody[] {
        let els = resolveElements<GardenMesh>(this.between ?? "");
        if (els.length < 2) return null;
        let bodies = els.slice(0, 2).map(el => el.physicsAggregate?.body);
        return bodies.every(b => b) ? bodies : null;
    }

    private connect(scene: Scene) {
        let bodies = this.currentBodies();
        if (!bodies) return;
        if (this.constraint && bodies[0] == this.bodies[0] && bodies[1] == this.bodies[1])
            return;
        this.constraint?.dispose();
        this.bodies = bodies;
        this.constraint = this.build(bodies, scene);
        if (!this.constraint) return;
        bodies[0].addConstraint(bodies[1], this.constraint);
        if (this.hasAttribute("collisions") && this.getAttribute("collisions") != "false")
            this.constraint.isCollisionsEnabled = true;
        if (this.type?.toLowerCase() == "distance" && this.hasAttribute("min-distance"))
            this.plugin(scene).setAxisMinLimit(this.constraint, PhysicsConstraintAxis.LINEAR_DISTANCE, this.num("min-distance"));
        if (this.type?.toLowerCase() != "six-dof")
            for (let limit of this.limits())
                this.applyLimit(scene, limit);
        this.applyMotor(scene);
        this.endBuild();
    }

    private disconnect() {
        if (this.watcher) {
            this.watcher.remove();
            this.watcher = null;
        }
        this.constraint?.dispose();
        this.constraint = null;
        this.bodies = [];
    }

    private vec(name: string, fallback: Vector3): Vector3 {
        return Vector3Convert.fromString(this.getAttribute(name)) ?? fallback;
    }

    private num(name: string): number {
        return this.hasAttribute(name) ? Number(this.getAttribute(name)) : undefined;
    }

    private limits(): Physics6DoFLimit[] {
        let text = this.getAttribute("limits") ?? "";
        let limits: Physics6DoFLimit[] = [];
        for (let part of text.split(",").map(p => p.trim()).filter(p => p)) {
            let [name, min, max] = part.split(/\s+/);
            let axis = axisNames[name?.toLowerCase()];
            if (axis == null) {
                console.warn(`<garden-joint> limits: unknown axis "${name}".`);
                continue;
            }
            let limit: Physics6DoFLimit = { axis };
            if (min != null) limit.minLimit = Number(min);
            if (max != null) limit.maxLimit = Number(max);
            limits.push(limit);
        }
        return limits;
    }

    private build(bodies: PhysicsBody[], scene: Scene): PhysicsConstraint {
        let pivotA = this.vec("pivot-a", Vector3.Zero());
        let pivotB = this.vec("pivot-b", Vector3.Zero());
        let axisA = this.vec("axis-a", new Vector3(1, 0, 0));
        let axisB = this.vec("axis-b", axisA);
        switch ((this.type || "ball").toLowerCase()) {
            case "ball":
            case "ball-and-socket":
                return new BallAndSocketConstraint(pivotA, pivotB, axisA, axisB, scene);
            case "distance": {
                let max = this.num("max-distance") ?? Vector3.Distance(
                    bodies[0].transformNode.getAbsolutePosition(), bodies[1].transformNode.getAbsolutePosition());
                return new DistanceConstraint(max, scene);
            }
            case "hinge":
                return new HingeConstraint(pivotA, pivotB, axisA, axisB, scene);
            case "slider":
                return new SliderConstraint(pivotA, pivotB, axisA, axisB, scene);
            case "prismatic":
                return new PrismaticConstraint(pivotA, pivotB, axisA, axisB, scene);
            case "lock":
                return new LockConstraint(pivotA, pivotB, axisA, axisB, scene);
            case "spring":
                return new SpringConstraint(pivotA, pivotB, axisA, axisB, this.num("min-distance") ?? 0,
                    this.num("max-distance") ?? 1, this.num("stiffness") ?? 100, this.num("damping") ?? 1, scene);
            case "six-dof":
                return new Physics6DoFConstraint({
                    pivotA, pivotB, axisA, axisB,
                    perpAxisA: this.vec("perp-axis-a", undefined),
                    perpAxisB: this.vec("perp-axis-b", this.vec("perp-axis-a", undefined)),
                }, this.limits(), scene);
            default:
                console.warn(`<garden-joint> has unrecognized type "${this.type}".`);
                return null;
        }
    }

    private plugin(scene: Scene): any {
        return scene?.getPhysicsEngine()?.getPhysicsPlugin();
    }

    private applyLimit(scene: Scene, limit: Physics6DoFLimit) {
        let plugin = this.plugin(scene);
        let mode = limit.minLimit != null && limit.minLimit == limit.maxLimit
            ? PhysicsConstraintAxisLimitMode.LOCKED : PhysicsConstraintAxisLimitMode.LIMITED;
        plugin.setAxisMode(this.constraint, limit.axis, mode);
        if (limit.minLimit != null) plugin.setAxisMinLimit(this.constraint, limit.axis, limit.minLimit);
        if (limit.maxLimit != null) plugin.setAxisMaxLimit(this.constraint, limit.axis, limit.maxLimit);
    }

    private applyMotor(scene: Scene) {
        if (!this.constraint || (this.motor == null && !this.hasAttribute("motor"))) return;
        let plugin = this.plugin(scene);
        let axisName = this.getAttribute("motor-axis")?.toLowerCase();
        let axis = axisNames[axisName] ?? ((this.type || "").toLowerCase() == "hinge"
            ? PhysicsConstraintAxis.ANGULAR_X : PhysicsConstraintAxis.LINEAR_X);
        let speed = Number(this.motor ?? 0);
        plugin.setAxisMotorType(this.constraint, axis, PhysicsConstraintMotorType.VELOCITY);
        plugin.setAxisMotorMaxForce(this.constraint, axis, this.num("motor-force") ?? 1000);
        plugin.setAxisMotorTarget(this.constraint, axis, speed);
        // A sleeping body ignores its motor, so a running motor keeps its bodies awake.
        for (let body of this.bodies)
            plugin.setActivationControl?.(body, speed ? PhysicsActivationControl.ALWAYS_ACTIVE
                : PhysicsActivationControl.SIMULATION_CONTROLLED);
    }
}
